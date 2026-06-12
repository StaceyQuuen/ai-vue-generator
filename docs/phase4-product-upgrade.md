# 阶段4：产品化升级 —— 从工具到产品

## 学习目标

- 掌握 Prompt 模板系统的设计，降低用户使用门槛
- 实现 localStorage 持久化，保存生成历史
- 实现浏览器端文件下载功能
- 升级代码生成器，输出完整可运行的 Vue 组件

---

## 1. Prompt 模板系统

### 1.1 为什么需要模板？

AI 产品的最大门槛不是技术，而是**用户不知道怎么描述需求**。

| 用户类型 | 行为 | 占比 |
|---------|------|------|
| 专家用户 | 自己写详细 Prompt | 10% |
| 普通用户 | 不知道写什么，放弃 | 70% |
| 模板用户 | 点击模板，稍作修改 | 20% |

模板系统把 70% 的"放弃用户"转化为"模板用户"，大幅提升产品转化率。

### 1.2 模板设计原则

```typescript
export interface PromptTemplate {
  id: string        // 唯一标识
  title: string     // 显示名称
  icon: string      // 图标（增强辨识度）
  prompt: string    // 预填的 Prompt 文本
}
```

**好的模板 Prompt 要满足：**
- 明确页面类型（用户管理、订单管理...）
- 列出搜索字段（姓名搜索、状态筛选...）
- 列出表格列（序号、姓名、手机号...）
- 包含分页需求

```typescript
// 好的模板
prompt: "用户管理页面，包含姓名搜索、手机号搜索、状态筛选、用户列表（序号、姓名、手机号、邮箱、状态、注册时间）、分页"

// 差的模板
prompt: "用户管理"  // 太模糊，AI 可能生成不完整的页面
```

### 1.3 使用方式

```vue
<el-button
  v-for="tpl in promptTemplates"
  :key="tpl.id"
  size="small"
  @click="applyTemplate(tpl)"
>
  {{ tpl.icon }} {{ tpl.title }}
</el-button>
```

```typescript
function applyTemplate(tpl: PromptTemplate) {
  prompt.value = tpl.prompt  // 一键填充
}
```

---

## 2. 历史记录持久化

### 2.1 为什么需要历史记录？

| 没有历史 | 有历史 |
|---------|--------|
| 刷新页面，生成结果丢失 | 随时回看之前的生成结果 |
| 重复输入相同 Prompt | 一键加载历史记录 |
| 无法对比不同 Prompt 的效果 | 轻松对比和迭代 |

### 2.2 localStorage 方案

```typescript
const STORAGE_KEY = "ai-vue-generator-history"
const MAX_HISTORY = 20  // 最多保存20条

export function getHistory(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []  // 解析失败时返回空数组，避免崩溃
  }
}

export function addHistory(prompt: string, schema: PageSchema): HistoryItem {
  const history = getHistory()
  const item: HistoryItem = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    prompt,
    schema,
    createdAt: Date.now()
  }
  history.unshift(item)  // 最新的在前
  if (history.length > MAX_HISTORY) history.length = MAX_HISTORY  // 限制数量
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history))
  return item
}
```

### 2.3 ID 生成策略

```typescript
id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
// 示例: "m5q3k8a2"
```

- `Date.now().toString(36)` — 时间戳转 36 进制，短且有序
- `Math.random().toString(36).slice(2, 6)` — 4位随机字符，避免碰撞

### 2.4 localStorage 的局限

| 维度 | localStorage | 更好的方案 |
|------|-------------|-----------|
| 容量 | ~5MB | IndexedDB（无限制） |
| 性能 | 同步阻塞 | IndexedDB（异步） |
| 数据安全 | 明文存储 | 加密存储 |
| 跨设备 | 仅本机 | 云端同步 |

对于当前项目，localStorage 足够用。当数据量增大时，再考虑升级到 IndexedDB。

---

## 3. 代码下载功能

### 3.1 浏览器端文件下载原理

```typescript
export function downloadFile(filename: string, content: string): void {
  // 1. 创建 Blob 对象（二进制大对象）
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" })

  // 2. 生成临时 URL
  const url = URL.createObjectURL(blob)

  // 3. 创建隐藏的 <a> 标签并触发点击
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()

  // 4. 释放临时 URL（避免内存泄漏）
  URL.revokeObjectURL(url)
}
```

### 3.2 关键 API

| API | 作用 | 注意 |
|-----|------|------|
| `new Blob()` | 将字符串转为二进制对象 | 指定 `type` 确保编码正确 |
| `URL.createObjectURL()` | 生成 `blob://` 临时 URL | 用完必须 `revokeObjectURL()` |
| `a.download` | 指定下载文件名 | 仅在同源 URL 下生效 |

### 3.3 剪贴板复制

