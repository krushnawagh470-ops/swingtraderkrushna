// CIRCUIT secure AI proxy — Groq primary
// Cloudflare Worker secrets: GROQ_API_KEY (required), GEMINI_API_KEY (kept for possible future fallback).
const ALLOWED_ORIGIN = "https://krushnawagh470-ops.github.io";
const PROVIDER = "Groq";
const MODEL = "openai/gpt-oss-120b";
const TIMEOUT_MS = 25000;

function cors(origin) {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin"
  };
}
function json(data, status, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...cors(origin) }
  });
}
export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    if (origin && origin !== ALLOWED_ORIGIN) return json({ error: "Origin not allowed." }, 403, origin);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
    const url = new URL(request.url);
    if (url.pathname === "/health" && request.method === "GET") {
      return json({
        ok: true,
        configured: Boolean(env.GROQ_API_KEY),
        provider: PROVIDER,
        model: MODEL,
        build: "circuit-groq-2026-11-08-v1",
        timeout_seconds: TIMEOUT_MS / 1000
      }, 200, origin);
    }
    if (url.pathname !== "/chat" || request.method !== "POST") return json({ error: "Not found." }, 404, origin);
    if (!env.GROQ_API_KEY) return json({ error: "Server secret GROQ_API_KEY is not configured in Cloudflare." }, 503, origin);

    let body;
    try { body = await request.json(); } catch { return json({ error: "Invalid JSON request." }, 400, origin); }
    if (!Array.isArray(body.messages) || body.messages.length === 0 || body.messages.length > 12) {
      return json({ error: "Send between 1 and 12 chat messages." }, 400, origin);
    }
    const validMessages = body.messages
      .filter(item => item && ["user", "assistant"].includes(item.role) && typeof item.content === "string" && item.content.trim())
      .slice(-10);
    if (!validMessages.length || validMessages[validMessages.length - 1].role !== "user") {
      return json({ error: "The latest message must be from the user." }, 400, origin);
    }

    const systemPrompt = `You are CIRCUIT, an independent AI assistant and virtual worker. Your name is CIRCUIT, never SwingTraderKrushna AI, SwingTraderKrushna, or Jarvis. If asked to introduce yourself, begin exactly: "Hello! I am CIRCUIT, your practical and honest AI assistant and virtual worker." Help with personal planning, learning, career, business, technology, trading research, forex education, XAUUSD, EURUSD, BTCUSD, strategy development and productivity. Explain concepts clearly and distinguish facts, assumptions and opinions. Never promise profits or guarantee trades. Do not claim live market prices, charts, news, broker access or tools unless actually provided. For market analysis, request timeframe, price data and context when missing. Prioritize risk management and capital preservation. Be concise, practical and honest.`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...validMessages.map(item => ({ role: item.role, content: item.content.slice(0, 3500) }))
    ];

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const upstream = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + env.GROQ_API_KEY
        },
        body: JSON.stringify({
          model: MODEL,
          messages,
          max_completion_tokens: 900,
          reasoning_effort: "low"
        })
      });
      const raw = await upstream.text();
      let data = {};
      try { data = raw ? JSON.parse(raw) : {}; } catch { data = {}; }
      if (!upstream.ok) {
        const detail = data?.error?.message || data?.message || "Groq provider request failed.";
        const status = upstream.status === 429 ? 429 : (upstream.status >= 400 && upstream.status < 500 ? 502 : 503);
        return json({ error: detail, provider: PROVIDER, providerStatus: upstream.status }, status, origin);
      }
      const reply = data?.choices?.[0]?.message?.content;
      if (typeof reply !== "string" || !reply.trim()) {
        return json({ error: "Groq returned an empty response.", provider: PROVIDER }, 502, origin);
      }
      return json({ reply: reply.trim(), provider: PROVIDER, model: data.model || MODEL }, 200, origin);
    } catch (error) {
      const timedOut = error?.name === "AbortError";
      return json({
        error: timedOut ? "CIRCUIT's AI provider did not respond within 25 seconds. Please retry." : (error?.message || "Could not reach the AI provider."),
        provider: PROVIDER
      }, timedOut ? 504 : 502, origin);
    } finally {
      clearTimeout(timeoutId);
    }
  }
};