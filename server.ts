import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { ReplitConnectors } from "@replit/connectors-sdk";
import { createServer as createViteServer } from "vite";

const PORT = Number(process.env.PORT || 8080);
const SHEET_ID = process.env.GROQ_KEYS_SHEET_ID || "1Xxer-mz8HlzVWNajFC36SImgwdOdXmVwZdt5Ei-wYYU";
const SHEET_TAB = process.env.GROQ_KEYS_SHEET_TAB || "Groq Keys";
const KEY_REFRESH_INTERVAL_MS = 5 * 60 * 1000;
const KEY_COOLDOWN_MS = 65 * 1000;
const DAILY_KEY_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const MAX_REQUEST_BYTES = 2 * 1024 * 1024;
const REQUESTS_PER_MINUTE = 30;

type ChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type GroqChatOptions = {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
};

type SheetValuesResponse = {
  values?: unknown[][];
};

let cachedKeys: string[] = [];
let keysFetchedAt = 0;
let keyCursor = 0;
let keyFetchInFlight: Promise<string[]> | null = null;
const keyCooldowns = new Map<string, number>();
const requestWindows = new Map<string, { startedAt: number; count: number }>();

function sendJson(res: ServerResponse, status: number, body: Record<string, unknown>): void {
  const payload = JSON.stringify(body);
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(payload);
}

function isSameOrigin(req: IncomingMessage): boolean {
  const origin = req.headers.origin;
  if (!origin) return true;

  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}

function getClientAddress(req: IncomingMessage): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket.remoteAddress || "unknown";
}

function isRateLimited(req: IncomingMessage): boolean {
  const now = Date.now();
  const address = getClientAddress(req);
  const current = requestWindows.get(address);

  if (!current || now - current.startedAt >= 60_000) {
    requestWindows.set(address, { startedAt: now, count: 1 });
    return false;
  }

  current.count += 1;
  return current.count > REQUESTS_PER_MINUTE;
}

function readRequestBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const contentLength = Number(req.headers["content-length"] || 0);
    if (contentLength > MAX_REQUEST_BYTES) {
      reject(new Error("request_too_large"));
      req.resume();
      return;
    }

    const chunks: Buffer[] = [];
    let total = 0;

    req.on("data", (chunk: Buffer | string) => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      total += buffer.length;
      if (total > MAX_REQUEST_BYTES) {
        reject(new Error("request_too_large"));
        req.destroy();
        return;
      }
      chunks.push(buffer);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

async function loadKeysFromGoogleSheet(): Promise<string[]> {
  const connectors = new ReplitConnectors();
  const range = `'${SHEET_TAB.replace(/'/g, "''")}'!A1:C1000`;
  const endpoint = `/v4/spreadsheets/${SHEET_ID}/values/${encodeURIComponent(range)}?majorDimension=ROWS`;
  const response = await connectors.proxy("google-sheet", endpoint, { method: "GET" });

  if (!response.ok) {
    throw new Error(`Google Sheets request failed (${response.status})`);
  }

  const data = (await response.json()) as SheetValuesResponse;
  const rows = data.values || [];
  const headers = (rows[0] || []).map((value) => String(value).trim().toLowerCase());
  const keyColumn = headers.findIndex((header) => header === "groq api key");

  if (keyColumn === -1) {
    throw new Error(`The "${SHEET_TAB}" tab must contain a "Groq API Key" header`);
  }

  const keys = rows
    .slice(1)
    .map((row) => String(row[keyColumn] ?? "").trim())
    .filter((key) => /^gsk_[A-Za-z0-9_-]{10,}$/.test(key));

  return Array.from(new Set(keys));
}

async function getKeys(): Promise<string[]> {
  const cacheIsFresh = cachedKeys.length > 0 && Date.now() - keysFetchedAt < KEY_REFRESH_INTERVAL_MS;
  if (cacheIsFresh) return cachedKeys;
  if (keyFetchInFlight) return keyFetchInFlight;

  keyFetchInFlight = loadKeysFromGoogleSheet()
    .then((keys) => {
      if (keys.length === 0) {
        throw new Error("No valid Groq API keys were found in the Google Sheet");
      }
      cachedKeys = keys;
      keysFetchedAt = Date.now();
      console.log(`[groq] Loaded ${keys.length} keys from Google Sheets`);
      return cachedKeys;
    })
    .finally(() => {
      keyFetchInFlight = null;
    });

  return keyFetchInFlight;
}

function isKeyAvailable(key: string): boolean {
  return (keyCooldowns.get(key) || 0) <= Date.now();
}

function chooseKey(keys: string[]): string {
  for (let attempt = 0; attempt < keys.length; attempt += 1) {
    const key = keys[keyCursor % keys.length];
    keyCursor = (keyCursor + 1) % keys.length;
    if (isKeyAvailable(key)) return key;
  }
  return keys[0];
}

function normaliseChatOptions(value: unknown): GroqChatOptions {
  if (!value || typeof value !== "object") {
    throw new Error("Invalid Groq request");
  }

  const input = value as Partial<GroqChatOptions>;
  if (typeof input.model !== "string" || input.model.length === 0 || input.model.length > 200) {
    throw new Error("A valid Groq model is required");
  }
  if (!Array.isArray(input.messages) || input.messages.length === 0 || input.messages.length > 100) {
    throw new Error("A valid Groq message list is required");
  }

  const messages = input.messages.map((message) => {
    if (
      !message ||
      !["system", "user", "assistant"].includes(message.role) ||
      typeof message.content !== "string"
    ) {
      throw new Error("Invalid Groq message");
    }
    return { role: message.role, content: message.content };
  });

  return {
    model: input.model,
    messages,
    ...(typeof input.temperature === "number" ? { temperature: input.temperature } : {}),
    ...(typeof input.max_tokens === "number" ? { max_tokens: input.max_tokens } : {}),
    ...(typeof input.top_p === "number" ? { top_p: input.top_p } : {}),
  };
}

async function callGroq(options: GroqChatOptions): Promise<string> {
  const keys = await getKeys();
  let lastStatus = 500;
  let lastProviderMessage = "";
  const firstKey = chooseKey(keys);
  const firstKeyIndex = keys.indexOf(firstKey);

  for (let offset = 0; offset < keys.length; offset += 1) {
    const key = keys[(firstKeyIndex + offset) % keys.length];
    if (!isKeyAvailable(key)) continue;

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(options),
    });

    if (response.ok) {
      const data = (await response.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      return data.choices?.[0]?.message?.content || "";
    }

    lastStatus = response.status;
    const errorText = await response.text().catch(() => "");
    let upstreamMessage = "";
    try {
      const errorData = JSON.parse(errorText) as { error?: { message?: string } };
      upstreamMessage = errorData.error?.message || "";
    } catch {
      // Keep provider response details out of the client if Groq returns non-JSON.
    }

    if (response.status === 429) {
      const cooldown = /daily|quota|exceeded|24/i.test(errorText)
        ? DAILY_KEY_COOLDOWN_MS
        : KEY_COOLDOWN_MS;
      keyCooldowns.set(key, Date.now() + cooldown);
      continue;
    }

    if (response.status === 401 || response.status === 403) {
      keyCooldowns.set(key, Date.now() + DAILY_KEY_COOLDOWN_MS);
      continue;
    }

    if (upstreamMessage) {
      console.warn(`[groq] Upstream rejected request (${response.status}): ${upstreamMessage.slice(0, 240)}`);
    }
    lastProviderMessage = upstreamMessage;

    if (response.status >= 500) continue;
    break;
  }

  if (lastStatus === 429) {
    throw new Error("All Groq API keys are currently rate limited");
  }
  if (lastStatus === 401 || lastStatus === 403) {
    throw new Error("All Groq API keys were rejected by Groq");
  }
  if (lastProviderMessage) {
    throw new Error(`Groq rejected the request: ${lastProviderMessage.slice(0, 240)}`);
  }
  throw new Error(`Groq API request failed (${lastStatus})`);
}

async function handleApiRequest(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  if (url.pathname !== "/api/groq/chat/completions") return false;

  if (req.method !== "POST") {
    sendJson(res, 405, { error: "Method not allowed" });
    return true;
  }
  if (!isSameOrigin(req)) {
    sendJson(res, 403, { error: "Forbidden" });
    return true;
  }
  if (isRateLimited(req)) {
    res.setHeader("Retry-After", "60");
    sendJson(res, 429, { error: "Too many requests. Please try again shortly." });
    return true;
  }

  try {
    const body = JSON.parse(await readRequestBody(req));
    const content = await callGroq(normaliseChatOptions(body));
    sendJson(res, 200, { content });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Groq request failed";
    const status = message === "request_too_large" ? 413 : 502;
    sendJson(res, status, { error: message });
  }

  return true;
}

const vite = await createViteServer({
  server: {
    middlewareMode: true,
    host: true,
  },
  appType: "spa",
});

const server = createServer(async (req, res) => {
  if (await handleApiRequest(req, res)) return;
  vite.middlewares(req, res, () => {
    if (!res.writableEnded) {
      res.statusCode = 404;
      res.end("Not found");
    }
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Doc-to-Notes AI running on port ${PORT}`);
});
