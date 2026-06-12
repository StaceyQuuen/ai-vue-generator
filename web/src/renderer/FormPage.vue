<script setup lang="ts">
import { reactive } from "vue"
import type { FormField } from "@/types/schema"

defineProps<{
  fields: FormField[]
}>()

const formModel = reactive<Record<string, any>>({})
</script>

<template>
  <el-form
    :model="formModel"
    label-width="100px"
    style="max-width: 600px"
  >
    <el-form-item
      v-for="field in fields"
      :key="field.prop"
      :label="field.label"
      :required="field.required"
    >
      <el-select
        v-if="field.type === 'select'"
        v-model="formModel[field.prop]"
        :placeholder="field.placeholder || '请选择'"
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
        :placeholder="field.placeholder || '选择日期'"
      />
      <el-input
        v-else-if="field.type === 'textarea'"
        v-model="formModel[field.prop]"
        type="textarea"
        :rows="3"
        :placeholder="field.placeholder || `请输入${field.label}`"
      />
      <el-input-number
        v-else-if="field.type === 'number'"
        v-model="formModel[field.prop]"
        :placeholder="field.placeholder || `请输入${field.label}`"
      />
      <el-input
        v-else
        v-model="formModel[field.prop]"
        :placeholder="field.placeholder || `请输入${field.label}`"
      />
    </el-form-item>

    <el-form-item>
      <el-button type="primary">提交</el-button>
      <el-button>重置</el-button>
    </el-form-item>
  </el-form>
</template>
