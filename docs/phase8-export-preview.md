# 阶段8：真实项目导出 + 实时预览沙箱

## 学习目标

- 掌握 JSZip 生成完整可运行项目 ZIP 的方法
- 理解 iframe 沙箱预览的原理与安全考量
- 学会主题配置系统的设计（CSS 变量 + 预设主题）
- 了解完整项目脚手架的文件结构

---

## 1. 为什么需要 ZIP 项目导出？

### 1.1 之前的问题

| 导出方式 | 问题 |
|---------|------|
| 下载单个 .vue 文件 | 缺少 package.json、vite.config.ts 等，无法直接运行 |
| 下载 .txt 文本 | 需要手动创建项目、复制粘贴每个文件 |
| 项目级 .txt | 同上，多文件更痛苦 |

### 1.2 ZIP 导出的优势

```
用户点击「导出 ZIP」
  → 自动生成完整项目结构
  → 打包为 .zip 文件
  → 解压后 npm install && npm run dev 即可运行
```

---

## 2. 完整项目脚手架

### 2.1 生成的文件结构

```
my-project/
├── index.html              # 入口 HTML
├── package.json            # 依赖配置
├── vite.config.ts          # Vite 配置
├── tsconfig.json           # TypeScript 配置
├── tsconfig.node.json      # Node TypeScript 配置
├── .gitignore              # Git 忽略
└── src/
    ├── env.d.ts            # 类型声明
    ├── main.ts             # 应用入口
    ├── App.vue             # 根组件
    ├── router.ts           # 路由配置
    └── views/
        ├── user-manage/
        │   └── index.vue   # 用户管理页
        └── order-manage/
            └── index.vue   # 订单管理页
```

### 2.2 关键文件生成

```typescript
function generatePackageJson(projectName: string): string {
  return JSON.stringify({
    name: toKebabCase(projectName),
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
      "element-plus": "^2.14.0"
    },
    devDependencies: {
      "@vitejs/plugin-vue": "^6.0.0",
      typescript: "~6.0.0",
      vite: "^8.0.0"
    }
  }, null, 2)
}
```

### 2.3 JSZip 打包

```typescript
import JSZip from "jszip"

export async function exportProjectZip(project: ProjectSchema): Promise<void> {
  const zip = new JSZip()

  // 1. 添加页面组件
  const projectFiles = generateProjectCode(project)
  for (const [path, content] of Object.entries(projectFiles)) {
    zip.file(path, content)
  }

  // 2. 添加脚手架文件
  zip.file("package.json", generatePackageJson(project.projectName))
  zip.file("vite.config.ts", generateViteConfig())
  zip.file("tsconfig.json", generateTsConfig())
  zip.file("index.html", generateIndexHtml(project.projectName))
  zip.file(".gitignore", "node_modules\ndist\n")

  // 3. 生成并下载
  const blob = await zip.generateAsync({ type: "blob" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `${toKebabCase(project.projectName)}.zip`
  a.click()
  URL.revokeObjectURL(url)
}
```

**JSZip 核心概念：**
- `zip.file(path, content)` → 添加文件到 ZIP
- `zip.generateAsync({ type: "blob" })` → 异步生成 ZIP Blob
- `URL.createObjectURL(blob)` → 创建下载链接

---

## 3. 实时预览沙箱

### 3.1 为什么需要沙箱预览？

| 组件预览 | 沙箱预览 |
|---------|---------|
| 使用模拟组件渲染 | 使用真实 Vue + Element Plus |
| Mock 数据固定 | 真实交互逻辑 |
| 样式可能有差异 | 与最终产物一致 |
| 无法验证代码正确性 | 可以验证代码是否能运行 |

### 3.2 iframe 沙箱原理

