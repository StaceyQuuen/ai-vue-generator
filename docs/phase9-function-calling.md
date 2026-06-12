# 阶段9：Function Calling / Tool Use

## 学习目标

- 理解 Function Calling 的核心概念与工作流程
- 掌握工具定义（Tool Definition）的 JSON Schema 规范
- 学会实现多轮工具调用循环（Tool Call Loop）
- 理解 Ollama 与 OpenAI 在 Function Calling 上的差异
- 掌握工具执行器（Tool Executor）的设计模式

---

## 1. 什么是 Function Calling？

### 1.1 从纯文本到可执行

```
之前：用户 → AI → 文本/JSON（AI 凭空编造数据）

现在：用户 → AI → 调用工具 → 获取真实数据 → 基于数据生成结果
```

**核心区别**：AI 不再是"闭门造车"，而是能"查资料再回答"。

### 1.2 类比理解

| 场景 | 没有 Function Calling | 有 Function Calling |
|------|---------------------|-------------------|
| 生成订单仪表盘 | AI 编造"总订单 1000" | AI 调用 query_database_stats → 获取真实"总订单 8432" |
| 生成用户列表页 | AI 猜测字段（name, age...） | AI 调用 query_table_data → 获取真实字段结构 |
| 生成注册表单 | AI 随意设计字段 | AI 调用 get_form_config → 获取推荐字段配置 |
| 生成项目 | AI 凭感觉组合页面 | AI 调用 get_page_recommendation → 获取推荐方案 |

---

## 2. 工作流程

### 2.1 多轮工具调用循环

```
用户输入: "电商后台管理系统"
         │
    ┌────▼────┐
    │  Round 1 │  AI 分析需求，决定调用哪些工具
    └────┬────┘
         │
    ┌────▼────────────────────────────┐
    │  AI: 我需要调用以下工具          │
    │  1. get_page_recommendation     │
    │     (business_domain: "电商")   │
    │  2. query_table_data            │
    │     (table_name: "products")    │
    │  3. query_database_stats        │
    │     (metric: "order_count")     │
    └────┬────────────────────────────┘
         │
    ┌────▼────┐
    │  执行工具 │  后端依次执行每个工具调用
    └────┬────┘
         │
    ┌────▼────────────────────────────┐
    │  工具结果返回给 AI               │
    │  - 推荐页面: 商品管理/订单看板/.. │
    │  - 商品表字段: 名称/分类/价格/..  │
    │  - 订单统计: 8432 单             │
    └────┬────────────────────────────┘
         │
    ┌────▼────┐
    │  Round 2 │  AI 基于工具数据生成最终 Schema
    └────┬────┘
         │
    ┌────▼────────────────────────────┐
    │  最终结果: 基于真实数据的页面     │
    └─────────────────────────────────┘
```

### 2.2 代码实现核心

```javascript
// 多轮循环，最多 5 轮
for (let round = 0; round < maxRounds; round++) {
  // 1. 发送消息给 AI（包含工具定义）
  const response = await fetch(apiUrl, {
    method: "POST",
    body: JSON.stringify({
      model,
      messages,
      tools: toolDefinitions,  // 告诉 AI 有哪些工具可用
      tool_choice: "auto"      // AI 自主决定是否调用
    })
  })

  const result = await response.json()
  const message = result.choices[0].message

  // 2. 把 AI 的回复加入消息历史
  messages.push(message)

  // 3. 检查 AI 是否要调用工具
  if (message.tool_calls && message.tool_calls.length > 0) {
    for (const toolCall of message.tool_calls) {
      // 4. 执行工具
      const toolResult = executeToolCall(
        toolCall.function.name,
        JSON.parse(toolCall.function.arguments)
      )

      // 5. 把工具结果返回给 AI
      messages.push({
        role: "tool",
        tool_call_id: toolCall.id,
        content: JSON.stringify(toolResult)
      })
    }
    continue  // 继续下一轮，让 AI 处理工具结果
  }

  // 6. AI 没有调用工具，说明已经给出最终答案
  return message.content
}
```

---

## 3. 工具定义规范

### 3.1 OpenAI Function Calling 格式

```json
{
  "type": "function",
  "function": {
    "name": "query_database_stats",
    "description": "查询数据库统计信息，如用户总数、订单总数等",
    "parameters": {
      "type": "object",
      "properties": {
        "metric": {
          "type": "string",
          "enum": ["user_count", "order_count", "revenue"],
          "description": "要查询的统计指标"
        },
        "time_range": {
          "type": "string",
          "enum": ["today", "week", "month", "year"],
          "description": "时间范围"
        }
      },
      "required": ["metric"]
    }
  }
}
```

