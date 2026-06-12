import JSZip from "jszip"
import type { ProjectSchema, PageSchema } from "../types/schema"
import { generateVueCode, generateProjectCode } from "../generator/generateVueCode"

function toPascalCase(str: string): string {
  return str
    .replace(/[\u4e00-\u9fa5]/g, "")
    .replace(/[^a-zA-Z0-9]/g, " ")
    .split(" ")
    .filter(Boolean)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join("") || "Page"
}

function toKebabCase(str: string): string {
  return str
    .replace(/[\u4e00-\u9fa5]/g, "")
    .replace(/([A-Z])/g, "-$1")
    .replace(/[^a-zA-Z0-9]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase() || "page"
}

function generatePackageJson(projectName: string): string {
  const safeName = toKebabCase(projectName) || "ai-generated-project"
  return JSON.stringify({
    name: safeName,
    version: "1.0.0",
    private: true,
    type: "module",
    scripts: {
      dev: "vite",
      build: "vue-tsc -b && vite build",
      preview: "vite preview"
    },
    dependencies: {
      vue: "^3.5.0",
      "element-plus": "^2.14.0",
      "@element-plus/icons-vue": "^2.3.2"
    },
    devDependencies: {
      "@vitejs/plugin-vue": "^6.0.0",
      typescript: "~6.0.0",
      vite: "^8.0.0",
      "vue-tsc": "^3.2.0"
    }
  }, null, 2)
}

function generateViteConfig(): string {
  return `import { defineConfig } from "vite"
import vue from "@vitejs/plugin-vue"
import { resolve } from "path"

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "src")
    }
  }
})
`
}

function generateTsConfig(): string {
  return JSON.stringify({
    compilerOptions: {
      target: "ES2020",
      module: "ESNext",
      moduleResolution: "bundler",
      strict: true,
      jsx: "preserve",
      resolveJsonModule: true,
      isolatedModules: true,
      esModuleInterop: true,
      lib: ["ES2020", "DOM", "DOM.Iterable"],
      skipLibCheck: true,
      noEmit: true,
      paths: {
        "@/*": ["./src/*"]
      }
    },
    include: ["src/**/*.ts", "src/**/*.vue"],
    references: [{ path: "./tsconfig.node.json" }]
  }, null, 2)
}

function generateTsConfigNode(): string {
  return JSON.stringify({
    compilerOptions: {
      composite: true,
      skipLibCheck: true,
      module: "ESNext",
      moduleResolution: "bundler",
      allowSyntheticDefaultImports: true
    },
    include: ["vite.config.ts"]
  }, null, 2)
}

function generateIndexHtml(projectName: string): string {
  return `<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${projectName}</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
`
}

function generateEnvDts(): string {
  return `/// <reference types="vite/client" />

declare module "*.vue" {
  import type { DefineComponent } from "vue"
  const component: DefineComponent<{}, {}, any>
  export default component
}
`
}

function generateSinglePageProject(schema: PageSchema): Record<string, string> {
  const projectName = schema.pageName
  const fileName = toKebabCase(schema.pageName)
  const componentName = toPascalCase(schema.pageName)

  const files: Record<string, string> = {}

  files[`src/views/${fileName}/index.vue`] = generateVueCode(schema)

  files["src/router.ts"] = `import { createRouter, createWebHistory } from "vue-router"
import ${componentName} from "@/views/${fileName}/index.vue"

const routes = [
  { path: "/", name: "${componentName}", component: ${componentName}, meta: { title: "${schema.pageName}" } }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

export default router
`

  files["src/App.vue"] = `<template>
  <router-view />
</template>
`

  files["src/main.ts"] = `import { createApp } from "vue"
import ElementPlus from "element-plus"
import "element-plus/dist/index.css"
import App from "./App.vue"
import router from "./router"

const app = createApp(App)
app.use(ElementPlus)
app.use(router)
app.mount("#app")
`

  return files
}

export async function exportProjectZip(project: ProjectSchema): Promise<void> {
  const zip = new JSZip()
  const projectName = project.projectName || "ai-project"

  const projectFiles = generateProjectCode(project)

  for (const [path, content] of Object.entries(projectFiles)) {
    zip.file(path, content)
  }

  zip.file("package.json", generatePackageJson(projectName))
  zip.file("vite.config.ts", generateViteConfig())
  zip.file("tsconfig.json", generateTsConfig())
  zip.file("tsconfig.node.json", generateTsConfigNode())
  zip.file("index.html", generateIndexHtml(projectName))
  zip.file("src/env.d.ts", generateEnvDts())
  zip.file(".gitignore", "node_modules\ndist\n")

  const blob = await zip.generateAsync({ type: "blob" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `${toKebabCase(projectName)}.zip`
  a.click()
  URL.revokeObjectURL(url)
}

export async function exportSinglePageZip(schema: PageSchema): Promise<void> {
  const zip = new JSZip()
  const projectName = schema.pageName || "ai-page"

  const pageFiles = generateSinglePageProject(schema)

  for (const [path, content] of Object.entries(pageFiles)) {
    zip.file(path, content)
  }

  zip.file("package.json", generatePackageJson(projectName))
  zip.file("vite.config.ts", generateViteConfig())
  zip.file("tsconfig.json", generateTsConfig())
  zip.file("tsconfig.node.json", generateTsConfigNode())
  zip.file("index.html", generateIndexHtml(projectName))
  zip.file("src/env.d.ts", generateEnvDts())
  zip.file(".gitignore", "node_modules\ndist\n")

  const blob = await zip.generateAsync({ type: "blob" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `${toKebabCase(projectName)}.zip`
  a.click()
  URL.revokeObjectURL(url)
}

export function generatePreviewHtml(schema: PageSchema): string {
  const vueCode = generateVueCode(schema)

  const templateMatch = vueCode.match(/<template>([\s\S]*?)<\/template>/)
  const scriptMatch = vueCode.match(/<script[^>]*>([\s\S]*?)<\/script>/)
  const styleMatch = vueCode.match(/<style[^>]*>([\s\S]*?)<\/style>/)

  const template = templateMatch ? templateMatch[1].trim() : ""
  const script = scriptMatch ? scriptMatch[1].trim() : ""
  const style = styleMatch ? styleMatch[1].trim() : ""

  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="stylesheet" href="https://unpkg.com/element-plus/dist/index.css" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f5f7fa; }
    ${style.replace(/:deep\(/g, "::v-deep(")}
  </style>
</head>
<body>
  <div id="app"></div>
  <script src="https://unpkg.com/vue@3/dist/vue.global.prod.js"></script>
  <script src="https://unpkg.com/element-plus"></script>
  <script>
    const { createApp, ref, reactive, computed } = Vue

    const app = createApp({
      template: \`${template.replace(/`/g, "\\`").replace(/\$/g, "\\$")}\`,
      setup() {
        ${script
          .replace(/import\s*\{[^}]*\}\s*from\s*["']vue["'];?/g, "")
          .replace(/import\s*\{[^}]*\}\s*from\s*["']element-plus["'];?/g, "")
          .trim()}
        return { ${extractReturnVars(script)} }
      }
    })

    app.use(ElementPlus)
    app.mount("#app")

    function extractReturnVars(scriptContent) {
      const returnMatch = scriptContent.match(/return\s*\{([^}]*)\}/)
      if (returnMatch) return returnMatch[1]
      const vars = []
      const refMatches = scriptContent.matchAll(/(?:const|let|var)\s+(\w+)\s*=\s*(?:ref|reactive|computed)/g)
      for (const m of refMatches) vars.push(m[1])
      const funcMatches = scriptContent.matchAll(/function\s+(\w+)/g)
      for (const m of funcMatches) vars.push(m[1])
      return vars.join(", ")
    }
  </script>
</body>
</html>`
}
