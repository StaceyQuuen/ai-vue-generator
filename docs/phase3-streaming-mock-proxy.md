# 阶段3：流式输出、Mock 数据与后端代理

## 学习目标

- 掌握 SSE（Server-Sent Events）流式输出的原理和实现
- 理解 Ollama 流式格式与 OpenAI 格式的区别
- 实现 Mock 数据自动生成管线
- 将 AI 调用统一收归后端，保护 API Key 安全

---

## 1. 流式输出（Streaming）

### 1.1 为什么流式输出是 AI 应用的分水岭？

| 模式 | 用户体验 | 实现复杂度 |
|------|---------|-----------|
| 非流式 | 等待 10-30 秒，结果一次性出现 | 简单 |
| **流式** | AI 像打字一样逐字输出，实时看到进展 | 较复杂 |

ChatGPT、Claude 等所有对话式 AI 产品都使用流式输出。这是 AI 应用从"工具"变成"产品"的关键体验升级。

### 1.2 SSE 协议

Server-Sent Events 是流式输出的标准协议：

```
后端发送：
data: {"token": "你", "fullContent": "你"}\n\n
data: {"token": "好", "fullContent": "你好"}\n\n
data: {"token": "，", "fullContent": "你好，"}\n\n
data: {"done": true, "result": {...}}\n\n
```

**格式规则：**
- 每条消息以 `data: ` 开头
- 每条消息以 `\n\n`（两个换行）结尾
- 前端通过 `EventSource` 或 `fetch + ReadableStream` 读取

### 1.3 后端实现

```javascript
app.post("/generate/stream", async (req, res) => {
  // 1. 设置 SSE 响应头
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");

  // 2. 请求 Ollama（stream: true）
  const response = await fetch(`${BASE_URL}/api/chat`, {
    method: "POST",
    body: JSON.stringify({
      model: MODEL,
      format: structuredPageSchema,
      stream: true,  // ← 开启流式
      messages: [...]
    })
  });

  // 3. 读取 Ollama 的流式响应
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullContent = "";
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() || "";  // 保留不完整的行

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        const parsed = JSON.parse(trimmed);
        const token = parsed.message?.content || "";

        if (token) {
          fullContent += token;
          // 4. 转发为 SSE 格式给前端
          res.write(`data: ${JSON.stringify({ token, fullContent })}\n\n`);
        }
      } catch {}
    }
  }

  // 5. 流结束，发送最终结果
  res.write(`data: ${JSON.stringify({ done: true, result })}\n\n`);
  res.end();
});
```

### 1.4 ⚠️ 关键踩坑：Ollama 流式格式 ≠ OpenAI 格式

| 来源 | 格式 | 前缀 |
|------|------|------|
| OpenAI | `data: {"choices":[{"delta":{"content":"Hi"}}]}` | 有 `data:` 前缀 |
| **Ollama** | `{"message":{"content":"Hi"},"done":false}` | **裸 JSON，无前缀** |

**错误写法（会导致 token 全部丢失）：**
```javascript
// ❌ 按行前缀过滤——Ollama 的行没有 "data:" 前缀！
if (!line.startsWith("data:")) continue;
const jsonStr = line.slice(5).trim();
```

**正确写法：**
```javascript
// ✅ 直接解析裸 JSON
const trimmed = line.trim();
if (!trimmed) continue;
const parsed = JSON.parse(trimmed);
```

### 1.5 Buffer 机制

网络传输中，一个 chunk 可能包含不完整的行：

```
chunk 1: '{"message":{"content":"你"}\n{"message":{"conten'
chunk 2: 't":"好"}}\n'
```

处理方法：
```javascript
buffer += decoder.decode(value, { stream: true });
const lines = buffer.split("\n");
buffer = lines.pop() || "";  // 最后一段可能不完整，留到下次
```

### 1.6 前端读取 SSE

