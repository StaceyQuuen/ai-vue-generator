export type FieldType =
  | "id"
  | "name"
  | "phone"
  | "email"
  | "money"
  | "date"
  | "status"
  | "orderNo"
  | "text"

export interface FieldAnalysis {
  fields: {
    name: string
    type: FieldType
  }[]
}

export async function analyzeFields(
  columns: string[]
): Promise<FieldAnalysis> {
  const apiBase = import.meta.env.VITE_API_BASE || "http://127.0.0.1:3001"

  const response = await fetch(
    `${apiBase}/analyze-fields`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ columns })
    }
  )

  const result = await response.json()

  if (result.success) {
    return result.data
  }

  throw new Error(result.error || "字段分析失败")
}
