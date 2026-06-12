import OpenAI from "openai"

const client = new OpenAI({
  apiKey: import.meta.env.VITE_API_KEY || "",
  baseURL: import.meta.env.VITE_BASE_URL || "https://open.bigmodel.cn/api/paas/v4",
  dangerouslyAllowBrowser: true
})

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
  const result =
    await client.chat.completions.create({
      model: import.meta.env.VITE_MODEL || "glm-4-flash",

      response_format: {
        type: "json_object"
      },

      messages: [
        {
          role: "system",
          content: `你是字段分析器。只返回JSON。

{
  "fields":[
    {
      "name":"",
      "type":""
    }
  ]
}

type只能是：
id、name、phone、email、money、date、status、orderNo、text`
        },
        {
          role: "user",
          content: JSON.stringify(columns)
        }
      ]
    })

  return JSON.parse(
    result.choices[0].message.content || "{}"
  )
}