```typescript
export async function generatePageStream(
  prompt: string,
  callbacks: StreamCallbacks
) {
  const response = await fetch(`${API_BASE}/generate/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt })
  });

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split("\n");

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;  // 前端读的是后端发的 SSE，有前缀
      const data = JSON.parse(line.slice(6));

      if (data.token) callbacks.onToken(data.token, data.fullContent);
      if (data.done) callbacks.onDone(data.result);
      if (data.error) callbacks.onError(data.error);
    }
  }
}
```

### 1.7 前端流式 UI

```vue
<!-- 流式输出时显示实时 JSON -->
<div v-if="streamingContent" class="streaming-section">
  <div class="streaming-header">
    <span class="streaming-dot"></span>  <!-- 脉冲动画 -->
    AI 正在生成...
  </div>
  <pre class="streaming-content">{{ streamingContent }}</pre>
</div>
```

```typescript
await generatePageStream(prompt.value, {
  onToken(token, fullContent) {
    streamingContent.value = fullContent;  // 实时更新
  },
  onDone(result) {
    streamingContent.value = "";
    pageSchema.value = result.data;  // 渲染最终结果
  },
  onError(error) {
    errorMsg.value = error;
  }
});
```

---

## 2. Mock 数据自动生成

### 2.1 问题

AI 生成的表格只有列定义（columns），没有行数据。用户看到的是空表格，体验很差。

### 2.2 解决方案：字段类型推断 + Faker 生成

```
AI Schema (columns)
    │
    ▼
字段类型推断 (guessFieldType)
  prop="phone", label="手机号" → type="phone"
  prop="amount", label="金额"   → type="money"
    │
    ▼
类型 → 生成器映射 (generatorMap)
  phone → faker.phone.number()
  money → faker.number.float({ fractionDigits: 2 })
    │
    ▼
生成 N 行 Mock 数据
```

### 2.3 字段类型推断

```typescript
function guessFieldType(prop: string, label: string): string {
  const p = prop.toLowerCase();
  const l = label.toLowerCase();

  if (p.includes("phone") || l.includes("手机")) return "phone";
  if (p.includes("email") || l.includes("邮箱")) return "email";
  if (p.includes("money") || l.includes("金额")) return "money";
  if (p.includes("date") || l.includes("日期")) return "date";
  if (p.includes("status") || l.includes("状态")) return "status";
  // ... 更多规则
  return "text";  // 默认
}
```

**设计思想：** 同时匹配 `prop`（英文）和 `label`（中文），覆盖 AI 可能生成的各种命名风格。

### 2.4 策略模式

```typescript
const generatorMap: Record<string, MockGenerator> = {
  id:     () => faker.number.int({ min: 1, max: 9999 }),
  name:   () => faker.person.fullName(),
  phone:  () => faker.phone.number(),
  email:  () => faker.internet.email(),
  money:  () => faker.number.float({ min: 100, max: 99999, fractionDigits: 2 }),
  date:   () => faker.date.recent({ days: 365 }).toLocaleDateString("zh-CN"),
  status: () => faker.helpers.arrayElement(["正常", "冻结", "禁用"]),
  orderNo:() => `ORD${faker.number.int({ min: 100000, max: 999999 })}`,
  text:   () => faker.lorem.sentence({ min: 2, max: 6 })
};
```

每种字段类型对应一个生成函数，新增类型只需加一行映射——这就是**策略模式**。

### 2.5 中文本地化

```typescript
import { faker } from "@faker-js/faker/locale/zh_CN";
```

Faker 支持多语言，`zh_CN` 会生成中文姓名、中文手机号等本地化数据。

---

## 3. 后端 AI 代理

### 3.1 问题

阶段2中 `fieldAnalyzer.ts` 在前端直接调用 AI：

```typescript
// ❌ 旧代码：前端直调 AI
const client = new OpenAI({
  apiKey: import.meta.env.VITE_API_KEY,     // Key 暴露在浏览器！
  baseURL: import.meta.env.VITE_BASE_URL,
  dangerouslyAllowBrowser: true              // 危险！
});
```

**风险：**
- 🔒 API Key 暴露在浏览器 DevTools
- 🏗️ 前端和后端各自调用 AI，维护成本高
- 🔄 切换模型需要改前端代码

### 3.2 解决方案：后端代理

```
前端 → 后端 /analyze-fields → Ollama
前端 → 后端 /generate/stream → Ollama
前端 → 后端 /generate → Ollama
```

所有 AI 调用都走后端，前端只发 HTTP 请求：

```typescript
// ✅ 新代码：通过后端代理
export async function analyzeFields(columns: string[]): Promise<FieldAnalysis> {
  const response = await fetch(`${apiBase}/analyze-fields`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ columns })
  });
  const result = await response.json();
  if (result.success) return result.data;
  throw new Error(result.error || "字段分析失败");
}
```

### 3.3 收益

| 维度 | 前端直调 | 后端代理 |
|------|---------|---------|
| 安全性 | ❌ Key 暴露 | ✅ Key 只在后端 |
| 维护性 | ❌ 前后端各调各的 | ✅ 统一管理 |
| 扩展性 | ❌ 切模型改前端 | ✅ 只改后端 .env |
| 功能 | ❌ 无法加缓存/限流 | ✅ 可加中间件 |

### 3.4 环境变量简化

前端 `.env` 从 3 个变量简化为 1 个：

```env
# 旧（前端直调 AI）
VITE_API_KEY=xxx
VITE_BASE_URL=http://localhost:11434
VITE_MODEL=qwen2.5:7b

