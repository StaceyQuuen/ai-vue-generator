import type { PageSchema, SchemaTemplate } from "@/types/schema"

const STORAGE_KEY = "ai-vue-generator-templates"
const MAX_TEMPLATES = 50

const builtinTemplates: SchemaTemplate[] = [
  {
    id: "builtin-user-list",
    name: "用户管理列表",
    icon: "👤",
    category: "列表页",
    isBuiltin: true,
    createdAt: 0,
    schema: {
      pageName: "用户管理",
      pageType: "list",
      components: [
        {
          type: "searchForm",
          fields: [
            { label: "姓名", prop: "name", type: "input" },
            { label: "手机号", prop: "phone", type: "input" },
            { label: "状态", prop: "status", type: "select", options: ["启用", "禁用"] }
          ]
        },
        {
          type: "table",
          columns: [
            { label: "姓名", prop: "name" },
            { label: "手机号", prop: "phone" },
            { label: "邮箱", prop: "email" },
            { label: "部门", prop: "department" },
            { label: "状态", prop: "status" },
            { label: "注册时间", prop: "createTime" }
          ]
        },
        { type: "pagination", total: 100 }
      ]
    }
  },
  {
    id: "builtin-order-list",
    name: "订单管理列表",
    icon: "📦",
    category: "列表页",
    isBuiltin: true,
    createdAt: 0,
    schema: {
      pageName: "订单管理",
      pageType: "list",
      components: [
        {
          type: "searchForm",
          fields: [
            { label: "订单号", prop: "orderNo", type: "input" },
            { label: "状态", prop: "status", type: "select", options: ["待付款", "已付款", "已发货", "已完成", "已取消"] },
            { label: "下单日期", prop: "orderDate", type: "date" }
          ]
        },
        {
          type: "table",
          columns: [
            { label: "订单号", prop: "orderNo" },
            { label: "商品名称", prop: "productName" },
            { label: "客户", prop: "customerName" },
            { label: "金额", prop: "amount" },
            { label: "状态", prop: "status" },
            { label: "下单时间", prop: "orderTime" }
          ]
        },
        { type: "pagination", total: 100 }
      ]
    }
  },
  {
    id: "builtin-product-list",
    name: "商品管理列表",
    icon: "🛍️",
    category: "列表页",
    isBuiltin: true,
    createdAt: 0,
    schema: {
      pageName: "商品管理",
      pageType: "list",
      components: [
        {
          type: "searchForm",
          fields: [
            { label: "商品名称", prop: "productName", type: "input" },
            { label: "分类", prop: "category", type: "select", options: ["电子产品", "服装鞋帽", "食品饮料", "家居用品"] }
          ]
        },
        {
          type: "table",
          columns: [
            { label: "商品名称", prop: "productName" },
            { label: "分类", prop: "category" },
            { label: "价格", prop: "price" },
            { label: "库存", prop: "stock" },
            { label: "状态", prop: "status" }
          ]
        },
        { type: "pagination", total: 100 }
      ]
    }
  },
  {
    id: "builtin-user-form",
    name: "用户信息表单",
    icon: "📝",
    category: "表单页",
    isBuiltin: true,
    createdAt: 0,
    schema: {
      pageName: "用户信息",
      pageType: "form",
      components: [
        {
          type: "form",
          fields: [
            { label: "姓名", prop: "name", type: "input", required: true, placeholder: "请输入姓名" },
            { label: "手机号", prop: "phone", type: "input", required: true, placeholder: "请输入手机号" },
            { label: "邮箱", prop: "email", type: "input", placeholder: "请输入邮箱" },
            { label: "部门", prop: "department", type: "select", options: ["技术部", "市场部", "财务部", "人事部"], required: true },
            { label: "入职日期", prop: "hireDate", type: "date" },
            { label: "备注", prop: "remark", type: "textarea", placeholder: "请输入备注信息" }
          ]
        }
      ]
    }
  },
  {
    id: "builtin-sales-dashboard",
    name: "销售数据仪表盘",
    icon: "📊",
    category: "仪表盘",
    isBuiltin: true,
    createdAt: 0,
    schema: {
      pageName: "销售仪表盘",
      pageType: "dashboard",
      components: [
        {
          type: "statCards",
          cards: [
            { title: "总用户数", prop: "totalUsers", icon: "👥", color: "blue" },
            { title: "总订单数", prop: "totalOrders", icon: "📦", color: "green" },
            { title: "总营收", prop: "totalRevenue", icon: "💰", color: "orange" },
            { title: "月增长率", prop: "monthlyGrowth", icon: "📈", color: "purple" }
          ]
        },
        {
          type: "searchForm",
          fields: [
            { label: "订单状态", prop: "status", type: "select", options: ["待付款", "已付款", "已发货", "已完成"] },
            { label: "下单日期", prop: "orderDate", type: "date" }
          ]
        },
        {
          type: "table",
          columns: [
            { label: "订单号", prop: "orderNo" },
            { label: "客户", prop: "customer" },
            { label: "金额", prop: "amount" },
            { label: "状态", prop: "status" },
            { label: "日期", prop: "date" }
          ]
        },
        { type: "pagination", total: 100 }
      ]
    }
  }
]

export function getTemplates(): SchemaTemplate[] {
  let custom: SchemaTemplate[] = []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    custom = raw ? JSON.parse(raw) : []
  } catch {}
  return [...builtinTemplates, ...custom]
}

export function getCustomTemplates(): SchemaTemplate[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveAsTemplate(name: string, icon: string, category: string, schema: PageSchema): SchemaTemplate {
  const custom = getCustomTemplates()
  const item: SchemaTemplate = {
    id: "custom-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name,
    icon,
    category,
    schema,
    isBuiltin: false,
    createdAt: Date.now()
  }
  custom.unshift(item)
  if (custom.length > MAX_TEMPLATES) custom.length = MAX_TEMPLATES
  localStorage.setItem(STORAGE_KEY, JSON.stringify(custom))
  return item
}

export function deleteTemplate(id: string): void {
  const custom = getCustomTemplates().filter(t => t.id !== id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(custom))
}

export function clearCustomTemplates(): void {
  localStorage.removeItem(STORAGE_KEY)
}
