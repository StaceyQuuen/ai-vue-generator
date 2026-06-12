<script setup lang="ts">
import { ref, watch, computed } from "vue"
import type { PageSchema } from "../types/schema"
import { generatePreviewHtml } from "../utils/exportProject"

const props = defineProps<{
  schema: PageSchema
}>()

const iframeRef = ref<HTMLIFrameElement | null>(null)

const previewHtml = computed(() => generatePreviewHtml(props.schema))

watch(previewHtml, () => {
  renderPreview()
}, { immediate: false })

function renderPreview() {
  if (!iframeRef.value) return
  const doc = iframeRef.value.contentDocument
  if (!doc) return
  doc.open()
  doc.write(previewHtml.value)
  doc.close()
}

function handleIframeLoad() {
  renderPreview()
}
</script>

<template>
  <div class="preview-sandbox">
    <div class="sandbox-header">
      <span>🖥️ 实时预览（独立沙箱）</span>
    </div>
    <iframe
      ref="iframeRef"
      class="sandbox-iframe"
      sandbox="allow-scripts allow-same-origin"
      @load="handleIframeLoad"
    />
  </div>
</template>

<style scoped>
.preview-sandbox {
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  overflow: hidden;
  background: #fff;
}

.sandbox-header {
  padding: 8px 12px;
  background: #f5f7fa;
  border-bottom: 1px solid #ebeef5;
  font-size: 13px;
  font-weight: 600;
  color: #606266;
}

.sandbox-iframe {
  width: 100%;
  height: 500px;
  border: none;
}
</style>
