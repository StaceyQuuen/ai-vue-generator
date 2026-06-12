<script setup lang="ts">
import { ref, watch, computed } from "vue"
import type { PageSchema, PageComponent, SearchFormField, TableColumn, StatCard, FormField } from "../types/schema"
import { ElMessage } from "element-plus"

const props = defineProps<{
  schema: PageSchema
}>()

const emit = defineEmits<{
  (e: "update:schema", value: PageSchema): void
}>()

const localSchema = ref<PageSchema>(JSON.parse(JSON.stringify(props.schema)))

watch(() => props.schema, (val) => {
  localSchema.value = JSON.parse(JSON.stringify(val))
}, { deep: true })

const pageName = computed({
  get: () => localSchema.value.pageName,
  set: (v) => { localSchema.value.pageName = v; emitUpdate() }
})

const pageType = computed({
  get: () => localSchema.value.pageType || "list",
  set: (v) => { localSchema.value.pageType = v as any; emitUpdate() }
})

function emitUpdate() {
  emit("update:schema", JSON.parse(JSON.stringify(localSchema.value)))
}

function findComponent<T extends PageComponent>(type: string): T | undefined {
  return localSchema.value.components.find(c => c.type === type) as T | undefined
}

function getOrCreateSearchForm(): { type: "searchForm"; fields: SearchFormField[] } {
  let comp = findComponent<{ type: "searchForm"; fields: SearchFormField[] }>("searchForm")
  if (!comp) {
    comp = { type: "searchForm", fields: [] }
    localSchema.value.components.push(comp)
  }
  return comp
}

function getOrCreateTable(): { type: "table"; columns: TableColumn[] } {
  let comp = findComponent<{ type: "table"; columns: TableColumn[] }>("table")
  if (!comp) {
    comp = { type: "table", columns: [] }
    localSchema.value.components.push(comp)
  }
  return comp
}

function getOrCreateStatCards(): { type: "statCards"; cards: StatCard[] } {
  let comp = findComponent<{ type: "statCards"; cards: StatCard[] }>("statCards")
  if (!comp) {
    comp = { type: "statCards", cards: [] }
    localSchema.value.components.push(comp)
  }
  return comp
}

function getOrCreateForm(): { type: "form"; fields: FormField[] } {
  let comp = findComponent<{ type: "form"; fields: FormField[] }>("form")
  if (!comp) {
    comp = { type: "form", fields: [] }
    localSchema.value.components.push(comp)
  }
  return comp
}

const searchForm = computed(() => findComponent<{ type: "searchForm"; fields: SearchFormField[] }>("searchForm"))
const table = computed(() => findComponent<{ type: "table"; columns: TableColumn[] }>("table"))
const statCards = computed(() => findComponent<{ type: "statCards"; cards: StatCard[] }>("statCards"))
const formComp = computed(() => findComponent<{ type: "form"; fields: FormField[] }>("form"))
const pagination = computed(() => findComponent<{ type: "pagination"; total?: number }>("pagination"))

function addSearchField() {
  const comp = getOrCreateSearchForm()
  comp.fields.push({ label: "新字段", prop: "newField", type: "input" })
  emitUpdate()
}

function removeSearchField(index: number) {
  searchForm.value?.fields.splice(index, 1)
  emitUpdate()
}

function addTableColumn() {
  const comp = getOrCreateTable()
  comp.columns.push({ label: "新列", prop: "newColumn" })
  emitUpdate()
}

function removeTableColumn(index: number) {
  table.value?.columns.splice(index, 1)
  emitUpdate()
}

function addStatCard() {
  const comp = getOrCreateStatCards()
  comp.cards.push({ title: "新指标", prop: "newStat", icon: "📊", color: "blue" })
  emitUpdate()
}

function removeStatCard(index: number) {
  statCards.value?.cards.splice(index, 1)
  emitUpdate()
}

function addFormField() {
  const comp = getOrCreateForm()
  comp.fields.push({ label: "新字段", prop: "newField", type: "input" })
  emitUpdate()
}

function removeFormField(index: number) {
  formComp.value?.fields.splice(index, 1)
  emitUpdate()
}

