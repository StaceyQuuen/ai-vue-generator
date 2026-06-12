export async function generatePage(
  prompt: string
) {
  const response = await fetch(
    "http://localhost:3001/generate",
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/json"
      },
      body: JSON.stringify({
        prompt
      })
    }
  );

  return response.json();
}