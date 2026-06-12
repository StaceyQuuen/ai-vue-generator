<script setup lang="ts">
import { ref, computed } from "vue"
import { generatePageStream } from "./api"
import { generateVueCode } from "./generator/generateVueCode"
import { generateMockData } from "./mock/generateMockData"
import type { PageSchema, TableComponent } from "./types/schema"
import SearchForm from "./renderer/SearchForm.vue"
import DataTable from "./renderer/DataTable.vue"
import PagePagination from "./renderer/PagePagination.vue"
import { ElMessage } from "element-plus"

const prompt = ref("")
const loading = ref(false)
const pageSchema = ref<PageSchema | null>(null)
const showCode = ref(false)
const currentPage = ref(1)
const errorMsg = ref("")
const streamingContent = ref("")

const generatedCode = computed(() =>
  pageSchema.value
    ? generateVueCode(pageSchema.value)
    : ""
)

function getTableMockData(comp: TableComponent): Record<string, any>[] {
  return generateMockData(comp.columns, 10)
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

  await generatePageStream(prompt.value, {
    onToken(token, fullContent) {
      streamingContent.value = fullContent
    },
    onDone(result) {
      loading.value = false
      streamingContent.value = ""

      if (result.success && result.data?.pageName) {
        pageSchema.value = result.data
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
</script>

<template>
  <div class="app-container">
    <header class="app-header">
      <h1>🤖 AI Vue 页面生成器</h1>
      <p>描述你想要的页面，AI 帮你生成</p>
    </header>

    <div class="input-section">
      <el-input
        v-model="prompt"
        type="textarea"
        :rows="4"
        placeholder="例如：用户管理页面，包含姓名搜索、手机号搜索、用户列表、分页"
      />
      <el-button
        type="primary"
        :loading="loading"
        @click="handleGenerate"
        style="margin-top: 12px; width: 100%"
      >
        {{ loading ? "AI 生成中..." : "生成页面" }}
      </el-button>
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
        <h2>{{ pageSchema.pageName }}</h2>
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
      </div>

      <div v-if="!showCode" class="preview-area">
        <template v-for="(comp, index) in pageSchema.components" :key="index">
          <SearchForm
            v-if="comp.type === 'searchForm'"
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
        </template>
      </div>

      <div v-else class="code-area">
        <pre>{{ generatedCode }}</pre>
      </div>
    </div>
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
}

.result-header h2 {
  margin: 0;
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
</style>
