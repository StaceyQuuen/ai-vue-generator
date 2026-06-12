import { faker } from "@faker-js/faker/locale/zh_CN"
import type { TableColumn } from "@/types/schema"

type MockGenerator = () => string | number

const generatorMap: Record<string, MockGenerator> = {
  id: () => faker.number.int({ min: 1, max: 9999 }),
  name: () => faker.person.fullName(),
  phone: () => faker.phone.number(),
  email: () => faker.internet.email(),
  money: () => faker.number.float({ min: 100, max: 99999, fractionDigits: 2 }),
  date: () => faker.date.recent({ days: 365 }).toLocaleDateString("zh-CN"),
  status: () => faker.helpers.arrayElement(["正常", "冻结", "禁用"]),
  orderNo: () => `ORD${faker.number.int({ min: 100000, max: 999999 })}`,
  text: () => faker.lorem.sentence({ min: 2, max: 6 })
}

function guessFieldType(prop: string, label: string): string {
  const p = prop.toLowerCase()
  const l = label.toLowerCase()

  if (p.includes("id") || p === "id") return "id"
  if (p.includes("phone") || p.includes("mobile") || l.includes("手机")) return "phone"
  if (p.includes("email") || p.includes("mail") || l.includes("邮箱")) return "email"
  if (p.includes("money") || p.includes("price") || p.includes("amount") || p.includes("salary") || l.includes("金额") || l.includes("价格") || l.includes("薪资")) return "money"
  if (p.includes("date") || p.includes("time") || p.includes("at") || l.includes("日期") || l.includes("时间")) return "date"
  if (p.includes("status") || p.includes("state") || l.includes("状态")) return "status"
  if (p.includes("order") || p.includes("no") || l.includes("订单") || l.includes("编号")) return "orderNo"
  if (p.includes("name") || p.includes("title") || l.includes("姓名") || l.includes("名称")) return "name"
  return "text"
}

export function generateMockData(
  columns: TableColumn[],
  count: number = 10
): Record<string, any>[] {
  return Array.from({ length: count }, () => {
    const row: Record<string, any> = {}
    for (const col of columns) {
      const fieldType = guessFieldType(col.prop, col.label)
      const generator = generatorMap[fieldType] || generatorMap.text
      row[col.prop] = generator()
    }
    return row
  })
}
