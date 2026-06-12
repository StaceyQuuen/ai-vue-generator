import type { PageSchema, SearchFormField, TableColumn, StatCard, FormField } from "../types/schema"

export function generateVueCode(schema: PageSchema): string {
  const pageType = schema.pageType || "list"
  let template = ""
  let scriptExtra = ""

  for (const component of schema.components) {
    switch (component.type) {
      case "statCards":
        template += generateStatCardsTemplate(component.cards)
        scriptExtra += `
const statData = reactive({
${component.cards.map(c => `  ${c.prop}: ${c.prop === "totalUsers" ? "12846" : c.prop === "totalOrders" ? "8432" : c.prop === "totalRevenue" ? "128460" : c.prop === "monthlyGrowth" ? "12.5" : c.prop === "todayVisits" ? "2846" : c.prop === "activeUsers" ? "1024" : c.prop === "pendingOrders" ? "23" : Math.floor(Math.random() * 10000)}`).join(",\n")}
})
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
        <div class="stat-card-value">{{ statData.${card.prop} }}</div>
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
