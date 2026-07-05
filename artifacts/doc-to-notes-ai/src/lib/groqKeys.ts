// Groq API key pool sourced from Supabase (mirrors the round-robin/rate-limit
// pattern used elsewhere), with local env vars as a fallback.

const SUPABASE_URL = "https://txhxgmryxsebqfxoocos.supabase.co";
const SUPABASE_KEY = "sb_publishable_Rp_naWKL3nPS-6nlOx1LHw_40Rc4T1M";

const REFRESH_INTERVAL_MS = 5 * 60 * 1000;
const TTL_MINUTE_MS = 65 * 1000;
const TTL_DAILY_MS = 24 * 60 * 60 * 1000;

let keys: string[] = [];
let index = 0;
let lastFetchedAt = 0;
let inFlightFetch: Promise<void> | null = null;

const rateLimited = new Map<string, number>(); // key -> unblockAtTimestamp

function envFallbackKeys(): string[] {
  const env = import.meta.env as Record<string, string | undefined>;
  const candidates = [
    env.VITE_GROQ_API_X,
    env.VITE_GROQ_API_KEY_X,
    env.VITE_GROQ_API_KEY,
  ].filter((v): v is string => !!v && v.trim().length > 0);
  return Array.from(new Set(candidates));
}

async function fetchKeysFromSupabase(): Promise<string[]> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_all_groq_keys`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
    if (!res.ok) {
      console.warn("[groqKeys] Supabase RPC error", res.status, await res.text().catch(() => ""));
      return [];
    }
    const data: Array<{ groq_api_key?: string }> = await res.json();
    return data
      .map((row) => row.groq_api_key?.trim() || "")
      .filter((k) => k.startsWith("gsk_"));
  } catch (err) {
    console.warn("[groqKeys] Supabase fetch failed", err);
    return [];
  }
}

async function ensureKeysLoaded(force = false): Promise<void> {
  const stale = Date.now() - lastFetchedAt > REFRESH_INTERVAL_MS;
  if (!force && keys.length > 0 && !stale) return;
  if (inFlightFetch) return inFlightFetch;

  inFlightFetch = (async () => {
    const fetched = await fetchKeysFromSupabase();
    if (fetched.length > 0) {
      keys = fetched;
    } else if (keys.length === 0) {
      keys = envFallbackKeys();
    }
    lastFetchedAt = Date.now();
  })();

  try {
    await inFlightFetch;
  } finally {
    inFlightFetch = null;
  }
}

function isAvailable(key: string): boolean {
  const unblockAt = rateLimited.get(key);
  return !unblockAt || Date.now() > unblockAt;
}

function allKnownKeys(): string[] {
  const combined = [...keys, ...envFallbackKeys()];
  return Array.from(new Set(combined));
}

export function markKeyRateLimited(key: string, daily = false): void {
  const ttl = daily ? TTL_DAILY_MS : TTL_MINUTE_MS;
  rateLimited.set(key, Date.now() + ttl);
}

/** Returns the next available Groq API key (Supabase pool, round-robin), falling back to env vars. */
export async function getGroqApiKey(): Promise<string> {
  await ensureKeysLoaded();
  const pool = allKnownKeys();
  if (pool.length === 0) return "";

  for (let attempt = 0; attempt < pool.length; attempt++) {
    const candidate = pool[index % pool.length];
    index = (index + 1) % pool.length;
    if (isAvailable(candidate)) return candidate;
  }
  // All keys are on cooldown — return one anyway so the caller can surface the real API error.
  return pool[0];
}

/** Returns every currently known key, for retry-on-429 loops. */
export async function getAllGroqApiKeys(): Promise<string[]> {
  await ensureKeysLoaded();
  return allKnownKeys();
}

interface GroqChatOptions {
  model: string;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
}

/**
 * Calls the Groq chat completions API, rotating through the Supabase-backed
 * key pool and retrying on 429 (rate limit) responses.
 */
export async function groqChatCompletion(options: GroqChatOptions): Promise<string> {
  const allKeys = await getAllGroqApiKeys();
  if (allKeys.length === 0) {
    throw new Error(
      "No Groq API key available. Add a key to the Supabase profiles table or set VITE_GROQ_API_KEY."
    );
  }

  let lastError: Error | null = null;

  for (const key of allKeys) {
    if (!isAvailable(key)) continue;
    try {
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify(options),
      });

      if (response.status === 429) {
        const body = await response.text().catch(() => "");
        const isDaily = /daily|quota|exceeded|24/i.test(body);
        markKeyRateLimited(key, isDaily);
        lastError = new Error("Groq API rate limit reached, trying next key...");
        continue;
      }

      if (!response.ok) {
        throw new Error(`Groq API request failed: ${response.statusText}`);
      }

      const data = await response.json();
      return data.choices?.[0]?.message?.content ?? "";
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
    }
  }

  throw lastError ?? new Error("Failed to reach Groq API with any available key.");
}
