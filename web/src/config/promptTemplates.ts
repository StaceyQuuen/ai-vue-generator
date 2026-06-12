export interface PromptTemplate {
  id: string
  title: string
  icon: string
  prompt: string
  pageType: "list" | "form" | "dashboard"
}

export const promptTemplates: PromptTemplate[] = [
  {
    id: "user-manage",
    title: "用户管理",
    icon: "👤",
    pageType: "list",
    prompt: "用户管理页面，包含姓名搜索、手机号搜索、状态筛选、用户列表（序号、姓名、手机号、邮箱、状态、注册时间）、分页"
  },
  {
    id: "order-manage",
    title: "订单管理",
    icon: "📦",
    pageType: "list",
    prompt: "订单管理页面，包含订单号搜索、订单状态筛选、下单日期范围、订单列表（序号、订单号、商品名称、金额、状态、下单时间）、分页"
  },
  {
    id: "product-manage",
    title: "商品管理",
    icon: "🛍️",
    pageType: "list",
    prompt: "商品管理页面，包含商品名称搜索、分类筛选、商品列表（序号、商品名称、分类、价格、库存、状态）、分页"
  },
  {
    id: "user-form",
    title: "用户表单",
    icon: "📝",
    pageType: "form",
    prompt: "用户信息表单页面，包含姓名输入、手机号输入、邮箱输入、部门选择（技术部、市场部、财务部、人事部）、入职日期、备注"
  },
  {
    id: "order-form",
    title: "订单表单",
    icon: "📄",
    pageType: "form",
    prompt: "创建订单表单页面，包含客户姓名输入、联系电话输入、商品名称输入、数量输入、收货地址文本域、备注文本域"
  },
  {
    id: "sales-dashboard",
    title: "销售仪表盘",
    icon: "📊",
    pageType: "dashboard",
    prompt: "销售数据仪表盘页面，包含统计卡片（总用户数、总订单数、总营收、月增长率）、订单状态筛选、订单列表（序号、订单号、客户、金额、状态、日期）、分页"
  },
  {
    id: "system-dashboard",
    title: "系统仪表盘",
    icon: "🖥️",
    pageType: "dashboard",
    prompt: "系统监控仪表盘页面，包含统计卡片（今日访问、活跃用户、待处理工单、系统负载）、状态筛选、日志列表（序号、操作人、操作类型、内容、时间）、分页"
  }
]
