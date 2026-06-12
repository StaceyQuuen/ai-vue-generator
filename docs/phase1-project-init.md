# 阶段1：项目初始化与 AI 对接

## 学习目标

- 理解 AI 应用的核心架构
- 搭建前后端项目骨架
- 完成第一次 AI 调用（非结构化输出）

---

## 1. AI 应用核心架构

所有 AI 应用的数据流都是这个模式：

```
用户输入 → Prompt 工程 → LLM 推理 → 结构化输出 → 业务逻辑 → 渲染
```

| 环节 | 本项目对应 | 说明 |
|------|-----------|------|
| 用户输入 | 文本框输入"用户管理页面" | 自然语言描述需求 |
| Prompt 工程 | System Prompt + 用户输入 | 指导 AI 理解任务 |
| LLM 推理 | Ollama qwen2.5:7b | 本地大模型推理 |
| 结构化输出 | JSON Schema 约束 | 让 AI 返回可解析的 JSON |
| 业务逻辑 | Zod 验证 + 组件映射 | 将 JSON 转为前端组件 |
| 渲染 | Vue 组件动态渲染 | 搜索表单 + 表格 + 分页 |

---

## 2. 项目结构

```
ai-vue-generator/
├── server/              # 后端 (Express)
│   ├── index.js         # API 服务
│   ├── package.json
│   └── .env             # 环境变量（API_KEY, BASE_URL, MODEL）
├── web/                 # 前端 (Vue 3 + Vite)
│   ├── src/
│   │   ├── api.ts       # API 调用封装
│   │   ├── App.vue      # 主组件
│   │   └── types/
│   │       └── schema.ts # 数据类型定义
│   ├── package.json
│   └── .env             # 前端环境变量
└── .gitignore
```

---

## 3. 后端搭建要点

### 3.1 Express 服务

```javascript
// server/index.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config({ path: join(__dirname, ".env") });

const app = express();
app.use(cors());        // 允许前端跨域请求
app.use(express.json()); // 解析 JSON 请求体
```

### 3.2 环境变量管理

```env
# server/.env
API_KEY=                # API密钥（Ollama本地不需要）
BASE_URL=http://localhost:11434  # LLM服务地址
MODEL=qwen2.5:7b        # 使用的模型
```

**为什么用环境变量？**
- 不同环境（开发/生产）可以配置不同的值
- 敏感信息（API Key）不硬编码在代码中
- 切换模型只需改 `.env`，不需要改代码

### 3.3 调用 Ollama API

```javascript
const response = await fetch(`${BASE_URL}/api/chat`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    model: MODEL,
    stream: false,          // 非流式
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: prompt }
    ]
  })
});

const result = await response.json();
// result.message.content 就是 AI 的回复
```

**Ollama API 要点：**
- 端点：`POST /api/chat`
- `stream: false` → 返回完整 JSON
- `stream: true` → 返回逐行 JSON 流
- 响应格式：`{ message: { role, content }, done: boolean }`

---

## 4. 前端搭建要点

### 4.1 Vue 3 + Vite + TypeScript

```bash
npm create vite@latest web -- --template vue-ts
```

### 4.2 API 调用封装

```typescript
// web/src/api.ts
export async function generatePage(prompt: string) {
  const response = await fetch("http://localhost:3001/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt })
  });
  return response.json();
}
```

### 4.3 类型定义

```typescript
// web/src/types/schema.ts
export interface PageSchema {
  pageName: string;
  components: PageComponent[];
}

export type PageComponent =
  | SearchFormComponent
  | TableComponent
  | PaginationComponent;
```

**Schema-Driven Development（Schema 驱动开发）**：
先定义数据结构（Schema），再基于 Schema 写验证、渲染、生成逻辑。这是 AI 应用的核心开发模式——AI 输出的是数据，前端根据数据渲染。

---

## 5. 关键概念

### 5.1 非结构化 vs 结构化输出

| 模式 | AI 返回 | 前端处理 | 可靠性 |
|------|---------|---------|--------|
| 非结构化 | 自由文本 | 需要正则/解析提取 | ❌ 低 |
| 结构化 | JSON | 直接 `JSON.parse` | ✅ 高 |

阶段1先跑通链路，阶段2再引入结构化输出。

### 5.2 前后端分离的 AI 调用

```
方案A: 前端直调 AI（阶段1的做法）
  浏览器 → Ollama API
  ❌ API Key 暴露、跨域问题、模型切换需前端改代码

方案B: 后端代理（阶段3的做法）
  浏览器 → Express 后端 → Ollama API
  ✅ Key 安全、统一管理、可加缓存/限流
```

---

## 6. 常见问题

| 问题 | 原因 | 解决 |
|------|------|------|
| `fetch failed` | Ollama 未启动 | 运行 `ollama serve` |
| CORS 报错 | 前端直调 Ollama 跨域 | 使用后端代理 |
| AI 返回空内容 | Prompt 不够明确 | 优化 System Prompt |
| 中文乱码 | PowerShell 编码问题 | 浏览器端不受影响 |

---

## 阶段1总结

阶段1完成了 AI 应用的最小可用链路：

```
用户输入 → 后端 API → Ollama → 返回结果 → 前端显示
```

这是所有 AI 应用的基础。后续阶段都在此基础上优化体验和可靠性。
