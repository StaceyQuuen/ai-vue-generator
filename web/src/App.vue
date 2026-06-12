<script setup lang="ts">
import { ref, computed } from "vue"
import { generatePageStream, iteratePageStream } from "./api"
import { generateVueCode } from "./generator/generateVueCode"
import { generateMockData } from "./mock/generateMockData"
import { promptTemplates } from "./config/promptTemplates"
import { getHistory, addHistory, deleteHistory, clearHistory } from "./store/history"
import { downloadFile } from "./utils/download"
import type { PageSchema, TableComponent, HistoryItem, ChatMessage } from "./types/schema"
import SearchForm from "./renderer/SearchForm.vue"
import DataTable from "./renderer/DataTable.vue"
import PagePagination from "./renderer/PagePagination.vue"
import StatCards from "./renderer/StatCards.vue"
import FormPage from "./renderer/FormPage.vue"
import { ElMessage, ElMessageBox } from "element-plus"

const prompt = ref("")
const loading = ref(false)
const pageSchema = ref<PageSchema | null>(null)
const showCode = ref(false)
const currentPage = ref(1)
const errorMsg = ref("")
const streamingContent = ref("")
const historyList = ref<HistoryItem[]>(getHistory())
const showHistory = ref(false)

const iterateInstruction = ref("")
const iterating = ref(false)
const chatMessages = ref<ChatMessage[]>([])

const generatedCode = computed(() =>
  pageSchema.value
    ? generateVueCode(pageSchema.value)
    : ""
)

const pageTypeLabel = computed(() => {
  const typeMap: Record<string, string> = {
    list: "列表页",
    form: "表单页",
    dashboard: "仪表盘"
  }
  return typeMap[pageSchema.value?.pageType || "list"] || "列表页"
})

function getTableMockData(comp: TableComponent): Record<string, any>[] {
  return generateMockData(comp.columns, 10)
}

function applyTemplate(tpl: typeof promptTemplates[0]) {
  prompt.value = tpl.prompt
}

function loadHistory(item: HistoryItem) {
  pageSchema.value = item.schema
  prompt.value = item.prompt
  chatMessages.value = []
  showHistory.value = false
  ElMessage.success("已加载历史记录")
}

function handleDeleteHistory(id: string) {
  deleteHistory(id)
  historyList.value = getHistory()
}

function handleClearHistory() {
  ElMessageBox.confirm("确定清空所有历史记录？", "提示", {
    confirmButtonText: "确定",
    cancelButtonText: "取消",
    type: "warning"
  }).then(() => {
    clearHistory()
    historyList.value = []
    ElMessage.success("已清空")
  }).catch(() => {})
}

function handleDownloadCode() {
  if (!pageSchema.value) return
  const fileName = `${pageSchema.value.pageName}.vue`
  downloadFile(fileName, generatedCode.value)
  ElMessage.success("代码已下载")
}

function handleCopyCode() {
  navigator.clipboard.writeText(generatedCode.value).then(() => {
    ElMessage.success("代码已复制到剪贴板")
  }).catch(() => {
    ElMessage.error("复制失败")
  })
}

async function handleGenerate() {
  if (!prompt.value.trim()) {
    ElMessage.warning("请输入页面描述")
    return
  }

  loading.value = true
  pageSchema.value = null
  errorMsg.value = ""
  streamingContent.value = ""
  chatMessages.value = []

  await generatePageStream(prompt.value, {
    onToken(token, fullContent) {
      streamingContent.value = fullContent
    },
    onDone(result) {
      loading.value = false
      streamingContent.value = ""

      if (result.success && result.data?.pageName) {
        pageSchema.value = result.data
        addHistory(prompt.value, result.data)
        historyList.value = getHistory()
        chatMessages.value.push(
          { role: "user", content: prompt.value },
          { role: "assistant", content: `已生成「${result.data.pageName}」${result.data.pageType === "form" ? "表单页" : result.data.pageType === "dashboard" ? "仪表盘" : "列表页"}` }
        )
        ElMessage.success("页面生成成功！")
      } else if (result.success && result.data?.raw) {
        errorMsg.value = "AI 返回的数据格式不正确"
        ElMessage.error(errorMsg.value)
      } else {
        errorMsg.value = result.error || "生成失败"
        ElMessage.error(errorMsg.value)
      }
    },
    onError(error) {
      loading.value = false
      streamingContent.value = ""
      errorMsg.value = error
      ElMessage.error(error)
    }
  })
}

