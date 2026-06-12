<script setup lang="ts">
import { ref, computed, watch } from "vue"

export interface ThemeConfig {
  primaryColor: string
  borderRadius: number
  fontSize: number
  layoutBg: string
  cardBg: string
}

const props = defineProps<{
  modelValue: ThemeConfig
}>()

const emit = defineEmits<{
  (e: "update:modelValue", value: ThemeConfig): void
}>()

const localConfig = ref<ThemeConfig>({ ...props.modelValue })

watch(() => props.modelValue, (val) => {
  localConfig.value = { ...val }
}, { deep: true })

function updateConfig() {
  emit("update:modelValue", { ...localConfig.value })
}

const presetThemes = [
  { name: "默认蓝", primaryColor: "#409eff", borderRadius: 4, layoutBg: "#f5f7fa", cardBg: "#ffffff" },
  { name: "翠绿", primaryColor: "#67c23a", borderRadius: 8, layoutBg: "#f0f9eb", cardBg: "#ffffff" },
  { name: "活力橙", primaryColor: "#e6a23c", borderRadius: 6, layoutBg: "#fdf6ec", cardBg: "#ffffff" },
  { name: "暗夜", primaryColor: "#409eff", borderRadius: 4, layoutBg: "#1a1a2e", cardBg: "#16213e" },
  { name: "极简", primaryColor: "#333333", borderRadius: 2, layoutBg: "#fafafa", cardBg: "#ffffff" }
]

function applyPreset(preset: typeof presetThemes[0]) {
  localConfig.value.primaryColor = preset.primaryColor
  localConfig.value.borderRadius = preset.borderRadius
  localConfig.value.layoutBg = preset.layoutBg
  localConfig.value.cardBg = preset.cardBg
  updateConfig()
}

const cssVars = computed(() => ({
  "--el-color-primary": localConfig.value.primaryColor,
  "--preview-border-radius": localConfig.value.borderRadius + "px",
  "--preview-font-size": localConfig.value.fontSize + "px",
  "--preview-layout-bg": localConfig.value.layoutBg,
  "--preview-card-bg": localConfig.value.cardBg
}))
</script>

<template>
  <div class="theme-config">
    <div class="config-header">
      <h3>🎨 主题配置</h3>
    </div>

    <div class="config-section">
      <div class="section-label">预设主题</div>
      <div class="preset-grid">
        <div
          v-for="preset in presetThemes"
          :key="preset.name"
          class="preset-card"
          @click="applyPreset(preset)"
        >
          <div class="preset-colors">
            <span class="preset-dot" :style="{ background: preset.primaryColor }" />
            <span class="preset-dot" :style="{ background: preset.layoutBg, border: '1px solid #ddd' }" />
            <span class="preset-dot" :style="{ background: preset.cardBg, border: '1px solid #ddd' }" />
          </div>
          <span class="preset-name">{{ preset.name }}</span>
        </div>
      </div>
    </div>

    <div class="config-section">
      <div class="section-label">自定义</div>
      <el-form label-width="80px" size="small">
        <el-form-item label="主色调">
          <el-color-picker v-model="localConfig.primaryColor" @change="updateConfig" />
        </el-form-item>
        <el-form-item label="圆角">
          <el-slider v-model="localConfig.borderRadius" :min="0" :max="20" @change="updateConfig" />
        </el-form-item>
        <el-form-item label="背景色">
          <el-color-picker v-model="localConfig.layoutBg" @change="updateConfig" />
        </el-form-item>
        <el-form-item label="卡片背景">
          <el-color-picker v-model="localConfig.cardBg" @change="updateConfig" />
        </el-form-item>
      </el-form>
    </div>
  </div>
</template>

<style scoped>
.theme-config {
  padding: 0;
}

.config-header {
  margin-bottom: 12px;
}

.config-header h3 {
  margin: 0;
  font-size: 16px;
}

.config-section {
  margin-bottom: 16px;
  padding: 12px;
  background: #f5f7fa;
  border-radius: 6px;
}

.section-label {
  font-weight: 600;
  font-size: 13px;
  margin-bottom: 8px;
}

.preset-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.preset-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px 12px;
  border: 1px solid #ebeef5;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
}

.preset-card:hover {
  border-color: #409eff;
  background: #f0f7ff;
}

.preset-colors {
  display: flex;
  gap: 4px;
}

.preset-dot {
  width: 16px;
  height: 16px;
  border-radius: 50%;
}

.preset-name {
  font-size: 12px;
  color: #606266;
}
</style>
