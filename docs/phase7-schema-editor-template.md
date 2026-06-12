# 阶段7：Schema 可视化编辑 + 模板市场

## 学习目标

- 掌握双向 Schema 驱动开发：AI → Schema → UI 和 UI → Schema → Code
- 学会可视化 Schema 编辑器的设计与实现
- 理解模板市场的 CRUD 架构与 localStorage 持久化
- 掌握 Schema 导入/导出的实现方式

---

## 1. 为什么需要 Schema 可视化编辑？

### 1.1 AI 生成的局限

| 场景 | AI 生成 | 手动编辑 |
|------|--------|---------|
| 增加一列 | 需要写 Prompt，可能改错其他部分 | 直接加一行，1秒完成 |
| 修改标签名 | "把姓名改为用户名" → 可能改更多 | 直接改 label，0.5秒 |
| 调整列顺序 | "把金额列移到状态前面" → AI 可能不理解 | 拖拽或剪切粘贴 |
| 删除一个搜索字段 | "去掉手机号搜索" → 可能删错 | 直接点删除 |

**核心洞察：AI 擅长从零生成，但不擅长精确微调。可视化编辑器是 AI 生成后的必要补充。**

### 1.2 双向 Schema 驱动

```
方向1: AI → Schema → UI（生成阶段）
  用户描述 → AI 生成 Schema → 渲染预览

方向2: UI → Schema → Code（编辑阶段）
  用户修改表单 → 更新 Schema → 重新生成代码
```

---

## 2. Schema 可视化编辑器

### 2.1 编辑器架构

```
┌──────────────────────────────────────────┐
│  🔧 Schema 编辑器          📥导入 📤导出  │
├──────────────────────────────────────────┤
│  基本信息                                 │
│  页面名称: [用户管理        ]             │
│  页面类型: [列表页      ▼   ]             │
├──────────────────────────────────────────┤
│  组件开关                                 │
│  ☑ 📊 统计卡片  ☑ 🔍 搜索表单            │
│  ☑ 📋 数据表格  ☑ 📄 分页                │
│  ☐ 📝 表单                                │
├──────────────────────────────────────────┤
│  📋 数据表格                    + 添加列   │
│  [姓名    ] [name     ] [  ] ✕           │
│  [手机号  ] [phone    ] [  ] ✕           │
│  [邮箱    ] [email    ] [  ] ✕           │
└──────────────────────────────────────────┘
```

### 2.2 组件开关设计

通过 checkbox 控制组件的添加/删除：

```typescript
function toggleComponent(type: string, enable: boolean) {
  const idx = localSchema.value.components.findIndex(c => c.type === type)
  if (enable && idx === -1) {
    // 添加默认组件
    if (type === "searchForm") getOrCreateSearchForm()
    else if (type === "table") getOrCreateTable()
    else if (type === "pagination") {
      localSchema.value.components.push({ type: "pagination", total: 100 })
    }
  } else if (!enable && idx !== -1) {
    // 移除组件
    localSchema.value.components.splice(idx, 1)
  }
  emitUpdate()
}
```

### 2.3 惰性创建模式

编辑器采用"惰性创建"模式 —— 只有当用户操作时才创建组件：

```typescript
function getOrCreateTable(): { type: "table"; columns: TableColumn[] } {
  let comp = findComponent("table")
  if (!comp) {
    comp = { type: "table", columns: [] }
    localSchema.value.components.push(comp)
  }
  return comp
}
```

好处：避免空组件污染 Schema。

### 2.4 Schema 导入/导出

```typescript
// 导出：Schema → JSON → 剪贴板
function handleExportSchema() {
  const json = JSON.stringify(localSchema.value, null, 2)
  navigator.clipboard.writeText(json)
}

// 导入：剪贴板 JSON → 解析 → 更新 Schema
function handleImportSchema() {
  const parsed = JSON.parse(importJson.value)
  if (parsed.pageName && parsed.components) {
    localSchema.value = parsed
    emitUpdate()
  }
}
```

**使用场景：**
- 导出：保存 Schema 到笔记、分享给同事
- 导入：从其他来源获取 Schema、恢复备份

---

## 3. 模板市场

### 3.1 为什么需要模板市场？

| 没有模板市场 | 有模板市场 |
|------------|-----------|
| 每次都从零开始 | 一键加载常用页面结构 |
| 重复输入相同描述 | 保存自己的模板反复使用 |
| 新手不知道怎么描述 | 内置模板提供参考 |

