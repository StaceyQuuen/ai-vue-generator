# 阶段2：结构化输出与页面渲染

## 学习目标

- 掌握结构化输出（Structured Output）的原理和实现
- 理解 JSON Schema 约束 AI 输出的机制
- 使用 Zod 进行运行时数据验证
- 实现 Schema 驱动的动态组件渲染

---

## 1. 为什么需要结构化输出？

### 1.1 非结构化输出的问题

阶段1中 AI 返回自由文本，前端无法可靠解析：

```
AI 可能返回：
  "这是一个用户管理页面，包含姓名、手机号搜索..."
  或者：
  { "page": "用户管理", "fields": [...] }  // 格式不确定
  或者：
  ```json
  { ... }
  ```                                       // 带 markdown 包裹
```

### 1.2 结构化输出的解决方案

通过 JSON Schema 约束 AI，**强制**返回符合格式的 JSON：

```
用户输入 + System Prompt + JSON Schema → AI → 严格符合 Schema 的 JSON
```

---

## 2. JSON Schema 约束机制

### 2.1 Ollama 的 format 参数

```javascript
const response = await fetch(`${BASE_URL}/api/chat`, {
  method: "POST",
  body: JSON.stringify({
    model: MODEL,
    format: structuredPageSchema,  // ← 关键！传入 JSON Schema
    stream: false,
    messages: [...]
  })
});
```

`format` 参数告诉 Ollama：输出必须符合这个 JSON Schema。底层原理是**受限解码（Constrained Decoding）**——模型生成每个 token 时，只允许选择符合 Schema 的 token。

### 2.2 Schema 设计要点

```javascript
const structuredPageSchema = {
  type: "object",
  properties: {
    pageName: {
      type: "string",
      description: "页面名称，如用户管理、订单管理"  // ← description 帮助 AI 理解
    },
    searchForm: {
      type: "object",
      description: "搜索表单，包含2-4个搜索字段",
      properties: {
        fields: {
          type: "array",
          minItems: 2,    // ← 最少2个字段
          maxItems: 6,    // ← 最多6个字段
          description: "搜索字段列表",
          items: {
            type: "object",
            properties: {
              label: { type: "string", description: "字段中文标签" },
              prop: { type: "string", description: "字段英文名，驼峰命名" },
              type: { type: "string", enum: ["input", "select", "date"] },
              options: { type: "array", items: { type: "string" } }
            },
            required: ["label", "prop"]
          }
        }
      },
      required: ["fields"]
    },
    // ... table, pagination 类似
  },
  required: ["pageName", "searchForm", "table", "pagination"]
};
```

**关键设计原则：**

| 原则 | 说明 | 示例 |
|------|------|------|
| `description` 必填 | 帮助 AI 理解每个字段的含义 | `"description": "页面名称，如用户管理"` |
| `minItems` 约束 | 防止 AI 返回空数组 | `"minItems": 2` |
| `enum` 枚举 | 限制 AI 只能从预定义值中选择 | `"enum": ["input", "select", "date"]` |
| `required` 必填 | 确保关键字段不为空 | `"required": ["label", "prop"]` |

### 2.3 踩过的坑

**问题：AI 返回空数组 `fields: []`**

原因：没有 `minItems` 约束，AI 可能"偷懒"返回空数组。

解决：给所有数组加 `minItems` 和 `description`：
```javascript
fields: {
  type: "array",
  minItems: 2,        // 强制至少2个
  maxItems: 6,        // 限制最多6个
  description: "搜索字段列表"  // 描述清楚
}
```

---

## 3. Zod 运行时验证

### 3.1 为什么需要 Zod？

JSON Schema 约束 AI 输出，但**不保证 100% 可靠**。AI 可能：
- 返回不符合 Schema 的字段
- 返回类型错误（数字字段返回字符串）
- 遗漏必填字段

Zod 在运行时做最后一道防线：

```javascript
import { z } from "zod";

const SearchFormFieldSchema = z.object({
  label: z.string(),
  prop: z.string(),
  type: z.enum(["input", "select", "date"]).optional(),
  options: z.array(z.string()).optional()
});

// 验证 AI 返回的数据
try {
  const parsed = StructuredPageZodSchema.parse(JSON.parse(content));
  // ✅ 验证通过，parsed 类型安全
} catch (e) {
  // ❌ 验证失败，降级处理
  parsed = { raw: content };
}
```

### 3.2 双层验证架构

```
AI 输出
  │
  ├─ 第1层：JSON Schema（Ollama 层面约束输出格式）
  │
  ├─ 第2层：Zod（Node.js 层面验证数据正确性）
  │
  └─ 降级策略：验证失败 → 返回 raw 数据，前端提示错误
```

---

## 4. Schema 驱动的动态渲染

### 4.1 组件映射

AI 返回的 JSON 被转换为组件数组：

```javascript
const components = [
  { type: "searchForm", fields: [...] },   // → <SearchForm>
  { type: "table", columns: [...] },       // → <DataTable>
  { type: "pagination", total: 100 }       // → <PagePagination>
];
```

### 4.2 Vue 动态渲染

```vue
<template v-for="(comp, index) in pageSchema.components" :key="index">
  <SearchForm
    v-if="comp.type === 'searchForm'"
    :fields="comp.fields"
  />
  <DataTable
    v-else-if="comp.type === 'table'"
    :columns="comp.columns"
    :data="[]"
  />
  <PagePagination
    v-else-if="comp.type === 'pagination'"
    v-model:current-page="currentPage"
  />
</template>
```

**核心思想：** 前端不关心"页面长什么样"，只关心"有哪些组件、每个组件什么配置"。AI 决定组件组合，前端负责渲染。

### 4.3 渲染器组件

每个组件都有对应的渲染器：

| 渲染器 | 输入 | 渲染 |
|--------|------|------|
| `SearchForm.vue` | `fields: SearchFormField[]` | Element Plus 表单 |
| `DataTable.vue` | `columns: TableColumn[]` | Element Plus 表格 |
| `PagePagination.vue` | `total: number` | Element Plus 分页 |

---

## 5. 代码生成器

除了实时预览，还提供 Vue 代码生成功能：

```typescript
// web/src/generator/generateVueCode.ts
export function generateVueCode(schema: PageSchema): string {
  // 遍历 components，生成对应的 Vue 模板代码
  // 返回完整的 .vue 文件内容
}
```

这让用户可以直接复制生成的代码到自己的项目中使用。

---

## 6. 完整数据流

```
用户输入: "用户管理页面，包含姓名搜索、手机号搜索、用户列表、分页"
    │
    ▼
后端 Express (/generate)
    │
    ├─ System Prompt + JSON Schema + 用户输入
    │
    ▼
Ollama (qwen2.5:7b)
    │
    ├─ 受限解码 → 返回符合 Schema 的 JSON
    │
    ▼
Zod 验证
    │
    ├─ 验证通过 → 转换为 components 数组
    ├─ 验证失败 → 降级返回 raw 数据
    │
    ▼
前端 App.vue
    │
    ├─ pageSchema.components → 动态渲染组件
    ├─ generateVueCode() → 生成可复制的代码
    │
    ▼
用户看到: 搜索表单 + 数据表格 + 分页器
```

---

## 阶段2总结

阶段2的核心突破是**结构化输出**，让 AI 从"自由聊天"变成"可靠的 JSON 生成器"：

- JSON Schema → 约束 AI 输出格式
- Zod → 运行时验证数据正确性
- Schema 驱动 → 前端根据数据动态渲染

这是 AI 应用从"玩具"变成"产品"的关键一步。
