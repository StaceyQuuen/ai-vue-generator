# 阶段6：多模型适配 + 项目级生成

## 学习目标

- 掌握适配器模式实现多模型切换，理解不同 AI 提供商的 API 差异
- 学会项目级 Schema 设计，一次生成多个页面 + 路由 + Layout
- 理解前端动态配置的实现方式，让用户在前端选择模型
- 掌握代码生成器扩展，从单文件到多文件项目结构

---

## 1. 为什么需要多模型适配？

### 1.1 单模型的局限

| 问题 | 影响 |
|------|------|
| 只能用 Ollama | 没有 GPU 的用户无法使用 |
| 本地模型效果有限 | 7B 模型经常输出格式错误 |
| 无法利用云端模型 | GPT-4o、DeepSeek 等效果更好 |
| 不同场景需要不同模型 | 简单任务用小模型，复杂任务用大模型 |

### 1.2 两种主流 API 格式

```
Ollama 格式:                          OpenAI 格式:
POST /api/chat                        POST /chat/completions
{                                     {
  "model": "qwen2.5:7b",               "model": "gpt-4o-mini",
  "messages": [...],                    "messages": [...],
  "format": { ... },  ← JSON Schema    "response_format": {     ← 简单标记
    结构化输出约束                        "type": "json_object"
  },                                  },
  "stream": true                       "stream": true
}                                     }
```

关键差异：

| 差异点 | Ollama | OpenAI |
|--------|--------|--------|
| 接口路径 | `/api/chat` | `/chat/completions` |
| 结构化输出 | `format: schema`（精确约束） | `response_format: json_object`（仅标记） |
| 流式格式 | 原始 JSON 行 | `data: {...}` SSE 格式 |
| 响应结构 | `message.content` | `choices[0].delta.content` |
| 模型列表 | `/api/tags` | 无标准接口 |

---

## 2. 适配器模式实现

### 2.1 核心思想

```
前端请求 → getProviderConfig() → callAI() → 根据 provider 构造不同请求
                                        ├── ollama → /api/chat + format
                                        └── openai → /chat/completions + response_format
```

### 2.2 callAI 适配器函数

```javascript
async function callAI({ provider, baseUrl, apiKey, model, messages, format, stream }) {
  if (provider === "openai") {
    return {
      url: `${baseUrl}/chat/completions`,
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
      },
      body: {
        model,
        messages,
        stream,
        // OpenAI 只支持 json_object 标记，不支持精确 Schema
        ...(format ? { response_format: { type: "json_object" } } : {})
      },
      provider
    }
  }

  // Ollama
  return {
    url: `${baseUrl}/api/chat`,
    headers: {
      "Content-Type": "application/json",
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {})
    },
    body: {
      model,
      messages,
      stream,
      // Ollama 支持精确的 JSON Schema 约束
      ...(format ? { format } : {})
    },
    provider
  }
}
```

### 2.3 响应解析适配

```javascript
function parseAIResponse(parsed, provider) {
  if (provider === "openai") {
    return parsed.choices?.[0]?.delta?.content
        || parsed.choices?.[0]?.message?.content || ""
  }
  return parsed.message?.content || ""
}
```

### 2.4 流式输出适配

两种 Provider 的流式格式完全不同：

**Ollama** — 每行是一个完整 JSON：
```
{"message":{"content":"你"},"done":false}
{"message":{"content":"好"},"done":false}
{"done":true}
```

**OpenAI** — SSE 格式，`data: ` 前缀：
```
data: {"choices":[{"delta":{"content":"你"}}]}
data: {"choices":[{"delta":{"content":"好"}}]}
data: [DONE]
```

后端流式解析需要根据 provider 分支处理：

```javascript
if (provider === "openai") {
  // 解析 SSE 格式
  for (const line of lines) {
    if (!line.startsWith("data: ")) continue
    if (line.includes("[DONE]")) continue
    const parsed = JSON.parse(line.slice(6))
    const token = parsed.choices?.[0]?.delta?.content || ""
    // ...
  }
} else {
  // 解析原始 JSON 行
  for (const line of lines) {
    const parsed = JSON.parse(line.trim())
    const token = parsed.message?.content || ""
    // ...
  }
}
```

---

## 3. 模型配置 UI

### 3.1 ProviderConfig 类型

