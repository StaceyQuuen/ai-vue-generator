<script setup lang="ts">
import type { StatCard } from "@/types/schema"

defineProps<{
  cards: StatCard[]
}>()

const colorMap: Record<string, string> = {
  blue: "#409eff",
  green: "#67c23a",
  orange: "#e6a23c",
  red: "#f56c6c",
  purple: "#9b59b6",
  cyan: "#00bcd4"
}
</script>

<template>
  <div class="stat-cards">
    <div
      v-for="card in cards"
      :key="card.prop"
      class="stat-card"
    >
      <div
        class="stat-card-icon"
        :style="{ background: colorMap[card.color || 'blue'] + '20', color: colorMap[card.color || 'blue'] }"
      >
        {{ card.icon || "📊" }}
      </div>
      <div class="stat-card-info">
        <div class="stat-card-title">{{ card.title }}</div>
        <div class="stat-card-value">
          {{ card.value !== undefined ? (typeof card.value === 'number' ? card.value.toLocaleString() : card.value) : '—' }}
          <span v-if="card.suffix" class="stat-card-suffix">{{ card.suffix }}</span>
        </div>
        <div v-if="card.trend" class="stat-card-trend" :class="card.trend.startsWith('-') ? 'down' : 'up'">
          {{ card.trend }}
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
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
  transition: box-shadow 0.2s;
}

.stat-card:hover {
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}

.stat-card-icon {
  width: 48px;
  height: 48px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
  flex-shrink: 0;
}

.stat-card-info {
  flex: 1;
  min-width: 0;
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

.stat-card-suffix {
  font-size: 14px;
  font-weight: 400;
  color: #909399;
  margin-left: 2px;
}

.stat-card-trend {
  font-size: 12px;
  margin-top: 2px;
}

.stat-card-trend.up {
  color: #67c23a;
}

.stat-card-trend.down {
  color: #f56c6c;
}
</style>
