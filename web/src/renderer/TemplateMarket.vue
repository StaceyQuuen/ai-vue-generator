<script setup lang="ts">
import { ref, computed } from "vue"
import { getTemplates, saveAsTemplate, deleteTemplate, clearCustomTemplates } from "../store/templates"
import type { PageSchema, SchemaTemplate } from "../types/schema"
import { ElMessage, ElMessageBox } from "element-plus"

const props = defineProps<{
  currentSchema: PageSchema | null
}>()

const emit = defineEmits<{
  (e: "select", schema: PageSchema): void
}>()

const templates = ref<SchemaTemplate[]>(getTemplates())
const selectedCategory = ref("全部")
const showSaveDialog = ref(false)
const saveForm = ref({ name: "", icon: "📄", category: "自定义" })

const categories = computed(() => {
  const cats = new Set<string>()
  templates.value.forEach(t => cats.add(t.category))
  return ["全部", ...cats]
})

const filteredTemplates = computed(() => {
  if (selectedCategory.value === "全部") return templates.value
  return templates.value.filter(t => t.category === selectedCategory.value)
})

function handleSelect(tpl: SchemaTemplate) {
  emit("select", JSON.parse(JSON.stringify(tpl.schema)))
  ElMessage.success(`已加载「${tpl.name}」`)
}

function handleSave() {
  if (!props.currentSchema) {
    ElMessage.warning("请先生成页面")
    return
  }
  if (!saveForm.value.name.trim()) {
    ElMessage.warning("请输入模板名称")
    return
  }
  saveAsTemplate(
    saveForm.value.name,
    saveForm.value.icon,
    saveForm.value.category,
    props.currentSchema
  )
  templates.value = getTemplates()
  showSaveDialog.value = false
  saveForm.value = { name: "", icon: "📄", category: "自定义" }
  ElMessage.success("模板保存成功")
}

function handleDelete(id: string) {
  deleteTemplate(id)
  templates.value = getTemplates()
  ElMessage.success("模板已删除")
}

function handleClearAll() {
  ElMessageBox.confirm("确定清空所有自定义模板？", "提示", {
    confirmButtonText: "确定",
    cancelButtonText: "取消",
    type: "warning"
  }).then(() => {
    clearCustomTemplates()
    templates.value = getTemplates()
    ElMessage.success("已清空自定义模板")
  }).catch(() => {})
}

const iconOptions = ["📄", "👤", "📦", "🛍️", "📝", "📊", "🖥️", "💼", "🎯", "🔧", "🏠", "⚙️"]
</script>

<template>
  <div class="template-market">
    <div class="market-header">
      <h3>🏪 模板市场</h3>
      <div class="market-actions">
        <el-button
          size="small"
          type="primary"
          :disabled="!currentSchema"
          @click="showSaveDialog = true"
        >
          💾 保存为模板
        </el-button>
        <el-button
          size="small"
          type="danger"
          @click="handleClearAll"
        >
          清空自定义
        </el-button>
      </div>
    </div>

    <div class="category-tabs">
      <el-button
        v-for="cat in categories"
        :key="cat"
        :type="selectedCategory === cat ? 'primary' : ''"
        size="small"
        @click="selectedCategory = cat"
      >
        {{ cat }}
      </el-button>
    </div>

    <div class="template-grid">
      <div
        v-for="tpl in filteredTemplates"
        :key="tpl.id"
        class="template-card"
        @click="handleSelect(tpl)"
      >
        <div class="template-icon">{{ tpl.icon }}</div>
        <div class="template-info">
          <div class="template-name">{{ tpl.name }}</div>
          <div class="template-meta">
            <el-tag size="small" :type="tpl.category === '列表页' ? 'info' : tpl.category === '表单页' ? 'success' : tpl.category === '仪表盘' ? 'warning' : ''">
              {{ tpl.category }}
            </el-tag>
            <el-tag v-if="tpl.isBuiltin" size="small" type="info">内置</el-tag>
            <el-tag v-else size="small" type="success">自定义</el-tag>
          </div>
        </div>
        <el-button
          v-if="!tpl.isBuiltin"
          type="danger"
          link
          size="small"
          @click.stop="handleDelete(tpl.id)"
        >
          删除
        </el-button>
      </div>
    </div>

    <div v-if="filteredTemplates.length === 0" class="empty-state">
      暂无模板
    </div>

    <el-dialog v-model="showSaveDialog" title="保存为模板" width="400px">
      <el-form label-position="top">
        <el-form-item label="模板名称">
          <el-input v-model="saveForm.name" placeholder="例如：我的用户管理页" />
        </el-form-item>
        <el-form-item label="图标">
          <div class="icon-picker">
            <span
              v-for="ic in iconOptions"
              :key="ic"
              :class="['icon-option', { active: saveForm.icon === ic }]"
              @click="saveForm.icon = ic"
            >
              {{ ic }}
            </span>
          </div>
        </el-form-item>
        <el-form-item label="分类">
          <el-select v-model="saveForm.category" allow-create filterable>
            <el-option label="自定义" value="自定义" />
            <el-option label="列表页" value="列表页" />
            <el-option label="表单页" value="表单页" />
            <el-option label="仪表盘" value="仪表盘" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showSaveDialog = false">取消</el-button>
        <el-button type="primary" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.template-market {
  padding: 0;
}

.market-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.market-header h3 {
  margin: 0;
  font-size: 16px;
}

.market-actions {
  display: flex;
  gap: 8px;
}

.category-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;
}

.template-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
}

.template-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.template-card:hover {
  border-color: #409eff;
  background: #f0f7ff;
}

.template-icon {
  font-size: 28px;
  flex-shrink: 0;
}

.template-info {
  flex: 1;
  min-width: 0;
}

.template-name {
  font-weight: 600;
  font-size: 14px;
  margin-bottom: 4px;
}

.template-meta {
  display: flex;
  gap: 4px;
}

.empty-state {
  text-align: center;
  color: #909399;
  padding: 40px 0;
}

.icon-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.icon-option {
  font-size: 24px;
  cursor: pointer;
  padding: 4px;
  border: 2px solid transparent;
  border-radius: 6px;
  transition: border-color 0.2s;
}

.icon-option:hover {
  border-color: #c0c4cc;
}

.icon-option.active {
  border-color: #409eff;
  background: #ecf5ff;
}
</style>
