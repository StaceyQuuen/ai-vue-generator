# 阶段5：对话式迭代 + 多页面类型

## 学习目标

- 掌握 AI 对话式迭代的实现原理，理解 Context 管理的重要性
- 学会扩展 Schema 支持多种页面类型（列表页、表单页、仪表盘）
- 理解前后端数据格式转换的必要性，避免 AI 输出混乱
- 掌握 Mock 数据语义推断的优化策略

---

## 1. 对话式迭代 —— 让 AI 修改已有结果

### 1.1 为什么需要迭代？

| 没有迭代 | 有迭代 |
|---------|--------|
| 生成不满意，只能重新描述 | "加一列地址" 就能改 |
| 每次从零开始，结果不可控 | 在已有基础上微调 |
| 修改成本高，用户放弃 | 修改成本低，用户持续使用 |

**迭代是 AI 产品留存率的关键。** 用户第一次生成可能不满意，但迭代几次后通常能得到满意结果。

### 1.2 迭代接口设计

```
POST /iterate
Body: {
  currentSchema: { ... },   // 当前页面 Schema
  instruction: "增加一列地址" // 修改指令
}
```

后端把 `currentSchema` + `instruction` 组合成 Prompt 发给 AI：

```javascript
messages: [
  { role: "system", content: SYSTEM_PROMPT_ITERATE },
  {
    role: "user",
    content: `当前页面JSON：\n${JSON.stringify(currentSchema, null, 2)}\n\n修改需求：${instruction}`
  }
]
```

### 1.3 迭代专用 System Prompt

```javascript
const SYSTEM_PROMPT_ITERATE = `
你是一个前端页面修改器。用户会给你当前的页面JSON和修改需求，你需要返回修改后的完整页面JSON。

规则：
1. 保持未修改的部分不变
2. 只修改用户要求的部分
3. 返回完整的JSON，不要省略任何字段
4. 必须保持JSON结构合法
`;
```

与生成用的 System Prompt 不同，迭代 Prompt 强调"保持不变"和"返回完整"。

### 1.4 聊天消息记录

```typescript
interface ChatMessage {
  role: "user" | "assistant"
  content: string
}
```

在 App.vue 中维护 `chatMessages` 数组，记录每次迭代对话：

```typescript
chatMessages.value.push(
  { role: "user", content: instruction },
  { role: "assistant", content: `已更新「${result.data.pageName}」` }
)
```

这样用户可以看到完整的迭代历史，知道 AI 做了什么修改。

---

## 2. 多页面类型 —— 从单一到多元

### 2.1 三种页面类型

| 类型 | 组件结构 | 适用场景 |
|------|---------|---------|
| `list` | 搜索表单 + 数据表格 + 分页 | 用户管理、订单管理 |
| `form` | 表单字段 + 提交按钮 | 新增用户、创建订单 |
| `dashboard` | 统计卡片 + 搜索表单 + 数据表格 + 分页 | 销售仪表盘、系统监控 |

### 2.2 Schema 扩展

```typescript
// 新增统计卡片
interface StatCard {
  title: string    // 指标名称
  prop: string     // 字段名
  icon?: string    // 图标 emoji
  color?: string   // 颜色主题
}

interface StatCardsComponent {
  type: "statCards"
  cards: StatCard[]
}

// 新增表单字段
interface FormField {
  label: string
  prop: string
  type: "input" | "select" | "date" | "textarea" | "number"
  options?: string[]
  required?: boolean
  placeholder?: string
}

interface FormComponent {
  type: "form"
  fields: FormField[]
}

// PageSchema 新增 pageType
interface PageSchema {
  pageName: string
  pageType?: "list" | "form" | "dashboard"  // 新增
  components: PageComponent[]
}
```

### 2.3 后端 JSON Schema 变化

关键改动：所有组件字段从 `required` 变为 `optional`

```javascript
// 之前：必须包含 searchForm、table、pagination
required: ["pageName", "searchForm", "table", "pagination"]

// 现在：只有 pageName 必填，其他按 pageType 动态生成
required: ["pageName"]
```

### 2.4 后端 buildComponents 函数

```javascript
function buildComponents(parsed) {
  const components = []
  const pageType = parsed.pageType || "list"

  if (parsed.statCards) {
    components.push({ type: "statCards", cards: parsed.statCards.cards })
  }
  if (parsed.searchForm) {
    components.push({ type: "searchForm", fields: parsed.searchForm.fields })
  }
  if (parsed.table) {
    components.push({ type: "table", columns: parsed.table.columns })
  }
  if (parsed.pagination) {
    components.push({ type: "pagination", total: parsed.pagination.total || 100 })
  }
  if (parsed.form) {
    components.push({ type: "form", fields: parsed.form.fields })
  }

  return { pageName: parsed.pageName, pageType, components }
}
```

**核心思想：** 后端内部用扁平格式（`searchForm`/`table`/`form`），对外输出用数组格式（`components`）。前端只用数组格式。

---

## 3. 前后端格式转换 —— 踩坑与修复

### 3.1 问题现象

迭代时输入"增加一列地址"，结果表格消失了，出现了表单和分页。

### 3.2 根因分析

```
前端发送的 Schema:          后端 JSON Schema 约束的格式:
{                           {
  "components": [             "searchForm": { ... },
    { "type": "searchForm" }, "table": { ... },
    { "type": "table" },      "pagination": { ... }
    { "type": "pagination" }  }
  ]
}
```

