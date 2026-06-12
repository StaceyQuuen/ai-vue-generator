import type { PageSchema, SearchFormField, TableColumn } from "../types/schema"

export function generateVueCode(schema: PageSchema): string {
  let template = ""

  for (const component of schema.components) {
    switch (component.type) {
      case "searchForm":
        template += generateSearchFormTemplate(component.fields)
        break
      case "table":
        template += generateTableTemplate(component.columns)
        break
      case "pagination":
        template += `<el-pagination
  v-model:current-page="currentPage"
  v-model:page-size="pageSize"
  :total="${component.total || 100}"
  layout="total, prev, pager, next, jumper"
  style="margin-top: 16px; justify-content: flex-end"
/>
`
        break
    }
  }

  return `<template>
  <div class="page-container">
    <h2 class="page-title">${schema.pageName}</h2>
${template}
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from "vue"

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
</script>

<style scoped>
.page-container {
  padding: 20px;
}
.page-title {
  margin: 0 0 20px;
  font-size: 20px;
}
</style>
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
