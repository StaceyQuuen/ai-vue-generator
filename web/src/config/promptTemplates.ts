export interface PromptTemplate {
  id: string
  title: string
  icon: string
  prompt: string
}

export const promptTemplates: PromptTemplate[] = [
  {
    id: "user-manage",
    title: "用户管理",
    icon: "👤",
    prompt: "用户管理页面，包含姓名搜索、手机号搜索、状态筛选、用户列表（序号、姓名、手机号、邮箱、状态、注册时间）、分页"
  },
  {
    id: "order-manage",
    title: "订单管理",
    icon: "📦",
    prompt: "订单管理页面，包含订单号搜索、订单状态筛选、下单日期范围、订单列表（序号、订单号、商品名称、金额、状态、下单时间）、分页"
  },
  {
    id: "product-manage",
    title: "商品管理",
    icon: "🛍️",
    prompt: "商品管理页面，包含商品名称搜索、分类筛选、商品列表（序号、商品名称、分类、价格、库存、状态）、分页"
  },
  {
    id: "employee-manage",
    title: "员工管理",
    icon: "👔",
    prompt: "员工管理页面，包含姓名搜索、部门筛选、员工列表（序号、姓名、部门、职位、手机号、入职日期、状态）、分页"
  },
  {
    id: "finance-record",
    title: "财务记录",
    icon: "💰",
    prompt: "财务记录页面，包含摘要搜索、类型筛选、日期范围、记录列表（序号、摘要、类型、金额、日期、经办人）、分页"
  },
  {
    id: "system-log",
    title: "系统日志",
    icon: "📋",
    prompt: "系统日志页面，包含操作人搜索、操作类型筛选、日期范围、日志列表（序号、操作人、操作类型、操作内容、IP地址、操作时间）、分页"
  }
]
