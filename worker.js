// SwingTraderKrushna secure Gemini proxy
// Deploy this file as a Cloudflare Worker. Add GEMINI_API_KEY as a Secret.
const ALLOWED_ORIGIN = "https://krushnawagh470-ops.github.io";
const MODEL = "gemini-2.5-flash";

function cors(origin) {
  const allowed = origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN;
  return {
    "Access-Control-Allow-Origin": allowed,
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
      return json({ ok: true, configured: Boolean(env.GEMINI_API_KEY), model: MODEL }, 200, origin);
    }
    if (url.pathname !== "/chat" || request.method !== "POST") return json({ error: "Not found." }, 404, origin);
    if (!env.GEMINI_API_KEY) return json({ error: "Server secret GEMINI_API_KEY is not configured yet." }, 503, origin);
    let body;
    try { body = await request.json(); } catch { return json({ error: "Invalid JSON request." }, 400, origin); }
    if (!Array.isArray(body.messages) || body.messages.length === 0 || body.messages.length > 12) {
      return json({ error: "Send between 1 and 12 chat messages." }, 400, origin);
    }
    const contents = [];
    for (const item of body.messages) {
      if (!item || !["user", "assistant"].includes(item.role) || typeof item.content !== "string" || !item.content.trim()) continue;
      const role = item.role === "assistant" ? "model" : "user";
      contents.push({ role, parts: [{ text: item.content.slice(0, 12000) }] });
    }
    if (!contents.length || contents[contents.length - 1].role !== "user") return json({ error: "The latest message must be from the user." }, 400, origin);
    const systemPrompt = "You are SwingTraderKrushna AI, a practical, honest assistant for personal planning, learning, technology, business and trading. Explain forex concepts clearly and distinguish facts, assumptions and opinions. Never promise profits or guarantee trades. Do not claim live market prices, charts, news, broker access or tools unless actually provided. For XAUUSD, EURUSD and BTCUSD analysis, request timeframe, price data and context when missing. Focus on risk management and capital preservation. Be concise but useful.";
    try {
      const upstream = await fetch("https://generativelanguage.googleapis.com/v1beta/models/" + MODEL + ":generateContent?key=" + encodeURIComponent(env.GEMINI_API_KEY), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents,
          generationConfig: { temperature: 0.6, maxOutputTokens: 1800 }
        })
      });
      const data = await upstream.json();
      if (!upstream.ok) return json({ error: data?.error?.message || "Gemini provider request failed.", providerStatus: upstream.status }, upstream.status === 429 ? 429 : 502, origin);
      const reply = (data?.candidates?.[0]?.content?.parts || []).map(p => p.text || "").join("\n").trim();
      if (!reply) return json({ error: "Gemini returned an empty response." }, 502, origin);
      return json({ reply, model: MODEL }, 200, origin);
    } catch (error) {
      return json({ error: error.message || "Could not reach Gemini." }, 502, origin);
    }
  }
};