**关键字段**：
- `name`：工具名称，AI 调用时使用
- `description`：工具描述，AI 根据此描述决定是否调用
- `parameters`：参数的 JSON Schema，AI 据此生成调用参数
- `required`：必填参数列表

### 3.2 本项目定义的 4 个工具

| 工具名 | 用途 | 典型场景 |
|-------|------|---------|
| `query_database_stats` | 查询统计指标 | 仪表盘统计卡片 |
| `query_table_data` | 查询数据表结构 | 列表页字段定义 |
| `get_form_config` | 获取表单推荐配置 | 表单页字段设计 |
| `get_page_recommendation` | 获取页面推荐方案 | 项目级页面规划 |

---

## 4. 工具执行器设计

### 4.1 模式匹配分发

```javascript
function executeToolCall(name, args) {
  switch (name) {
    case "query_database_stats":
      return mockDatabase[args.metric]
    case "query_table_data":
      return mockTableSchemas[args.table_name]
    case "get_form_config":
      return mockFormConfigs[args.form_type]
    case "get_page_recommendation":
      return recommendations[args.business_domain]
    default:
      return { success: false, error: `未知工具: ${name}` }
  }
}
```

### 4.2 当前使用 Mock 数据

当前实现使用内存中的 Mock 数据模拟业务数据库。在生产环境中，这些函数可以替换为：
- 真实数据库查询（MySQL / PostgreSQL）
- REST API 调用（已有业务系统）
- 第三方服务（天气 API / 支付 API 等）

### 4.3 工具返回格式

```json
{
  "success": true,
  "data": {
    "metric": "order_count",
    "label": "总订单数",
    "value": 8432,
    "trend": "+8.3%",
    "time_range": "all"
  }
}
```

统一返回 `success` + `data` 或 `error`，便于 AI 理解执行结果。

---

## 5. Ollama vs OpenAI 差异

### 5.1 Function Calling 支持

| 特性 | OpenAI | Ollama |
|------|--------|--------|
| tools 参数 | ✅ 原生支持 | ❌ 不支持 |
| tool_calls 响应 | ✅ 结构化返回 | ❌ 无 |
| tool role 消息 | ✅ 支持 | ❌ 无 |
| 替代方案 | 直接使用 | JSON Schema + Prompt |

### 5.2 Ollama 的降级方案

Ollama 不支持 Function Calling，我们使用 JSON Schema + Prompt 作为降级：

```javascript
if (provider === "ollama") {
  // 不传 tools 参数，改用 format 约束输出
  requestBody = {
    model,
    messages,
    stream: false,
    format: structuredPageSchema  // 用 Schema 约束输出格式
  }
  // Prompt 中已经包含了工具信息的描述
}
```

**注意**：Ollama 模式下 AI 无法真正"调用"工具，只能基于 Prompt 中的工具描述来生成更准确的结果。

---

## 6. 前端展示：工具调用链路

### 6.1 Tool Call Log 数据结构

```typescript
interface ToolCallLog {
  name: string           // 工具名称
  args: Record<string, any>  // 调用参数
  result: any            // 执行结果
}
```

### 6.2 可视化展示

```
🔧 工具调用链路（3 次调用）          [清除]
┌─────────────────────────────────────┐
│ [get_page_recommendation] 第 1 步   │
│ 参数：{"business_domain":"电商"}     │
│ 结果：{"recommended_pages":[...]}    │
├─────────────────────────────────────┤
│ [query_table_data] 第 2 步          │
│ 参数：{"table_name":"products"}     │
│ 结果：{"fields":[...]}              │
├─────────────────────────────────────┤
│ [query_database_stats] 第 3 步      │
│ 参数：{"metric":"order_count"}      │
│ 结果：{"value":8432,...}            │
└─────────────────────────────────────┘
```

这让用户能看到 AI 的"思考过程"，增强信任感。

---

## 阶段9总结

阶段9的核心是让 AI 从"闭门造车"升级为"查资料再回答"：

1. **工具定义** → 4 个业务工具，覆盖统计查询、表结构查询、表单配置、页面推荐
2. **多轮调用循环** → AI 自主决定调用哪些工具，最多 5 轮
3. **工具执行器** → 模式匹配分发，Mock 数据模拟，可替换为真实 API
4. **调用链路可视化** → 前端展示每一步工具调用的参数和结果
5. **Ollama 降级** → 不支持 Function Calling 时用 Schema + Prompt 替代

**关键洞察：Function Calling 让 AI 从"知识生成器"变为"任务执行者"。AI 不再只是回答问题，而是能调用你的业务系统获取真实数据，生成更准确的结果。**
