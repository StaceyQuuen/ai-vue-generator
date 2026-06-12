import type { PageSchema, ProviderConfig } from "@/types/schema"

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3001"

function toBackendSchema(schema: PageSchema): any {
  const result: any = {
    pageName: schema.pageName,
    pageType: schema.pageType || "list"
  }

  for (const comp of schema.components) {
    switch (comp.type) {
      case "searchForm":
        result.searchForm = { fields: comp.fields }
        break
      case "table":
        result.table = { columns: comp.columns }
        break
      case "pagination":
        result.pagination = { total: comp.total || 100 }
        break
      case "statCards":
        result.statCards = { cards: comp.cards }
        break
      case "form":
        result.form = { fields: comp.fields }
        break
    }
  }

  return result
}

function getProviderBody(config?: ProviderConfig): any {
  if (!config) return {}
  return {
    provider: config.provider,
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    model: config.model
  }
}

export async function fetchModels(config: ProviderConfig) {
  const params = new URLSearchParams({
    provider: config.provider,
    baseUrl: config.baseUrl,
    ...(config.apiKey ? { apiKey: config.apiKey } : {})
  })

  const response = await fetch(`${API_BASE}/models?${params}`)
  return response.json()
}

export async function generatePage(
  prompt: string,
  config?: ProviderConfig
) {
  const response = await fetch(
    `${API_BASE}/generate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, ...getProviderBody(config) })
    }
  )

  return response.json()
}

export interface StreamCallbacks {
  onToken: (token: string, fullContent: string) => void
  onDone: (result: any) => void
  onError: (error: string) => void
}

export async function generatePageStream(
  prompt: string,
  callbacks: StreamCallbacks,
  config?: ProviderConfig
) {
  try {
    const response = await fetch(
      `${API_BASE}/generate/stream`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, ...getProviderBody(config) })
      }
    )

    if (!response.ok) {
      callbacks.onError(`请求失败: ${response.status}`)
      return
    }

    const reader = response.body!.getReader()
    const decoder = new TextDecoder()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value, { stream: true })
      const lines = chunk.split("\n")

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue

        const jsonStr = line.slice(6)
        if (!jsonStr.trim()) continue

        try {
          const data = JSON.parse(jsonStr)

          if (data.error) {
            callbacks.onError(data.error)
            return
          }

          if (data.done) {
            callbacks.onDone(data.result)
            return
          }

          if (data.token) {
            callbacks.onToken(data.token, data.fullContent)
          }
        } catch {}
      }
    }
  } catch (err: any) {
    callbacks.onError(err.message || "网络错误")
  }
}

export async function iteratePage(
  currentSchema: PageSchema,
  instruction: string,
  config?: ProviderConfig
) {
  const backendSchema = toBackendSchema(currentSchema)
  const response = await fetch(
    `${API_BASE}/iterate`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currentSchema: backendSchema,
        instruction,
        ...getProviderBody(config)
      })
    }
  )

  return response.json()
}

export async function iteratePageStream(
  currentSchema: PageSchema,
  instruction: string,
  callbacks: StreamCallbacks,
  config?: ProviderConfig
) {
  try {
    const backendSchema = toBackendSchema(currentSchema)
    const response = await fetch(
      `${API_BASE}/iterate/stream`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentSchema: backendSchema,
          instruction,
          ...getProviderBody(config)
        })
      }
    )

    if (!response.ok) {
      callbacks.onError(`请求失败: ${response.status}`)
      return
    }

    const reader = response.body!.getReader()
    const decoder = new TextDecoder()

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value, { stream: true })
      const lines = chunk.split("\n")

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue

        const jsonStr = line.slice(6)
        if (!jsonStr.trim()) continue

        try {
          const data = JSON.parse(jsonStr)

          if (data.error) {
            callbacks.onError(data.error)
            return
          }

          if (data.done) {
            callbacks.onDone(data.result)
            return
          }

          if (data.token) {
            callbacks.onToken(data.token, data.fullContent)
          }
        } catch {}
      }
    }
  } catch (err: any) {
    callbacks.onError(err.message || "网络错误")
  }
}

export async function generateProject(
  prompt: string,
  config?: ProviderConfig
) {
  const response = await fetch(
    `${API_BASE}/generate-project`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, ...getProviderBody(config) })
    }
  )

  return response.json()
}