async function handleIterate() {
  if (!iterateInstruction.value.trim() || !pageSchema.value) return

  iterating.value = true
  const instruction = iterateInstruction.value
  chatMessages.value.push(
    { role: "user", content: instruction }
  )
  iterateInstruction.value = ""

  await iteratePageStream(pageSchema.value, instruction, {
    onToken(token, fullContent) {
      streamingContent.value = fullContent
    },
    onDone(result) {
      iterating.value = false
      streamingContent.value = ""

      if (result.success && result.data?.pageName) {
        pageSchema.value = result.data
        addHistory(`迭代: ${instruction}`, result.data)
        historyList.value = getHistory()
        chatMessages.value.push(
          { role: "assistant", content: `已更新「${result.data.pageName}」` }
        )
        ElMessage.success("页面已更新！")
      } else {
        chatMessages.value.push(
          { role: "assistant", content: "修改失败，请重试" }
        )
        ElMessage.error("迭代修改失败")
      }
    },
    onError(error) {
      iterating.value = false
      streamingContent.value = ""
      chatMessages.value.push(
        { role: "assistant", content: `出错了: ${error}` }
      )
      ElMessage.error(error)
    }
  })
}
</script>

<template>
  <div class="app-container">
    <header class="app-header">
      <h1>🤖 AI Vue 页面生成器</h1>
      <p>描述你想要的页面，AI 帮你生成 · 支持对话式迭代优化</p>
    </header>

    <div class="input-section">
      <el-input
        v-model="prompt"
        type="textarea"
        :rows="4"
        placeholder="例如：用户管理页面，包含姓名搜索、手机号搜索、用户列表、分页"
      />

      <div class="template-section">
        <span class="template-label">快捷模板：</span>
        <el-button
          v-for="tpl in promptTemplates"
          :key="tpl.id"
          size="small"
          :type="tpl.pageType === 'form' ? 'success' : tpl.pageType === 'dashboard' ? 'warning' : ''"
          @click="applyTemplate(tpl)"
        >
          {{ tpl.icon }} {{ tpl.title }}
        </el-button>
      </div>

      <div class="action-bar">
        <el-button
          type="primary"
          :loading="loading"
          @click="handleGenerate"
          style="flex: 1"
        >
          {{ loading ? "AI 生成中..." : "🚀 生成页面" }}
        </el-button>
        <el-button @click="showHistory = true">
          📜 历史 ({{ historyList.length }})
        </el-button>
      </div>
    </div>

    <div v-if="errorMsg" class="error-section">
      <el-alert :title="errorMsg" type="error" show-icon />
    </div>

    <div v-if="streamingContent" class="streaming-section">
      <div class="streaming-header">
        <span class="streaming-dot"></span>
        AI 正在生成...
      </div>
      <pre class="streaming-content">{{ streamingContent }}</pre>
    </div>

    <div v-if="pageSchema" class="result-section">
      <div class="result-header">
        <div class="result-title">
          <h2>{{ pageSchema.pageName }}</h2>
          <el-tag size="small" :type="pageSchema.pageType === 'form' ? 'success' : pageSchema.pageType === 'dashboard' ? 'warning' : 'info'">
            {{ pageTypeLabel }}
          </el-tag>
        </div>
        <div class="result-actions">
          <el-button-group>
            <el-button
              :type="!showCode ? 'primary' : ''"
              @click="showCode = false"
            >
              预览
            </el-button>
            <el-button
              :type="showCode ? 'primary' : ''"
              @click="showCode = true"
            >
              代码
            </el-button>
          </el-button-group>
          <template v-if="showCode">
            <el-button type="success" size="small" @click="handleCopyCode">
              📋 复制
            </el-button>
            <el-button type="warning" size="small" @click="handleDownloadCode">
              ⬇️ 下载
            </el-button>
          </template>
        </div>
      </div>

      <div v-if="!showCode" class="preview-area">
        <template v-for="(comp, index) in pageSchema.components" :key="index">
          <StatCards
            v-if="comp.type === 'statCards'"
            :cards="comp.cards"
          />
          <SearchForm
            v-else-if="comp.type === 'searchForm'"
            :fields="comp.fields"
          />
          <DataTable
            v-else-if="comp.type === 'table'"
            :columns="comp.columns"
            :data="getTableMockData(comp)"
          />
          <PagePagination
            v-else-if="comp.type === 'pagination'"
            v-model:current-page="currentPage"
          />
          <FormPage
            v-else-if="comp.type === 'form'"
            :fields="comp.fields"
          />
        </template>
      </div>

      <div v-else class="code-area">
        <pre>{{ generatedCode }}</pre>
      </div>

      <div class="iterate-section">
        <div class="iterate-header">
          <span>💬 对话式迭代</span>
          <span class="iterate-hint">输入修改需求，AI 帮你调整页面</span>
        </div>
        <div class="chat-messages" v-if="chatMessages.length > 0">
          <div
            v-for="(msg, idx) in chatMessages"
            :key="idx"
            :class="['chat-message', msg.role]"
          >
            <span class="chat-avatar">{{ msg.role === 'user' ? '👤' : '🤖' }}</span>
            <span class="chat-text">{{ msg.content }}</span>
          </div>
        </div>
        <div class="iterate-input">
          <el-input
            v-model="iterateInstruction"
            placeholder="例如：增加一列「地址」、把状态改为下拉选择、添加统计卡片..."
            @keyup.enter="handleIterate"
          />
          <el-button
            type="primary"
            :loading="iterating"
            @click="handleIterate"
          >
            {{ iterating ? "修改中..." : "迭代" }}
          </el-button>
        </div>
      </div>
    </div>

    <el-drawer
      v-model="showHistory"
      title="生成历史"
      direction="rtl"
      size="380px"
    >
      <div class="history-toolbar">
        <el-button
          type="danger"
          size="small"
          :disabled="historyList.length === 0"
          @click="handleClearHistory"
        >
          清空全部
        </el-button>
      </div>
      <div v-if="historyList.length === 0" class="history-empty">
        暂无历史记录
      </div>
      <div
        v-for="item in historyList"
        :key="item.id"
        class="history-item"
        @click="loadHistory(item)"
      >
        <div class="history-item-header">
          <span class="history-item-name">{{ item.schema.pageName }}</span>
          <el-tag size="small" :type="item.schema.pageType === 'form' ? 'success' : item.schema.pageType === 'dashboard' ? 'warning' : 'info'">
            {{ item.schema.pageType === 'form' ? '表单' : item.schema.pageType === 'dashboard' ? '仪表盘' : '列表' }}
          </el-tag>
        </div>
        <div class="history-item-prompt">{{ item.prompt }}</div>
        <div class="history-item-time">
          {{ new Date(item.createdAt).toLocaleString("zh-CN") }}
        </div>
        <el-button
          type="danger"
          link
          size="small"
          @click.stop="handleDeleteHistory(item.id)"
          style="margin-top: 4px"
        >
          删除
        </el-button>
      </div>
    </el-drawer>
  </div>
