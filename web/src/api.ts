const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:3001"

export async function generatePage(
  prompt: string
) {
  const response = await fetch(
    `${API_BASE}/generate`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ prompt })
    }
  );

  return response.json();
}

export interface StreamCallbacks {
  onToken: (token: string, fullContent: string) => void
  onDone: (result: any) => void
  onError: (error: string) => void
}

export async function generatePageStream(
  prompt: string,
  callbacks: StreamCallbacks
) {
  try {
    const response = await fetch(
      `${API_BASE}/generate/stream`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ prompt })
      }
    );

    if (!response.ok) {
      callbacks.onError(`请求失败: ${response.status}`);
      return;
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n");

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;

        const jsonStr = line.slice(6);
        if (!jsonStr.trim()) continue;

        try {
          const data = JSON.parse(jsonStr);

          if (data.error) {
            callbacks.onError(data.error);
            return;
          }

          if (data.done) {
            callbacks.onDone(data.result);
            return;
          }

          if (data.token) {
            callbacks.onToken(data.token, data.fullContent);
          }
        } catch {}
      }
    }
  } catch (err: any) {
    callbacks.onError(err.message || "网络错误");
  }
}
