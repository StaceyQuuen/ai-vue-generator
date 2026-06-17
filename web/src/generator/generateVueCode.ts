import type { PageSchema, ProjectSchema, SearchFormField, TableColumn, StatCard, FormField } from "../types/schema"

export function generateVueCode(schema: PageSchema): string {
  const pageType = schema.pageType || "list"
  let template = ""
  let scriptExtra = ""

  for (const component of schema.components) {
    switch (component.type) {
      case "statCards":
        template += generateStatCardsTemplate(component.cards)
        // 生成统计卡片的响应式数据：statData 存储卡片数值（有配置值则使用，数字直接用，字符串加引号，否则随机生成 0~9999 整数）
        // statTrend 存储趋势文本（如 "↑12%"），没有则默认空字符串
        scriptExtra += `
const statData = reactive({
${component.cards.map(c => `  ${c.prop}: ${c.value !== undefined ? (typeof c.value === 'number' ? c.value : `"${c.value}"`) : Math.floor(Math.random() * 10000)}`).join(",\n")}
})
const statTrend = {
${component.cards.map(c => `  ${c.prop}: "${c.trend || ""}"`).join(",\n")}
}
`
        break
      case "searchForm":
        template += generateSearchFormTemplate(component.fields)
        break
      case "table":
        template += generateTableTemplate(component.columns)
        break
      case "pagination":
        template += `  <el-pagination
    v-model:current-page="currentPage"
    v-model:page-size="pageSize"
    :total="${component.total || 100}"
    layout="total, prev, pager, next, jumper"
    style="margin-top: 16px; justify-content: flex-end"
  />
`
        break
      case "form":
        template += generateFormTemplate(component.fields)
        scriptExtra += `
const formModel = reactive<Record<string, any>>({})

function handleSubmit() {
  console.log("提交数据:", formModel)
}

function handleFormReset() {
  Object.keys(formModel).forEach(key => {
    formModel[key] = undefined
  })
}
`
        break
    }
  }

  const imports = pageType === "form"
    ? `import { reactive } from "vue"`
    : `import { ref, reactive } from "vue"`

  const commonScript = pageType === "form"
    ? ""
    : `
const currentPage = ref(1)
const pageSize = ref(10)
const searchForm = reactive<Record<string, any>>({})
const tableData = ref([])

function handleSearch() {
  console.log("搜索条件:", searchForm)
}

function handleReset() {
  Object.keys(searchForm).forEach(key => {
    searchForm[key] = undefined
  })
}
`

  return `<template>
  <div class="page-container">
    <h2 class="page-title">${schema.pageName}</h2>
${template}
  </div>
</template>

<script setup lang="ts">
${imports}
${commonScript}${scriptExtra}
</script>

<style scoped>
.page-container {
  padding: 20px;
}
.page-title {
  margin: 0 0 20px;
  font-size: 20px;
}
.stat-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 16px;
  margin-bottom: 20px;
}
.stat-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 8px;
}
.stat-card-icon {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
}
.stat-card-title {
  font-size: 13px;
  color: #909399;
  margin-bottom: 4px;
}
.stat-card-value {
  font-size: 22px;
  font-weight: 700;
  color: #303133;
}
</style>
`
}

function generateStatCardsTemplate(cards: StatCard[]): string {
  const colorMap: Record<string, string> = {
    blue: "#409eff",
    green: "#67c23a",
    orange: "#e6a23c",
    red: "#f56c6c",
    purple: "#9b59b6",
    cyan: "#00bcd4"
  }

  const cardItems = cards.map(card => {
    const color = colorMap[card.color || "blue"]
    return `    <div class="stat-card">
      <div class="stat-card-icon" :style="{ background: '${color}20', color: '${color}' }">
        ${card.icon || "📊"}
      </div>
      <div>
        <div class="stat-card-title">${card.title}</div>
        <div class="stat-card-value">{{ typeof statData.${card.prop} === 'number' ? statData.${card.prop}.toLocaleString() : statData.${card.prop} }}${card.suffix ? `<span class="stat-card-suffix">${card.suffix}</span>` : ''}</div>
        <div v-if="statTrend.${card.prop}" class="stat-card-trend" :class="statTrend.${card.prop}.startsWith('-') ? 'down' : 'up'">{{ statTrend.${card.prop} }}</div>
      </div>
    </div>`
  }).join("\n")

  return `  <div class="stat-cards">
${cardItems}
  </div>
`
}

