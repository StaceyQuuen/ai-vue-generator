# AI Vue 页面生成器

> 从前端开发者到 AI 全栈开发者 —— 一步步实现一个 AI 应用产品

## 项目简介

这是一个 AI 驱动的 Vue 页面生成器，用户输入自然语言描述，AI 自动生成包含搜索表单、数据表格、分页组件的完整页面。

## 核心技术栈

| 技术 | 用途 |
|------|------|
| Vue 3 + TypeScript | 前端框架 |
| Element Plus | UI 组件库 |
| Express | 后端服务 |
| Ollama (qwen2.5:7b) | 本地大模型 |
| JSON Schema | 结构化输出约束 |
| Zod | 运行时数据验证 |
| SSE | 流式输出 |

## 架构概览

```
用户输入 → Prompt工程 → LLM推理 → 结构化输出 → 业务逻辑 → 渲染
```

```
┌──────────────── 前端 (Vue 3) ────────────────┐
│  用户输入 → API调用 → SSE流式接收 → 渲染      │
└──────────────────────┬───────────────────────┘
                       │
┌──────────────── 后端 (Express) ──────────────┐
│  /generate         非流式生成                 │
│  /generate/stream  SSE流式生成                │
│  /analyze-fields   字段类型分析               │
└──────────────────────┬───────────────────────┘
                       │
              ┌────────▼────────┐
              │  Ollama 本地模型  │
              └─────────────────┘
```

## 学习路线

| 阶段 | 主题 | 核心收获 |
|------|------|---------|
| [阶段1](phase1-project-init.md) | 项目初始化与 AI 对接 | AI 应用架构、首次 AI 调用 |
| [阶段2](phase2-structured-output.md) | 结构化输出与页面渲染 | JSON Schema 约束、Zod 验证、Schema 驱动渲染 |
| [阶段3](phase3-streaming-mock-proxy.md) | 流式输出、Mock 数据与后端代理 | SSE 流式、Faker 数据、API 安全 |
| [阶段4](phase4-product-upgrade.md) | 产品化升级 | Prompt 模板、历史记录、代码下载、完整代码生成 |
| [阶段5](phase5-iterate-multi-type.md) | 对话式迭代 + 多页面类型 | AI 迭代修改、多页面类型、格式转换、Mock 优化 |

## 快速开始

```bash
# 1. 启动 Ollama
ollama serve

# 2. 启动后端
cd server && npm install && node index.js

# 3. 启动前端
cd web && npm install && npm run dev

# 4. 打开浏览器
# http://localhost:3000
```

## GitHub 仓库

[https://github.com/StaceyQuuen/ai-vue-generator](https://github.com/StaceyQuuen/ai-vue-generator)
