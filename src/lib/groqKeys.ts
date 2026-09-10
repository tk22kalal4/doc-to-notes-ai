interface GroqChatOptions {
  model: string;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
}

/**
 * Calls the same-origin server endpoint. The server reads the Groq key pool
 * from the connected Google Sheet, so no Groq or Google credential is shipped
 * to the browser.
 */
export async function groqChatCompletion(options: GroqChatOptions): Promise<string> {
  const response = await fetch("/api/groq/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(options),
  });

  const data = (await response.json().catch(() => ({}))) as {
    content?: string;
    error?: string;
  };

  if (!response.ok) {
    throw new Error(data.error || `Groq API request failed (${response.status})`);
  }

  return data.content ?? "";
}