```
┌─────────────────────────────────────────┐
│  主应用 (Vue 3 + Element Plus)           │
│  ┌───────────────────────────────────┐  │
│  │  <iframe srcdoc="...">            │  │
│  │  ┌─────────────────────────────┐  │  │
│  │  │  独立运行环境                 │  │  │
│  │  │  - Vue 3 CDN                │  │  │
│  │  │  - Element Plus CDN         │  │  │
│  │  │  - 生成的 Vue 组件代码        │  │  │
│  │  └─────────────────────────────┘  │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

### 3.3 生成预览 HTML

```typescript
export function generatePreviewHtml(schema: PageSchema): string {
  const vueCode = generateVueCode(schema)

  // 从 SFC 中提取 template / script / style
  const template = extractTemplate(vueCode)
  const script = extractScript(vueCode)
  const style = extractStyle(vueCode)

  // 生成独立 HTML
  return `<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="https://unpkg.com/element-plus/dist/index.css" />
  <script src="https://unpkg.com/vue@3/dist/vue.global.prod.js"></script>
  <script src="https://unpkg.com/element-plus"></script>
  <style>${style}</style>
</head>
<body>
  <div id="app"></div>
  <script>
    const app = Vue.createApp({
      template: \`${template}\`,
      setup() { ${script} }
    })
    app.use(ElementPlus)
    app.mount("#app")
  </script>
</body>
</html>`
}
```

### 3.4 iframe 安全配置

```html
<iframe
  sandbox="allow-scripts allow-same-origin"
  :srcdoc="previewHtml"
/>
```

| sandbox 属性 | 作用 |
|-------------|------|
| `allow-scripts` | 允许执行 JavaScript |
| `allow-same-origin` | 允许同源访问（CDN 资源） |
| 不加 `allow-forms` | 禁止表单提交到外部 |
| 不加 `allow-popups` | 禁止弹窗 |

---

## 4. 主题配置系统

### 4.1 设计思路

```
预设主题（一键切换）
  ├── 默认蓝：#409eff + 白底
  ├── 翠绿：#67c23a + 浅绿底
  ├── 活力橙：#e6a23c + 浅橙底
  ├── 暗夜：#409eff + 深色底
  └── 极简：#333333 + 灰白底

自定义主题
  ├── 主色调（ColorPicker）
  ├── 圆角大小（Slider）
  ├── 背景色（ColorPicker）
  └── 卡片背景（ColorPicker）
```

### 4.2 主题数据结构

```typescript
interface ThemeConfig {
  primaryColor: string    // 主色调
  borderRadius: number    // 圆角
  fontSize: number        // 字号
  layoutBg: string        // 布局背景
  cardBg: string          // 卡片背景
}
```

### 4.3 CSS 变量应用

```typescript
const cssVars = computed(() => ({
  "--el-color-primary": localConfig.value.primaryColor,
  "--preview-border-radius": localConfig.value.borderRadius + "px",
  "--preview-layout-bg": localConfig.value.layoutBg,
  "--preview-card-bg": localConfig.value.cardBg
}))
```

Element Plus 本身使用 CSS 变量系统，修改 `--el-color-primary` 即可全局切换主题色。

---

## 5. 四视图架构

```
┌──────────────────────────────────────────────┐
│  [预览] [沙箱] [代码] [编辑]   🎨主题 📦ZIP  │
├──────────────────────────────────────────────┤
│                                              │
│  预览：组件模拟渲染（快速、轻量）              │
│  沙箱：iframe 真实运行（准确、可交互）         │
│  代码：Vue SFC 源码（复制/下载）              │
│  编辑：Schema 可视化编辑（微调结构）           │
│                                              │
└──────────────────────────────────────────────┘
```

| 视图 | 用途 | 优势 |
|------|------|------|
| 预览 | 快速查看页面结构 | 即时响应、无网络请求 |
| 沙箱 | 验证真实运行效果 | 与最终产物一致 |
| 代码 | 查看/复制源码 | 直接用于项目 |
| 编辑 | 可视化微调 Schema | 无需重新 AI 生成 |

---

## 阶段8总结

阶段8的核心是从"代码生成器"升级为"项目交付工具"：

1. **ZIP 项目导出** → 生成完整可运行项目，解压即用
2. **实时预览沙箱** → iframe 隔离环境，验证真实运行效果
3. **主题配置** → 预设主题 + 自定义，满足不同风格需求
4. **四视图架构** → 预览/沙箱/代码/编辑，各司其职

**关键洞察：AI 生成的代码需要验证才能交付。沙箱预览 + ZIP 导出，让用户从"看到代码"到"运行项目"的距离缩短为零。**