AI 看到的输入是 `components` 数组，但 `format` 参数约束输出必须是扁平格式。两种格式不一致导致 AI 混乱。

### 3.3 修复方案：toBackendSchema 转换函数

```typescript
function toBackendSchema(schema: PageSchema): any {
  const result: any = {
    pageName: schema.pageName,
    pageType: schema.pageType || "list"
  }

  for (const comp of schema.components) {
    switch (comp.type) {
      case "searchForm":
        result.searchForm = { fields: comp.fields }
        break
      case "table":
        result.table = { columns: comp.columns }
        break
      case "pagination":
        result.pagination = { total: comp.total || 100 }
        break
      // ... 其他类型
    }
  }

  return result
}
```

**原则：AI 的输入格式必须与输出格式一致，否则会混乱。**

---

## 4. Mock 数据语义推断优化

### 4.1 问题：商品名显示人名

```typescript
// 旧逻辑：name 匹配太宽泛
if (p.includes("name")) return "name"  // productName 也会匹配！

// productName → faker.person.fullName() → "张三" ❌
```

### 4.2 修复：具体类型优先，通用类型兜底

```typescript
// 新逻辑：先匹配具体业务类型
if (p.includes("product") || l.includes("商品")) return "productName"  // ✅ 优先
if (p.includes("category") || l.includes("分类")) return "categoryName"
if (p.includes("dept") || l.includes("部门")) return "deptName"
// ... 更多具体类型

// 最后才匹配通用 name
if (p.includes("name")) return "personName"  // 兜底
```

### 4.3 新增的 Mock 数据类型

| 类型 | 匹配规则 | 示例数据 |
|------|---------|---------|
| `productName` | 商品/物品 | iPhone 15 Pro、华为 Mate 60 |
| `categoryName` | 分类/类型 | 电子产品、服装鞋帽 |
| `deptName` | 部门 | 技术部、市场部 |
| `positionName` | 职位/岗位 | 前端工程师、产品经理 |
| `orderStatus` | 订单状态 | 待付款、已发货 |
| `stock` | 库存 | 数字 0-9999 |
| `address` | 地址 | 具体街道地址 |
| `ip` | IP地址 | 192.168.1.1 |

---

## 5. 新增渲染器

### 5.1 StatCards 统计卡片

```vue
<div class="stat-cards">
  <div v-for="card in cards" :key="card.prop" class="stat-card">
    <div class="stat-card-icon" :style="{ background: color + '20', color }">
      {{ card.icon || "📊" }}
    </div>
    <div>
      <div class="stat-card-title">{{ card.title }}</div>
      <div class="stat-card-value">{{ mockValue }}</div>
    </div>
  </div>
</div>
```

使用 CSS Grid 自适应布局：`grid-template-columns: repeat(auto-fill, minmax(200px, 1fr))`

### 5.2 FormPage 表单页

根据字段类型渲染不同的 Element Plus 组件：

| 字段类型 | 渲染组件 |
|---------|---------|
| `input` | `<el-input>` |
| `select` | `<el-select>` + `<el-option>` |
| `date` | `<el-date-picker>` |
| `textarea` | `<el-input type="textarea">` |
| `number` | `<el-input-number>` |

---

## 6. 完整架构图

```
┌────────────────── 前端 (Vue 3) ──────────────────┐
│                                                    │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │
│  │ 输入区域  │  │ 预览区域  │  │ 对话式迭代区域   │ │
│  │ Prompt   │  │ Schema   │  │ ChatMessage[]    │ │
│  │ 模板选择  │  │ 渲染器   │  │ 迭代输入框       │ │
│  └─────┬────┘  └──────────┘  └────────┬─────────┘ │
│        │                              │            │
│   generatePageStream          iteratePageStream    │
│        │                              │            │
│        │     toBackendSchema()         │            │
│        │     (格式转换)                │            │
└────────┼──────────────────────────────┼────────────┘
         │                              │
┌────────┼──────────────────────────────┼────────────┐
│        ▼                              ▼            │
│  POST /generate/stream     POST /iterate/stream   │
│                                                    │
│              后端 (Express)                        │
│  ┌─────────────────────────────────────────────┐  │
│  │  SYSTEM_PROMPT        SYSTEM_PROMPT_ITERATE │  │
│  │  (从零生成)           (基于已有修改)         │  │
│  └──────────────────┬──────────────────────────┘  │
│                     │                              │
│              Ollama API                            │
│              (format: JSON Schema)                 │
│                     │                              │
│              buildComponents()                     │
│              (扁平 → 数组格式转换)                  │
└─────────────────────┼──────────────────────────────┘
                      │
              ┌───────▼────────┐
              │  Ollama 本地模型 │
              └────────────────┘
```

---

## 阶段5总结

阶段5的核心是从"一次性生成"升级为"对话式迭代"，从"单一列表页"升级为"多页面类型"：

1. **对话式迭代** → AI 理解上下文，在已有基础上修改，大幅提升用户留存
2. **多页面类型** → Schema 扩展 + 新渲染器，覆盖更多业务场景
3. **格式转换** → `toBackendSchema()` 解决前后端格式不一致导致 AI 混乱的问题
4. **Mock 数据优化** → 语义推断优先级调整，商品名不再显示人名

**关键教训：AI 的输入格式必须与输出格式一致，否则会产生不可预期的结果。**