```typescript
interface ProviderConfig {
  provider: "ollama" | "openai"
  baseUrl: string
  apiKey: string
  model: string
}
```

### 3.2 前端配置面板

```
┌─────────────────────────────┐
│  ⚙️ 模型配置                │
├─────────────────────────────┤
│  AI 提供商                   │
│  ┌─────────────────────┐    │
│  │ Ollama (本地)  ▼    │    │
│  └─────────────────────┘    │
│                             │
│  API 地址                    │
│  ┌─────────────────────┐    │
│  │ http://localhost:... │    │
│  └─────────────────────┘    │
│                             │
│  API Key (OpenAI 时显示)     │
│  ┌─────────────────────┐    │
│  │ sk-...              │    │
│  └─────────────────────┘    │
│                             │
│  模型                        │
│  ┌────────────────┐ ┌────┐  │
│  │ qwen2.5:7b   ▼ │ │刷新│  │
│  └────────────────┘ └────┘  │
│                             │
│  ℹ️ Ollama 模式              │
│  使用本地 Ollama 服务...     │
└─────────────────────────────┘
```

### 3.3 模型列表接口

```javascript
app.get("/models", async (req, res) => {
  const provider = req.query.provider || DEFAULT_PROVIDER

  if (provider === "ollama") {
    // 从 Ollama API 获取本地已安装的模型
    const response = await fetch(`${baseUrl}/api/tags`)
    const data = await response.json()
    const models = data.models.map(m => ({
      id: m.name,
      name: m.name,
      size: `${(m.size / 1024 / 1024 / 1024).toFixed(1)}GB`
    }))
    res.json({ success: true, models })
  } else {
    // OpenAI 返回预设列表
    res.json({
      success: true,
      models: [
        { id: "gpt-4o-mini", name: "GPT-4o Mini" },
        { id: "gpt-4o", name: "GPT-4o" }
      ]
    })
  }
})
```

### 3.4 配置传递方式

前端每次请求都把 ProviderConfig 带上：

```typescript
function getProviderBody(config?: ProviderConfig): any {
  if (!config) return {}
  return {
    provider: config.provider,
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    model: config.model
  }
}

// 调用时
body: JSON.stringify({ prompt, ...getProviderBody(config) })
```

后端从请求体提取配置：

```javascript
function getProviderConfig(reqBody) {
  return {
    provider: reqBody.provider || DEFAULT_PROVIDER,
    baseUrl: reqBody.baseUrl || DEFAULT_BASE_URL,
    apiKey: reqBody.apiKey || DEFAULT_API_KEY,
    model: reqBody.model || DEFAULT_MODEL
  }
}
```

---

## 4. 项目级生成

### 4.1 从单页面到项目

| 单页面生成 | 项目级生成 |
|-----------|-----------|
| 1 个 PageSchema | 多个 PageSchema + 项目名 |
| 1 个 Vue 文件 | 多个 Vue + router + Layout + main |
| 无路由 | 自动生成路由配置 |
| 无导航 | 自动生成侧边栏 |

### 4.2 项目 Schema

```typescript
interface ProjectSchema {
  projectName: string    // "电商管理系统"
  pages: PageSchema[]    // 多个页面
}
```

后端 JSON Schema 约束：

```javascript
const projectSchema = {
  type: "object",
  properties: {
    projectName: {
      type: "string",
      description: "项目名称，如电商管理系统"
    },
    pages: {
      type: "array",
      minItems: 2,
      maxItems: 5,
      description: "页面列表",
      items: structuredPageSchema  // 复用页面 Schema
    }
  },
  required: ["projectName", "pages"]
}
```

### 4.3 项目代码生成器

```typescript
export function generateProjectCode(project: ProjectSchema): Record<string, string> {
  const files: Record<string, string> = {}

  // 1. 为每个页面生成 Vue 文件
  for (const page of project.pages) {
    const fileName = toKebabCase(page.pageName)
    files[`src/views/${fileName}/index.vue`] = generateVueCode(page)
  }

  // 2. 生成路由文件
  files["src/router.ts"] = generateRouter(project.pages)

  // 3. 生成 Layout（带侧边栏的 App.vue）
  files["src/App.vue"] = generateLayout(project)

  // 4. 生成入口文件
  files["src/main.ts"] = generateMain()

  return files
}
```