function generateSearchFormTemplate(fields: SearchFormField[]): string {
  const formItems = fields.map(field => {
    if (field.type === "select") {
      const options = (field.options || []).map(
        opt => `        <el-option label="${opt}" value="${opt}" />`
      ).join("\n")
      return `      <el-form-item label="${field.label}">
        <el-select v-model="searchForm.${field.prop}" placeholder="请选择" clearable>
${options}
        </el-select>
      </el-form-item>`
    }
    if (field.type === "date") {
      return `      <el-form-item label="${field.label}">
        <el-date-picker v-model="searchForm.${field.prop}" type="date" placeholder="选择日期" />
      </el-form-item>`
    }
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
    </el-form>
`
}

function generateTableTemplate(columns: TableColumn[]): string {
  const columnItems = columns.map(col => {
    const widthAttr = col.width ? ` width="${col.width}"` : ""
    return `      <el-table-column prop="${col.prop}" label="${col.label}"${widthAttr} />`
  }).join("\n")

  return `  <el-table :data="tableData" border stripe>
    <el-table-column type="index" label="序号" width="60" align="center" />
${columnItems}
    <el-table-column label="操作" width="180" align="center">
      <template #default>
        <el-button type="primary" link size="small">编辑</el-button>
        <el-button type="danger" link size="small">删除</el-button>
      </template>
    </el-table-column>
  </el-table>
`
}

function generateFormTemplate(fields: FormField[]): string {
  const formItems = fields.map(field => {
    const requiredAttr = field.required ? " required" : ""
    let inputTemplate = ""

    switch (field.type) {
      case "select":
        const options = (field.options || []).map(
          opt => `          <el-option label="${opt}" value="${opt}" />`
        ).join("\n")
        inputTemplate = `        <el-select v-model="formModel.${field.prop}" placeholder="${field.placeholder || "请选择"}">
${options}
        </el-select>`
        break
      case "date":
        inputTemplate = `        <el-date-picker v-model="formModel.${field.prop}" type="date" placeholder="${field.placeholder || "选择日期"}" />`
        break
      case "textarea":
        inputTemplate = `        <el-input v-model="formModel.${field.prop}" type="textarea" :rows="3" placeholder="${field.placeholder || `请输入${field.label}`}" />`
        break
      case "number":
        inputTemplate = `        <el-input-number v-model="formModel.${field.prop}" placeholder="${field.placeholder || `请输入${field.label}`}" />`
        break
      default:
        inputTemplate = `        <el-input v-model="formModel.${field.prop}" placeholder="${field.placeholder || `请输入${field.label}`}" />`
    }

    return `      <el-form-item label="${field.label}"${requiredAttr}>
${inputTemplate}
      </el-form-item>`
  }).join("\n")

  return `  <el-form :model="formModel" label-width="100px" style="max-width: 600px">
${formItems}
      <el-form-item>
        <el-button type="primary" @click="handleSubmit">提交</el-button>
        <el-button @click="handleFormReset">重置</el-button>
      </el-form-item>
    </el-form>
`
}

function toPascalCase(str: string): string {
  return str
    .replace(/[\u4e00-\u9fa5]/g, "")
    .replace(/[^a-zA-Z0-9]/g, " ")
    .split(" ")
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join("") || "Page"
}

function toKebabCase(str: string): string {
  return str
    .replace(/[\u4e00-\u9fa5]/g, "")
    .replace(/([A-Z])/g, "-$1")
    .replace(/[^a-zA-Z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase() || "page"
}

export function generateProjectCode(project: ProjectSchema): Record<string, string> {
  const files: Record<string, string> = {}

  for (const page of project.pages) {
    const componentName = toPascalCase(page.pageName)
    const fileName = toKebabCase(page.pageName)
    files[`src/views/${fileName}/index.vue`] = generateVueCode(page)
  }

  const imports = project.pages.map(page => {
    const componentName = toPascalCase(page.pageName)
    const fileName = toKebabCase(page.pageName)
    return `import ${componentName} from "@/views/${fileName}/index.vue"`
  }).join("\n")

  const routes = project.pages.map((page, index) => {
    const componentName = toPascalCase(page.pageName)
    const fileName = toKebabCase(page.pageName)
    const path = index === 0 ? "/" : `/${fileName}`
    return `  { path: "${path}", name: "${componentName}", component: ${componentName}, meta: { title: "${page.pageName}" } }`
  }).join(",\n")

  const menuItems = project.pages.map(page => {
    const fileName = toKebabCase(page.pageName)
    const path = project.pages.indexOf(page) === 0 ? "/" : `/${fileName}`
    return `      <el-menu-item index="${path}">${page.pageName}</el-menu-item>`
  }).join("\n")

  files["src/router.ts"] = `import { createRouter, createWebHistory } from "vue-router"
${imports}

const routes = [
${routes}
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
`

  files["src/App.vue"] = `<template>
  <el-container style="height: 100vh">
    <el-aside width="200px" style="background: #304156">
      <div style="padding: 20px; color: #fff; font-size: 16px; font-weight: bold; text-align: center">
        ${project.projectName}
      </div>
      <el-menu
        :default-active="$route.path"
        router
        background-color="#304156"
        text-color="#bfcbd9"
        active-text-color="#409eff"
      >
${menuItems}
      </el-menu>
    </el-aside>
    <el-main>
      <router-view />
    </el-main>
  </el-container>
</template>
`

  files["src/main.ts"] = `import { createApp } from "vue"
import ElementPlus from "element-plus"
import "element-plus/dist/index.css"
import App from "./App.vue"
import router from "./router"

const app = createApp(App)
app.use(ElementPlus)
app.use(router)
app.mount("#app")
`

  return files
}
