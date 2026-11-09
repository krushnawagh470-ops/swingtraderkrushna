// SPIDER AI core — provider-independent Cloudflare Worker
// Default: Groq. Future switch: set AI_PROVIDER=openai and add OPENAI_API_KEY
// as a Cloudflare Worker secret. Never put provider keys in the website.

const ALLOWED_ORIGIN = "https://krushnawagh470-ops.github.io";
const DEFAULT_PROVIDER = "groq";
const GROQ_MODEL = "openai/gpt-oss-120b";
const OPENAI_MODEL = "gpt-4.1-mini";
const TIMEOUT_MS = 25000;
const MAX_MESSAGES = 12;
const MAX_MESSAGE_CHARS = 3500;

const SPIDER_CORE_PROMPT = `You are SPIDER, an independent AI assistant and virtual worker. Your name is SPIDER, never SwingTraderKrushna AI, SwingTraderKrushna, or Jarvis. If asked to introduce yourself, begin exactly: "Hello! I am SPIDER, your practical and honest AI assistant and virtual worker."

MISSION
Help the user make progress across personal life, planning, learning, communication, finance, career, business, entrepreneurship, content creation, technology, and trading/investing. Trading is one area, not the whole workspace.

OPERATING RULES
- Understand the actual task and answer it directly. Be practical, structured, and concise; explain difficult concepts in plain language.
- Be candid and analytical. Do not agree just to please the user. Point out flawed assumptions, risks, and trade-offs.
- Distinguish verified facts, assumptions, estimates, and opinions. State uncertainty when evidence is missing.
- Never fabricate live data, sources, tool access, research, file changes, deployments, bookings, or completed actions.
- Do not claim to browse, execute code, control apps, access accounts, or perform external actions unless the request context actually supplies a connected tool and it was used successfully.
- Prefer free or affordable options where practical. Do not promise income, trading profits, or guaranteed outcomes.
- Protect credentials and sensitive personal/financial information. Never ask the user to paste API keys, passwords, or access tokens into chat.
- Use relevant user-approved context supplied with the request. New explicit user instructions override older preferences. Do not treat feedback as factual knowledge.
- For trading, prioritize capital preservation, risk sizing, invalidation, and uncertainty. Never present a setup as guaranteed or personalized financial advice.
- For current or time-sensitive claims, explain when the available information may be stale and request or use current source data when available.
- Use 12-hour clock with am/pm when writing times.
- If a task requires a tool or external access that is unavailable, say so and provide the next practical step.`;

function cors() {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Vary": "Origin"
  };
}
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...cors() }
  });
}
function selectedProvider(env) {
  const value = String(env.AI_PROVIDER || DEFAULT_PROVIDER).trim().toLowerCase();
  return value === "openai" ? "openai" : "groq";
}
function providerConfig(provider, env) {
  if (provider === "openai") {
    return {
      label: "OpenAI",
      model: env.OPENAI_MODEL || OPENAI_MODEL,
      key: env.OPENAI_API_KEY,
      endpoint: "https://api.openai.com/v1/chat/completions"
    };
  }
  return {
    label: "Groq",
    model: env.GROQ_MODEL || GROQ_MODEL,
    key: env.GROQ_API_KEY,
    endpoint: "https://api.groq.com/openai/v1/chat/completions"
  };
}
function validMessages(input) {
  if (!Array.isArray(input) || input.length < 1 || input.length > MAX_MESSAGES) return null;
  const messages = input
    .filter(item => item && ["user", "assistant"].includes(item.role) &&
      typeof item.content === "string" && item.content.trim())
    .slice(-10)
    .map(item => ({ role: item.role, content: item.content.trim().slice(0, MAX_MESSAGE_CHARS) }));
  if (!messages.length || messages[messages.length - 1].role !== "user") return null;
  return messages;
}


