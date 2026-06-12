import type { PageSchema, HistoryItem } from "@/types/schema"

const STORAGE_KEY = "ai-vue-generator-history"
const MAX_HISTORY = 20

export function getHistory(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function addHistory(prompt: string, schema: PageSchema): HistoryItem {
  const history = getHistory()
  const item: HistoryItem = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    prompt,
    schema,
    createdAt: Date.now()
  }
  history.unshift(item)
  if (history.length > MAX_HISTORY) history.length = MAX_HISTORY
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history))
  return item
}

export function deleteHistory(id: string): void {
  const history = getHistory().filter(h => h.id !== id)
  localStorage.setItem(STORAGE_KEY, JSON.stringify(history))
}

export function clearHistory(): void {
  localStorage.removeItem(STORAGE_KEY)
}