```typescript
function handleCopyCode() {
  navigator.clipboard.writeText(generatedCode.value).then(() => {
    ElMessage.success("代码已复制到剪贴板")
  }).catch(() => {
    ElMessage.error("复制失败")
  })
}
```

`navigator.clipboard.writeText()` 是现代浏览器提供的剪贴板 API，比旧版的 `document.execCommand('copy')` 更可靠。

---

## 4. 代码生成器升级

### 4.1 从"片段"到"完整组件"

阶段3的代码生成器只输出简单的模板片段。阶段4升级为**完整可运行的 Vue 组件**：

```vue
<template>
  <div class="page-container">
    <h2 class="page-title">用户管理</h2>
    <el-form :model="searchForm" inline>
      <!-- 搜索字段 -->
      <el-form-item>
        <el-button type="primary" @click="handleSearch">查询</el-button>
        <el-button @click="handleReset">重置</el-button>
      </el-form-item>
    </el-form>
    <el-table :data="tableData" border stripe>
      <!-- 表格列 -->
    </el-table>
    <el-pagination ... />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from "vue"

const currentPage = ref(1)
const pageSize = ref(10)
const searchForm = reactive<Record<string, any>>({})
const tableData = ref([])

function handleSearch() { ... }
function handleReset() { ... }
</script>
```

### 4.2 生成器架构

```
generateVueCode(schema)
    │
    ├─ 遍历 components
    │   ├─ searchForm → generateSearchFormTemplate(fields)
    │   ├─ table → generateTableTemplate(columns)
    │   └─ pagination → 内联模板
    │
    └─ buildVueFile(template)
        ├─ <template> 包裹
        ├─ <script setup> 包裹
        │   ├─ import { ref, reactive }
        │   ├─ 状态定义
        │   └─ 事件处理函数
        └─ <style scoped> 包裹
```

### 4.3 搜索表单生成

```typescript
function generateSearchFormTemplate(fields: SearchFormField[]): string {
  const formItems = fields.map(field => {
    if (field.type === "select") {
      // 生成 <el-select> + <el-option>
    }
    if (field.type === "date") {
      // 生成 <el-date-picker>
    }
    // 默认生成 <el-input>
    return `      <el-form-item label="${field.label}">
        <el-input v-model="searchForm.${field.prop}" placeholder="请输入${field.label}" clearable />
      </el-form-item>`
  }).join("\n")

  return `  <el-form :model="searchForm" inline>
${formItems}
      <el-form-item>
        <el-button type="primary" @click="handleSearch">查询</el-button>
        <el-button @click="handleReset">重置</el-button>
      </el-form-item>
    </el-form>`
}
```

**核心思想：** Schema 中的每个字段类型（input/select/date）映射到不同的 Element Plus 组件，这就是**类型到组件的映射**。

---

## 5. 完整产品功能清单

| 功能 | 用户操作 | 技术实现 |
|------|---------|---------|
| 快捷模板 | 点击模板按钮 | promptTemplates 配置 + v-model 绑定 |
| 流式生成 | 点击"生成页面" | SSE + ReadableStream |
| 实时预览 | 默认视图 | Schema 驱动动态渲染 |
| 代码查看 | 切换"代码"标签 | generateVueCode 模板引擎 |
| 代码复制 | 点击"复制" | navigator.clipboard API |
| 代码下载 | 点击"下载" | Blob + createObjectURL |
| 历史记录 | 点击"历史"按钮 | localStorage + ElDrawer |
| 历史回溯 | 点击历史项 | 加载 schema + prompt |
| 历史删除 | 点击"删除" | localStorage 过滤 |
| Mock 数据 | 自动填充 | Faker + 字段类型推断 |

---

## 6. 项目文件结构

```
web/src/
├── ai/
│   └── fieldAnalyzer.ts     # AI 字段分析（后端代理）
├── api.ts                   # API 调用封装（含流式）
├── App.vue                  # 主组件（集成所有功能）
├── config/
│   └── promptTemplates.ts   # Prompt 模板配置
├── generator/
│   └── generateVueCode.ts   # 代码生成器
├── mock/
│   └── generateMockData.ts  # Mock 数据生成
├── renderer/
│   ├── SearchForm.vue       # 搜索表单渲染器
│   ├── DataTable.vue        # 数据表格渲染器
│   └── PagePagination.vue   # 分页渲染器
├── store/
│   └── history.ts           # 历史记录管理
├── types/
│   └── schema.ts            # 类型定义
└── utils/
    └── download.ts          # 文件下载工具
```

---

## 阶段4总结

阶段4的核心是从"技术实现"升级为"用户体验"：

1. **Prompt 模板** → 降低使用门槛，提升转化率
2. **历史记录** → 数据持久化，避免重复劳动
3. **代码下载/复制** → 闭环体验，生成即可用
4. **完整代码生成** → 从片段到组件，真正可用

这四个能力让产品从"开发者工具"变成"用户产品"。