### 3.2 模板数据结构

```typescript
interface SchemaTemplate {
  id: string           // 唯一标识
  name: string         // 模板名称
  icon: string         // 图标 emoji
  category: string     // 分类：列表页/表单页/仪表盘/自定义
  schema: PageSchema   // 页面 Schema
  isBuiltin?: boolean  // 是否内置模板
  createdAt: number    // 创建时间
}
```

### 3.3 内置模板 vs 自定义模板

```
内置模板（代码定义）:
├── 用户管理列表 👤
├── 订单管理列表 📦
├── 商品管理列表 🛍️
├── 用户信息表单 📝
└── 销售数据仪表盘 📊

自定义模板（localStorage 存储）:
├── 用户自己保存的模板
├── 从 AI 生成结果保存
└── 从导入的 Schema 保存
```

### 3.4 模板 CRUD

```typescript
// 保存为模板
function saveAsTemplate(name, icon, category, schema) {
  const custom = getCustomTemplates()
  custom.unshift({
    id: "custom-" + Date.now().toString(36),
    name, icon, category, schema,
    isBuiltin: false,
    createdAt: Date.now()
  })
  localStorage.setItem(STORAGE_KEY, JSON.stringify(custom))
}

// 删除模板（只能删自定义）
function deleteTemplate(id: string) {
  const custom = getCustomTemplates().filter(t => t.id !== id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(custom))
}

// 获取所有模板（内置 + 自定义）
function getTemplates() {
  return [...builtinTemplates, ...getCustomTemplates()]
}
```

### 3.5 分类筛选

```typescript
const categories = computed(() => {
  const cats = new Set<string>()
  templates.value.forEach(t => cats.add(t.category))
  return ["全部", ...cats]
})

const filteredTemplates = computed(() => {
  if (selectedCategory.value === "全部") return templates.value
  return templates.value.filter(t => t.category === selectedCategory.value)
})
```

---

## 4. 完整用户流程

```
┌─────────────────────────────────────────────────────────┐
│                     用户入口                              │
├────────────┬────────────┬────────────┬──────────────────┤
│  AI 生成    │  模板市场   │  导入 JSON  │  历史记录        │
│  (从零开始) │  (快速开始) │  (恢复备份) │  (找回之前)      │
└─────┬──────┴─────┬──────┴─────┬──────┴─────┬────────────┘
      │            │            │            │
      └────────────┼────────────┼────────────┘
                   │            │
              ┌────▼────────────▼────┐
              │   PageSchema         │
              │   (核心数据)          │
              └────┬────────────┬────┘
                   │            │
          ┌────────▼──┐   ┌────▼──────────┐
          │  预览渲染   │   │  Schema 编辑器 │
          │  (只读)    │   │  (可编辑)      │
          └───────────┘   └────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │  修改后的 Schema     │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │  代码生成器          │
                    │  generateVueCode()  │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │  Vue 组件代码        │
                    │  复制 / 下载         │
                    └─────────────────────┘
```

---

## 5. 设计原则

### 5.1 渐进式披露

```
初级用户：AI 生成 → 预览 → 满意就下载
中级用户：AI 生成 → 编辑器微调 → 下载
高级用户：模板市场 → 编辑器定制 → 导出 Schema → 分享
```

### 5.2 数据流单向性

```
Schema 是唯一数据源
  ├── 预览 = f(Schema)
  ├── 代码 = f(Schema)
  └── 编辑器 = Schema 的读写接口
```

编辑器修改 Schema → 自动触发预览和代码更新。

### 5.3 内置不可删

内置模板用 `isBuiltin: true` 标记，删除按钮只对自定义模板显示。这确保新手始终有参考模板可用。

---

## 阶段7总结

阶段7的核心是从"AI 单向生成"升级为"AI 生成 + 人工编辑"的双向工作流：

1. **Schema 编辑器** → 组件开关 + 字段增删改 + 属性编辑，可视化微调 AI 生成结果
2. **模板市场** → 内置模板快速开始 + 自定义模板保存复用
3. **Schema 导入/导出** → JSON 格式分享和备份
4. **双向 Schema 驱动** → AI 生成 + 人工编辑，两种方式共享同一数据源

**关键洞察：AI 擅长从零生成，但不擅长精确微调。可视化编辑器是 AI 生成后的必要补充。**