</template>

<style scoped>
.app-container {
  max-width: 960px;
  margin: 0 auto;
  padding: 24px;
}

.app-header {
  text-align: center;
  margin-bottom: 32px;
}

.app-header h1 {
  font-size: 28px;
  margin-bottom: 8px;
}

.app-header p {
  color: #666;
}

.input-section {
  margin-bottom: 32px;
}

.template-section {
  margin-top: 12px;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.template-label {
  font-size: 13px;
  color: #909399;
  white-space: nowrap;
}

.action-bar {
  margin-top: 12px;
  display: flex;
  gap: 12px;
}

.streaming-section {
  margin-bottom: 24px;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  overflow: hidden;
}

.streaming-header {
  padding: 8px 16px;
  background: #f0f9eb;
  font-size: 13px;
  color: #67c23a;
  display: flex;
  align-items: center;
  gap: 8px;
}

.streaming-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #67c23a;
  animation: pulse 1.2s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.streaming-content {
  padding: 16px;
  margin: 0;
  background: #1e1e1e;
  color: #d4d4d4;
  font-family: 'Consolas', monospace;
  font-size: 13px;
  line-height: 1.6;
  max-height: 300px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-all;
}

.result-section {
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  padding: 20px;
}

.result-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 12px;
}

.result-title {
  display: flex;
  align-items: center;
  gap: 8px;
}

.result-title h2 {
  margin: 0;
}

.result-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.preview-area {
  padding: 16px;
  background: #fafafa;
  border-radius: 4px;
}

.code-area {
  background: #1e1e1e;
  color: #d4d4d4;
  padding: 16px;
  border-radius: 4px;
  overflow-x: auto;
}

.code-area pre {
  margin: 0;
  font-family: 'Consolas', monospace;
  font-size: 14px;
  line-height: 1.6;
}

.error-section {
  margin-bottom: 16px;
}

.iterate-section {
  margin-top: 20px;
  border-top: 1px solid #ebeef5;
  padding-top: 16px;
}

.iterate-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  font-weight: 600;
}

.iterate-hint {
  font-size: 12px;
  color: #909399;
  font-weight: 400;
}

.chat-messages {
  max-height: 200px;
  overflow-y: auto;
  margin-bottom: 12px;
  padding: 8px;
  background: #f5f7fa;
  border-radius: 8px;
}

.chat-message {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 8px;
  padding: 6px 10px;
  border-radius: 6px;
}

.chat-message.user {
  background: #ecf5ff;
}

.chat-message.assistant {
  background: #f0f9eb;
}

.chat-avatar {
  font-size: 16px;
  flex-shrink: 0;
}

.chat-text {
  font-size: 13px;
  line-height: 1.5;
  word-break: break-all;
}

.iterate-input {
  display: flex;
  gap: 8px;
}

.history-toolbar {
  margin-bottom: 16px;
}

.history-empty {
  text-align: center;
  color: #909399;
  padding: 40px 0;
}

.history-item {
  padding: 12px;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: border-color 0.2s;
}

.history-item:hover {
  border-color: #409eff;
}

.history-item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.history-item-name {
  font-weight: 600;
  font-size: 15px;
}

.history-item-prompt {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.history-item-time {
  font-size: 11px;
  color: #c0c4cc;
  margin-top: 4px;
}
</style>
