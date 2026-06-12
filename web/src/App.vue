<script setup lang="ts">
import { ref, computed } from "vue"
import { generatePage } from "./api"
import { generateVueCode } from "./generator/generateVueCode"
import type { PageSchema } from "./types/schema"
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
const debugInfo = ref("")

const generatedCode = computed(() =>
  pageSchema.value
    ? generateVueCode(pageSchema.value)
    : ""
)

async function handleGenerate() {
  if (!prompt.value.trim()) {
    ElMessage.warning("请输入页面描述")
    return
  }

  loading.value = true
  pageSchema.value = null
  errorMsg.value = ""
  debugInfo.value = "正在请求后端..."

  try {
    const res = await generatePage(prompt.value)
    debugInfo.value = `API响应: success=${res.success}, data=${JSON.stringify(res.data).substring(0, 200)}`

    if (res.success && res.data?.pageName) {
      pageSchema.value = res.data
      ElMessage.success("页面生成成功！")
    } else if (res.success && res.data?.raw) {
      errorMsg.value = "AI 返回的数据格式不正确，无法解析为页面 Schema"
      debugInfo.value += `\n原始内容: ${res.data.raw.substring(0, 200)}`
      ElMessage.error(errorMsg.value)
    } else {
      errorMsg.value = res.error || "生成失败，请重试"
      debugInfo.value += `\n错误: ${JSON.stringify(res)}`
      ElMessage.error(errorMsg.value)
    }
  } catch (err: any) {
    errorMsg.value = err.message || "网络错误，请检查后端服务是否启动"
    debugInfo.value = `异常: ${err.message}`
    ElMessage.error(errorMsg.value)
  } finally {
    loading.value = false
  }
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

    <div v-if="debugInfo && !pageSchema" class="debug-section">
      <el-alert type="info" :closable="false">
        <template #title>
          <pre style="margin:0; white-space: pre-wrap; font-size: 12px;">{{ debugInfo }}</pre>
        </template>
      </el-alert>
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
            :data="[]"
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

.debug-section {
  margin-bottom: 16px;
}
</style>
