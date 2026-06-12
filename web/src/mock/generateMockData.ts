import { faker } from "@faker-js/faker/locale/zh_CN"
import type { TableColumn } from "@/types/schema"

type MockGenerator = () => string | number

const generatorMap: Record<string, MockGenerator> = {
  id: () => faker.number.int({ min: 1, max: 9999 }),
  personName: () => faker.person.fullName(),
  productName: () => faker.helpers.arrayElement([
    "iPhone 15 Pro", "MacBook Air", "iPad Pro", "AirPods Pro",
    "华为 Mate 60", "小米14 Ultra", "OPPO Find X7", "vivo X100",
    "联想 ThinkPad", "戴尔 XPS 15", "Surface Pro", "三星 Galaxy S24",
    "索尼 WH-1000XM5", "Bose QC45", "任天堂 Switch", "PS5 手柄"
  ]),
  categoryName: () => faker.helpers.arrayElement([
    "电子产品", "服装鞋帽", "食品饮料", "家居用品",
    "图书文具", "美妆护肤", "运动户外", "母婴用品",
    "数码配件", "家电", "汽车用品", "宠物用品"
  ]),
  deptName: () => faker.helpers.arrayElement([
    "技术部", "市场部", "财务部", "人事部",
    "产品部", "运营部", "设计部", "客服部",
    "销售部", "法务部", "行政部", "采购部"
  ]),
  positionName: () => faker.helpers.arrayElement([
    "前端工程师", "后端工程师", "产品经理", "UI设计师",
    "项目经理", "测试工程师", "运维工程师", "数据分析师",
    "技术总监", "架构师", "运营经理", "市场专员"
  ]),
  phone: () => faker.phone.number(),
  email: () => faker.internet.email(),
  money: () => faker.number.float({ min: 100, max: 99999, fractionDigits: 2 }),
  date: () => faker.date.recent({ days: 365 }).toLocaleDateString("zh-CN"),
  status: () => faker.helpers.arrayElement(["正常", "冻结", "禁用"]),
  orderStatus: () => faker.helpers.arrayElement(["待付款", "已付款", "已发货", "已完成", "已取消", "退款中"]),
  orderNo: () => `ORD${faker.number.int({ min: 100000, max: 999999 })}`,
  stock: () => faker.number.int({ min: 0, max: 9999 }),
  quantity: () => faker.number.int({ min: 1, max: 100 }),
  address: () => faker.location.streetAddress({ useFullAddress: true }),
  content: () => faker.lorem.sentence({ min: 4, max: 10 }),
  ip: () => faker.internet.ipv4(),
  text: () => faker.lorem.sentence({ min: 2, max: 6 })
}

function guessFieldType(prop: string, label: string): string {
  const p = prop.toLowerCase()
  const l = label

  if (p === "id" || p.endsWith("id")) return "id"

  if (p.includes("phone") || p.includes("mobile") || l.includes("手机")) return "phone"
  if (p.includes("email") || p.includes("mail") || l.includes("邮箱")) return "email"

  if (p.includes("price") || l.includes("价格")) return "money"
  if (p.includes("amount") || l.includes("金额") || l.includes("营收")) return "money"
  if (p.includes("salary") || l.includes("薪资")) return "money"
  if (p.includes("money") || l.includes("费用")) return "money"

  if (p.includes("stock") || l.includes("库存")) return "stock"
  if (p.includes("quantity") || l.includes("数量")) return "quantity"

  if (p.includes("date") || p.includes("time") || p.includes("at") || l.includes("日期") || l.includes("时间")) return "date"

  if (p.includes("orderstatus") || l.includes("订单状态")) return "orderStatus"
  if (p.includes("status") || p.includes("state") || l.includes("状态")) return "status"

  if (p.includes("orderno") || p.includes("ordernumber") || l.includes("订单号") || l.includes("编号")) return "orderNo"

  if (p.includes("address") || l.includes("地址")) return "address"
  if (p.includes("ip") || l.includes("IP")) return "ip"
  if (p.includes("content") || p.includes("desc") || p.includes("remark") || l.includes("内容") || l.includes("描述") || l.includes("备注") || l.includes("摘要")) return "content"

  if (p.includes("category") || p.includes("type") && l.includes("分类") || l.includes("类型") || l.includes("类别")) return "categoryName"
  if (p.includes("dept") || p.includes("department") || l.includes("部门")) return "deptName"
  if (p.includes("position") || p.includes("job") || p.includes("title") && l.includes("职位") || l.includes("岗位")) return "positionName"

  if (p.includes("product") || p.includes("goods") || p.includes("item") || l.includes("商品") || l.includes("物品")) return "productName"

  if (l.includes("姓名") || l.includes("客户") || l.includes("经办人") || l.includes("操作人") || l.includes("用户")) return "personName"
  if (p.includes("name") || p.includes("title")) return "personName"

  return "text"
}

export function generateMockData(
  columns: TableColumn[],
  count: number = 10
): Record<string, any>[] {
  return Array.from({ length: count }, (_, index) => {
    const row: Record<string, any> = {}
    for (const col of columns) {
      const fieldType = guessFieldType(col.prop, col.label)
      const generator = generatorMap[fieldType] || generatorMap.text
      row[col.prop] = generator()
    }
    return row
  })
}