生成的文件结构：

```
src/
├── views/
│   ├── user-management/index.vue    ← 用户管理页
│   ├── order-dashboard/index.vue    ← 订单仪表盘
│   └── product-form/index.vue       ← 新增商品表单
├── router.ts                         ← 路由配置
├── App.vue                           ← Layout + 侧边栏
└── main.ts                           ← 入口文件
```

### 4.4 中文名转文件名

```typescript
function toKebabCase(str: string): string {
  return str
    .replace(/[\u4e00-\u9fa5]/g, "")   // 去掉中文
    .replace(/([A-Z])/g, "-$1")         // 驼峰转连字符
    .replace(/[^a-zA-Z0-9]/g, "-")      // 非字母数字转连字符
    .replace(/-+/g, "-")                // 合并连续连字符
    .replace(/^-|-$/g, "")              // 去掉首尾连字符
    .toLowerCase() || "page"
}

// "用户管理" → "page"
// "UserManagement" → "user-management"
// "order list" → "order-list"
```

---

## 5. 完整架构图

```
┌────────────────────── 前端 (Vue 3) ──────────────────────┐
│                                                           │
│  ┌────────────┐  ┌────────────┐  ┌────────────────────┐  │
│  │ 单页面模式  │  │ 项目级模式  │  │ ⚙️ 模型配置面板    │  │
│  │ Prompt输入  │  │ 项目描述    │  │ Provider 选择      │  │
│  │ 模板选择    │  │ 多页面卡片  │  │ API 地址 / Key     │  │
│  │ 对话式迭代  │  │ 项目下载    │  │ 模型列表 + 刷新    │  │
│  └─────┬──────┘  └─────┬──────┘  └─────────┬──────────┘  │
│        │               │                    │              │
│   generatePageStream  generateProject   ProviderConfig    │
│        │               │                    │              │
│        └───────────────┼────────────────────┘              │
│                        │  getProviderBody()                │
└────────────────────────┼───────────────────────────────────┘
                         │
┌────────────────────────┼───────────────────────────────────┐
│                        ▼                                   │
│              后端 (Express)                                │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  getProviderConfig(req.body)                         │  │
│  │  → { provider, baseUrl, apiKey, model }              │  │
│  └──────────────────────┬──────────────────────────────┘  │
│                         │                                 │
│  ┌──────────────────────▼──────────────────────────────┐  │
│  │  callAI({ provider, ... })                           │  │
│  │  ├── ollama → /api/chat + format: schema             │  │
│  │  └── openai → /chat/completions + response_format    │  │
│  └──────────────────────┬──────────────────────────────┘  │
│                         │                                 │
│            ┌────────────┴────────────┐                    │
│            ▼                         ▼                    │
│     Ollama API               OpenAI API                  │
│     (本地模型)               (云端模型)                    │
└──────────────────────────────────────────────────────────┘
```

---

## 6. OpenAI 兼容 API 支持

除了 OpenAI 官方，很多国产模型也兼容 OpenAI 格式：

| 提供商 | API 地址 | 模型示例 |
|--------|---------|---------|
| OpenAI | `https://api.openai.com/v1` | gpt-4o-mini |
| DeepSeek | `https://api.deepseek.com/v1` | deepseek-chat |
| 通义千问 | `https://dashscope.aliyuncs.com/compatible-mode/v1` | qwen-plus |
| 智谱 AI | `https://open.bigmodel.cn/api/paas/v4` | glm-4-flash |

只需在模型配置面板修改 API 地址和 Key 即可切换。

---

## 阶段6总结

阶段6的核心是从"单模型单页面"升级为"多模型项目级"：

1. **适配器模式** → `callAI()` 根据 provider 构造不同请求，统一调用接口
2. **流式适配** → Ollama 原始 JSON 行 vs OpenAI SSE 格式，后端自动切换解析
3. **模型配置 UI** → 前端选择 provider/model，配置随请求传递给后端
4. **项目级生成** → `ProjectSchema` + `generateProjectCode()` 生成完整项目结构
5. **OpenAI 兼容** → 支持所有 OpenAI 兼容 API（DeepSeek、通义千问等）

**关键教训：不同 AI 提供商的 API 格式差异很大，适配器模式是解耦的关键。**
