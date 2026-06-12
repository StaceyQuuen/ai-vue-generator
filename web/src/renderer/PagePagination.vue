<script setup lang="ts">

const page =
  defineModel<number>(
    "currentPage"
  )

</script>

<template>
  <el-pagination
    v-model:current-page="page"
    :total="100"
    layout="
      total,
      prev,
      pager,
      next
    "
  />
</template>