function toggleComponent(type: string, enable: boolean) {
  const idx = localSchema.value.components.findIndex(c => c.type === type)
  if (enable && idx === -1) {
    if (type === "searchForm") getOrCreateSearchForm()
    else if (type === "table") getOrCreateTable()
    else if (type === "statCards") getOrCreateStatCards()
    else if (type === "form") getOrCreateForm()
    else if (type === "pagination") {
      localSchema.value.components.push({ type: "pagination", total: 100 })
    }
  } else if (!enable && idx !== -1) {
    localSchema.value.components.splice(idx, 1)
  }
  emitUpdate()
}

function hasComponent(type: string): boolean {
  return localSchema.value.components.some(c => c.type === type)
}

function handleExportSchema() {
  const json = JSON.stringify(localSchema.value, null, 2)
  navigator.clipboard.writeText(json).then(() => {
    ElMessage.success("Schema JSON 已复制到剪贴板")
  }).catch(() => {
    ElMessage.error("复制失败")
  })
}

const importJson = ref("")
const showImport = ref(false)

function handleImportSchema() {
  try {
    const parsed = JSON.parse(importJson.value)
    if (parsed.pageName && parsed.components) {
      localSchema.value = parsed
      emitUpdate()
      showImport.value = false
      importJson.value = ""
      ElMessage.success("Schema 导入成功")
    } else {
      ElMessage.error("JSON 格式不正确，需要 pageName 和 components 字段")
    }
  } catch {
    ElMessage.error("JSON 解析失败，请检查格式")
  }
}

const colorOptions = ["blue", "green", "orange", "red", "purple", "cyan"]
const iconOptions = ["📊", "👥", "📦", "💰", "📈", "🖥️", "⏰", "🔔", "💼", "🎯"]
</script>