# 新（后端代理）
VITE_API_BASE=http://localhost:3001
```

---

## 4. 完整架构图

```
┌──────────────── 前端 (Vue 3 + Element Plus) ────────────────┐
│                                                              │
│  用户输入 prompt                                              │
│       │                                                      │
│       ▼                                                      │
│  api.ts ──POST /generate/stream──┐                           │
│       │                          │                           │
│       │  ◀── SSE tokens ────────┘                           │
│       │                                                      │
│       ▼                                                      │
│  streamingContent 实时显示 JSON                               │
│       │                                                      │
│       ▼ (done)                                               │
│  Schema 驱动渲染 + Mock 数据填充                              │
│  ┌──────────┐ ┌──────────────┐ ┌────────────┐               │
│  │SearchForm│ │  DataTable   │ │ Pagination │               │
│  │(真实表单) │ │(序号+数据+操作)│ │  (分页)    │               │
│  └──────────┘ └──────────────┘ └────────────┘               │
└──────────────────────────────────────────────────────────────┘
         │
         ▼ 所有 AI 调用走后端代理
┌──────────────── 后端 (Express) ──────────────────────────────┐
│                                                              │
│  POST /generate         非流式生成                            │
│  POST /generate/stream  SSE 流式生成                          │
│  POST /analyze-fields   字段类型分析                          │
│                                                              │
│  ──▶ Ollama qwen2.5:7b (API Key 安全存储在 .env)            │
└──────────────────────────────────────────────────────────────┘
```

---

## 5. 关键文件清单

| 文件 | 作用 | 核心知识点 |
|------|------|-----------|
| `server/index.js` | 后端 API 服务 | SSE 流式、JSON Schema、Zod 验证 |
| `web/src/api.ts` | 前端 API 封装 | fetch + ReadableStream 读取 SSE |
| `web/src/ai/fieldAnalyzer.ts` | 字段分析 | 后端代理模式 |
| `web/src/mock/generateMockData.ts` | Mock 数据生成 | 字段推断 + 策略模式 + Faker |
| `web/src/App.vue` | 主组件 | 流式状态管理 + Schema 驱动渲染 |
| `web/src/renderer/DataTable.vue` | 表格渲染 | 序号列 + 操作列固定渲染 |
| `web/src/types/schema.ts` | 类型定义 | TypeScript 类型安全 |

---

## 阶段3总结

阶段3完成了 AI 应用从"能用"到"好用"的三个关键升级：

1. **流式输出** → 用户不再干等，实时看到 AI 思考过程
2. **Mock 数据** → 表格不再是空的，生成即可预览真实效果
3. **后端代理** → API Key 安全、架构统一、可扩展

这三个能力是所有生产级 AI 应用的标配。