const FIREBASE_JWKS_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";
let firebaseKeysCache = { expiresAt: 0, keys: null };
function fromB64url(value) {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((value.length + 3) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}
async function verifyFirebaseOwner(request, env) {
  const projectId = String(env.FIREBASE_PROJECT_ID || "").trim();
  const ownerEmail = String(env.SPIDER_OWNER_EMAIL || "").trim().toLowerCase();
  if (!projectId || !ownerEmail) return { ok: false, status: 503, error: "Owner authentication is not configured. Set FIREBASE_PROJECT_ID and SPIDER_OWNER_EMAIL." };
  const authorization = request.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) return { ok: false, status: 401, error: "Sign in to SPIDER to continue." };
  const token = authorization.slice(7).trim();
  if (!token || token.length > 12000) return { ok: false, status: 401, error: "Invalid sign-in token." };
  try {
    const parts = token.split(".");
    if (parts.length !== 3) throw new Error("Malformed token");
    const decode = value => JSON.parse(new TextDecoder().decode(fromB64url(value)));
    const header = decode(parts[0]), claims = decode(parts[1]);
    const now = Math.floor(Date.now() / 1000);
    if (header.alg !== "RS256" || !header.kid) throw new Error("Unsupported token");
    if (claims.aud !== projectId || claims.iss !== "https://securetoken.google.com/" + projectId) throw new Error("Wrong token audience");
    if (typeof claims.sub !== "string" || !claims.sub || claims.sub.length > 128) throw new Error("Missing subject");
    if (!Number.isFinite(claims.exp) || claims.exp <= now || !Number.isFinite(claims.iat) || claims.iat > now + 60) throw new Error("Expired or invalid token time");
    if (claims.email_verified !== true || String(claims.email || "").trim().toLowerCase() !== ownerEmail) throw new Error("Not the authorised owner");
    if (!firebaseKeysCache.keys || firebaseKeysCache.expiresAt <= now) {
      const response = await fetch(FIREBASE_JWKS_URL, { cf: { cacheTtl: 3600, cacheEverything: true } });
      if (!response.ok) throw new Error("Could not load Firebase signing keys");
      const data = await response.json();
      firebaseKeysCache = { keys: data.keys || [], expiresAt: now + 3600 };
    }
    const jwk = firebaseKeysCache.keys.find(key => key.kid === header.kid && key.kty === "RSA");
    if (!jwk) throw new Error("Unknown signing key");
    const key = await crypto.subtle.importKey("jwk", jwk, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    const valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, fromB64url(parts[2]), new TextEncoder().encode(parts[0] + "." + parts[1]));
    if (!valid) throw new Error("Invalid token signature");
    return { ok: true, userId: claims.sub, email: ownerEmail };
  } catch (_) {
    return { ok: false, status: 401, error: "Your SPIDER sign-in is invalid or expired. Sign in again." };
  }
}
async function memoryRoute(request, env, url) {
  if (!env.DB) return json({ error: "Persistent memory is not configured. Bind the D1 database as DB." }, 503);
  if (url.pathname === "/memory" && request.method === "GET") {
    const result = await env.DB.prepare("SELECT id, category, content, created_at, updated_at FROM circuit_memories WHERE user_id = 'owner' ORDER BY updated_at DESC LIMIT 100").all();
    return json({ memories: result.results || [] });
  }
  if (url.pathname === "/memory" && request.method === "POST") {
    let body;
    try { body = await request.json(); } catch (_) { return json({ error: "Invalid JSON request." }, 400); }
    const content = typeof body.content === "string" ? body.content.trim() : "";
    const category = typeof body.category === "string" ? body.category.trim().slice(0, 40) : "General";
    if (!content || content.length > 1200) return json({ error: "Memory must contain 1–1,200 characters." }, 400);
    const count = await env.DB.prepare("SELECT COUNT(*) AS n FROM circuit_memories WHERE user_id = 'owner'").first();
    if (Number(count?.n || 0) >= 100) return json({ error: "Memory limit reached (100). Delete an old memory before adding another." }, 409);
    const id = crypto.randomUUID(), now = Date.now();
    await env.DB.prepare("INSERT INTO circuit_memories (id, user_id, category, content, created_at, updated_at) VALUES (?, 'owner', ?, ?, ?, ?)").bind(id, category, content, now, now).run();
    return json({ memory: { id, category, content, created_at: now, updated_at: now } }, 201);
  }
  const match = url.pathname.match(/^\/memory\/([0-9a-f-]{36})$/i);
  if (match && request.method === "PUT") {
    let body;
    try { body = await request.json(); } catch (_) { return json({ error: "Invalid JSON request." }, 400); }
    const content = typeof body.content === "string" ? body.content.trim() : "";
    const category = typeof body.category === "string" ? body.category.trim().slice(0, 40) : "General";
    if (!content || content.length > 1200) return json({ error: "Memory must contain 1–1,200 characters." }, 400);
    const result = await env.DB.prepare("UPDATE circuit_memories SET category = ?, content = ?, updated_at = ? WHERE id = ? AND user_id = 'owner'").bind(category, content, Date.now(), match[1]).run();
    if (!result.meta?.changes) return json({ error: "Memory not found." }, 404);
    return json({ ok: true });
  }
  if (match && request.method === "DELETE") {
    const result = await env.DB.prepare("DELETE FROM circuit_memories WHERE id = ? AND user_id = 'owner'").bind(match[1]).run();
    if (!result.meta?.changes) return json({ error: "Memory not found." }, 404);
    return json({ ok: true });
  }
  if (url.pathname === "/memory/clear" && request.method === "DELETE") {
    await env.DB.prepare("DELETE FROM circuit_memories WHERE user_id = 'owner'").run();
    return json({ ok: true, message: "All cloud memories deleted." });
  }
  return json({ error: "Memory route not found." }, 404);
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    if (origin && origin !== ALLOWED_ORIGIN) return json({ error: "Origin not allowed." }, 403);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors() });

    const url = new URL(request.url);
    const provider = selectedProvider(env);
    const config = providerConfig(provider, env);

    if (url.pathname === "/health" && request.method === "GET") {
      return json({
        ok: true,
        configured: Boolean(config.key),
        provider: config.label,
        model: config.model,
        brain: "SPIDER Core v2",
        providerMode: provider,
        build: "circuit-core-provider-adapter-2026-11-08-v2",
        timeout_seconds: TIMEOUT_MS / 1000,
        memoryConfigured: Boolean(env.DB), authConfigured: Boolean(env.FIREBASE_PROJECT_ID && env.SPIDER_OWNER_EMAIL)
      });
    }

    if (url.pathname === "/memory" || url.pathname.startsWith("/memory/") || url.pathname === "/chat") {
      const identity = await verifyFirebaseOwner(request, env);
      if (!identity.ok) return json({ error: identity.error }, identity.status);
      if (url.pathname === "/memory" || url.pathname.startsWith("/memory/")) return memoryRoute(request, env, url);
    }
    if (url.pathname !== "/chat" || request.method !== "POST") return json({ error: "Not found." }, 404);
    if (!config.key) {
      const secret = provider === "openai" ? "OPENAI_API_KEY" : "GROQ_API_KEY";
      return json({ error: "The selected provider is " + config.label + ", but " + secret + " is not configured in Cloudflare Worker Secrets.", provider: config.label }, 503);
    }

    let body;
    try { body = await request.json(); }
    catch { return json({ error: "Invalid JSON request." }, 400); }

    const messages = validMessages(body.messages);
    if (!messages) return json({ error: "Send 1–12 valid messages, with the latest message from the user." }, 400);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const payload = {
        model: config.model,
        messages: [{ role: "system", content: SPIDER_CORE_PROMPT }, ...messages],
        max_completion_tokens: provider === "openai" ? 900 : 900
      };
      if (provider === "groq" && config.model.includes("gpt-oss")) payload.reasoning_effort = "low";

      const upstream = await fetch(config.endpoint, {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + config.key
        },
        body: JSON.stringify(payload)
      });
      const raw = await upstream.text();
      let data = {};
      try { data = raw ? JSON.parse(raw) : {}; } catch (_) {}
      if (!upstream.ok) {
        const detail = data?.error?.message || data?.message || (config.label + " provider request failed.");
        const status = upstream.status === 429 ? 429 : (upstream.status >= 400 && upstream.status < 500 ? 502 : 503);
        return json({ error: detail, provider: config.label, providerStatus: upstream.status }, status);
      }
      const reply = data?.choices?.[0]?.message?.content;
      if (typeof reply !== "string" || !reply.trim()) {
        return json({ error: config.label + " returned an empty response.", provider: config.label }, 502);
      }
      return json({ reply: reply.trim(), provider: config.label, model: data.model || config.model, brain: "SPIDER Core v2" });
    } catch (error) {
      const timedOut = error?.name === "AbortError";
      return json({
        error: timedOut ? "SPIDER's AI provider did not respond within 25 seconds. Please retry." : (error?.message || "Could not reach the AI provider."),
        provider: config.label
      }, timedOut ? 504 : 502);
    } finally {
      clearTimeout(timeoutId);
    }
  }
};
