<script setup lang="ts">
import type { TableColumn } from "@/types/schema"

defineProps<{
  columns: TableColumn[]
  data: any[]
}>()
</script>

<template>
  <el-table :data="data" border stripe>
    <el-table-column
      v-for="column in columns"
      :key="column.prop"
      :prop="column.prop"
      :label="column.label"
      :width="column.width"
    />
  </el-table>
</template>
