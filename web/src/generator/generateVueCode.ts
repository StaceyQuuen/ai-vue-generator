import type { PageSchema } from "../types/schema";

export function generateVueCode(
  schema: PageSchema
) {
  let imports = []
  let template = ""

  for (
    const component
    of schema.components
  ) {
    switch (component.type) {
      case "searchForm":
        imports.push("SearchForm")
        template += `
<SearchForm
  :fields='${JSON.stringify(component.fields)}'
/>
`
        break

      case "table":
        imports.push("DataTable")
        template += `
<DataTable
  :columns='${JSON.stringify(component.columns)}'
  :data='tableData'
/>
`
        break

      case "pagination":
        imports.push("PagePagination")
        template += `
<PagePagination
  v-model:currentPage="page"
/>
`
        break
    }
  }

  return buildVueFile(imports, template)
}

function buildVueFile(
  imports: string[],
  template: string
) {
  const importCode = imports
    .map(name => `import ${name} from "@/renderer/${name}.vue"`)
    .join("\n")

  return `<template>
${template}
</template>

<script setup lang="ts">
import { ref } from "vue"
${importCode ? "\n" + importCode : ""}

const page = ref(1)
const tableData = ref([])
</script>
`
}
