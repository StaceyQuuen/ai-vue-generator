<script setup lang="ts">
import { reactive } from "vue"
import type { SearchFormField } from "@/types/schema"

defineProps<{
  fields: SearchFormField[]
}>()

const formModel = reactive<Record<string, any>>({})
</script>

<template>
  <el-form inline>
    <el-form-item
      v-for="field in fields"
      :key="field.prop"
      :label="field.label"
    >
      <el-select
        v-if="field.type === 'select'"
        v-model="formModel[field.prop]"
        placeholder="请选择"
      >
        <el-option
          v-for="opt in field.options"
          :key="opt"
          :label="opt"
          :value="opt"
        />
      </el-select>
      <el-date-picker
        v-else-if="field.type === 'date'"
        v-model="formModel[field.prop]"
        type="date"
        placeholder="选择日期"
      />
      <el-input
        v-else
        v-model="formModel[field.prop]"
        :placeholder="`请输入${field.label}`"
      />
    </el-form-item>

    <el-form-item>
      <el-button type="primary">查询</el-button>
      <el-button>重置</el-button>
    </el-form-item>
  </el-form>
</template>
