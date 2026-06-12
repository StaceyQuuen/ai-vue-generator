<script setup lang="ts">
import type { TableColumn } from "@/types/schema"

defineProps<{
  columns: TableColumn[]
  data: any[]
}>()
</script>

<template>
  <el-table :data="data" border stripe style="width: 100%">
    <el-table-column
      type="index"
      label="序号"
      width="60"
      align="center"
    />
    <el-table-column
      v-for="column in columns"
      :key="column.prop"
      :prop="column.prop"
      :label="column.label"
      :width="column.width"
    />
    <el-table-column
      label="操作"
      width="180"
      align="center"
    >
      <template #default>
        <el-button type="primary" link size="small">编辑</el-button>
        <el-button type="danger" link size="small">删除</el-button>
      </template>
    </el-table-column>
  </el-table>
</template>