<template>
  <div class="schema-editor">
    <div class="editor-header">
      <h3>🔧 Schema 编辑器</h3>
      <div class="editor-actions">
        <el-button size="small" @click="showImport = true">📥 导入</el-button>
        <el-button size="small" type="success" @click="handleExportSchema">📤 导出</el-button>
      </div>
    </div>

    <div class="editor-section">
      <div class="section-title">基本信息</div>
      <el-form label-width="80px" size="small">
        <el-form-item label="页面名称">
          <el-input v-model="pageName" @change="emitUpdate" />
        </el-form-item>
        <el-form-item label="页面类型">
          <el-select v-model="pageType" @change="emitUpdate">
            <el-option label="列表页" value="list" />
            <el-option label="表单页" value="form" />
            <el-option label="仪表盘" value="dashboard" />
          </el-select>
        </el-form-item>
      </el-form>
    </div>

    <div class="editor-section">
      <div class="section-title">
        组件开关
      </div>
      <div class="component-toggles">
        <el-checkbox
          :model-value="hasComponent('statCards')"
          @change="(v: boolean) => toggleComponent('statCards', v)"
        >
          📊 统计卡片
        </el-checkbox>
        <el-checkbox
          :model-value="hasComponent('searchForm')"
          @change="(v: boolean) => toggleComponent('searchForm', v)"
        >
          🔍 搜索表单
        </el-checkbox>
        <el-checkbox
          :model-value="hasComponent('table')"
          @change="(v: boolean) => toggleComponent('table', v)"
        >
          📋 数据表格
        </el-checkbox>
        <el-checkbox
          :model-value="hasComponent('pagination')"
          @change="(v: boolean) => toggleComponent('pagination', v)"
        >
          📄 分页
        </el-checkbox>
        <el-checkbox
          :model-value="hasComponent('form')"
          @change="(v: boolean) => toggleComponent('form', v)"
        >
          📝 表单
        </el-checkbox>
      </div>
    </div>

    <div v-if="statCards" class="editor-section">
      <div class="section-title">
        📊 统计卡片
        <el-button size="small" type="primary" link @click="addStatCard">+ 添加</el-button>
      </div>
      <div v-for="(card, idx) in statCards.cards" :key="idx" class="edit-item">
        <el-input v-model="card.title" placeholder="标题" size="small" @change="emitUpdate" />
        <el-input v-model="card.prop" placeholder="字段名" size="small" @change="emitUpdate" />
        <el-select v-model="card.icon" size="small" @change="emitUpdate">
          <el-option v-for="ic in iconOptions" :key="ic" :label="ic" :value="ic" />
        </el-select>
        <el-select v-model="card.color" size="small" @change="emitUpdate">
          <el-option v-for="c in colorOptions" :key="c" :label="c" :value="c" />
        </el-select>
        <el-button size="small" type="danger" link @click="removeStatCard(idx)">✕</el-button>
      </div>
    </div>

    <div v-if="searchForm" class="editor-section">
      <div class="section-title">
        🔍 搜索表单
        <el-button size="small" type="primary" link @click="addSearchField">+ 添加</el-button>
      </div>
      <div v-for="(field, idx) in searchForm.fields" :key="idx" class="edit-item">
        <el-input v-model="field.label" placeholder="标签" size="small" @change="emitUpdate" />
        <el-input v-model="field.prop" placeholder="字段名" size="small" @change="emitUpdate" />
        <el-select v-model="field.type" size="small" @change="emitUpdate">
          <el-option label="输入框" value="input" />
          <el-option label="下拉选择" value="select" />
          <el-option label="日期" value="date" />
        </el-select>
        <el-button size="small" type="danger" link @click="removeSearchField(idx)">✕</el-button>
      </div>
    </div>

    <div v-if="table" class="editor-section">
      <div class="section-title">
        📋 数据表格
        <el-button size="small" type="primary" link @click="addTableColumn">+ 添加列</el-button>
      </div>
      <div v-for="(col, idx) in table.columns" :key="idx" class="edit-item">
        <el-input v-model="col.label" placeholder="列标题" size="small" @change="emitUpdate" />
        <el-input v-model="col.prop" placeholder="字段名" size="small" @change="emitUpdate" />
        <el-input-number v-model="col.width" placeholder="宽度" size="small" :min="0" @change="emitUpdate" />
        <el-button size="small" type="danger" link @click="removeTableColumn(idx)">✕</el-button>
      </div>
    </div>

    <div v-if="formComp" class="editor-section">
      <div class="section-title">
        📝 表单字段
        <el-button size="small" type="primary" link @click="addFormField">+ 添加</el-button>
      </div>
      <div v-for="(field, idx) in formComp.fields" :key="idx" class="edit-item">
        <el-input v-model="field.label" placeholder="标签" size="small" @change="emitUpdate" />
        <el-input v-model="field.prop" placeholder="字段名" size="small" @change="emitUpdate" />
        <el-select v-model="field.type" size="small" @change="emitUpdate">
          <el-option label="输入框" value="input" />
          <el-option label="下拉选择" value="select" />
          <el-option label="日期" value="date" />
          <el-option label="文本域" value="textarea" />
          <el-option label="数字" value="number" />
        </el-select>
        <el-checkbox v-model="field.required" @change="emitUpdate">必填</el-checkbox>
        <el-button size="small" type="danger" link @click="removeFormField(idx)">✕</el-button>
      </div>
    </div>

    <div v-if="pagination" class="editor-section">
      <div class="section-title">📄 分页</div>
      <el-form label-width="80px" size="small">
        <el-form-item label="总条数">
          <el-input-number v-model="pagination.total" :min="0" @change="emitUpdate" />
        </el-form-item>
      </el-form>
    </div>

    <el-dialog v-model="showImport" title="导入 Schema JSON" width="500px">
      <el-input
        v-model="importJson"
        type="textarea"
        :rows="10"
        placeholder='粘贴 Schema JSON，例如：{"pageName":"用户管理","pageType":"list","components":[...]}'
      />
      <template #footer>
        <el-button @click="showImport = false">取消</el-button>
        <el-button type="primary" @click="handleImportSchema">导入</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.schema-editor {
  padding: 0;
}

.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.editor-header h3 {
  margin: 0;
  font-size: 16px;
}

.editor-actions {
  display: flex;
  gap: 8px;
}

.editor-section {
  margin-bottom: 16px;
  padding: 12px;
  background: #f5f7fa;
  border-radius: 6px;
}

.section-title {
  font-weight: 600;
  font-size: 13px;
  margin-bottom: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.component-toggles {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.edit-item {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}

.edit-item .el-input {
  flex: 1;
  min-width: 80px;
}

.edit-item .el-select {
  width: 100px;
}

.edit-item .el-input-number {
  width: 90px;
}
</style>
