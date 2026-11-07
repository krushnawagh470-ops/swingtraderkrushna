// CIRCUIT secure Gemini proxy
// Deploy this file as a Cloudflare Worker. Add GEMINI_API_KEY as a Secret.
const ALLOWED_ORIGIN = "https://krushnawagh470-ops.github.io";
const MODEL = "gemini-3.8-flash";

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
    const validMessages = body.messages.filter(item => item && ["user", "assistant"].includes(item.role) && typeof item.content === "string" && item.content.trim()).slice(-6);
    if (!validMessages.length || validMessages[validMessages.length - 1].role !== "user") return json({ error: "The latest message must be from the user." }, 400, origin);
    const transcript = validMessages.map(item => (item.role === "assistant" ? "Assistant: " : "User: ") + item.content.slice(0, 3500)).join("\n\n");
    const systemPrompt = `You are CIRCUIT, an independent AI assistant and virtual worker. Your name is CIRCUIT, never SwingTraderKrushna AI, SwingTraderKrushna, or Jarvis. If asked to introduce yourself, begin exactly: "Hello! I am CIRCUIT, your practical and honest AI assistant and virtual worker." Then briefly explain that you help with trading research, forex education, XAUUSD analysis, strategy development, technology, business, learning and personal planning. Explain forex concepts clearly and distinguish facts, assumptions and opinions. Never promise profits or guarantee trades. Do not claim live market prices, charts, news, broker access or tools unless actually provided. For XAUUSD, EURUSD and BTCUSD analysis, request timeframe, price data and context when missing. Focus on risk management and capital preservation. Be concise and respond directly; use low reasoning effort for faster everyday answers.`
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort("Gemini request timed out after 55 seconds"), 55000);
      const upstream = await fetch("https://generativelanguage.googleapis.com/v1beta/interactions", {
        method: "POST",
        signal: controller.signal,
        headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
        body: JSON.stringify({
          model: MODEL,
          system_instruction: systemPrompt,
          input: transcript,
          store: false,
          generation_config: { max_output_tokens: 900, thinking_level: "low" }
        })
      });
      clearTimeout(timeoutId);
      const raw = await upstream.text();
      let data = {};
      try { data = raw ? JSON.parse(raw) : {}; } catch { data = { rawError: raw.slice(0, 500) }; }
      if (!upstream.ok) return json({ error: data?.error?.message || data?.message || "Gemini provider request failed.", providerStatus: upstream.status }, upstream.status === 429 ? 429 : 502, origin);
      let reply = typeof data?.output_text === "string" ? data.output_text.trim() : "";
      if (!reply && Array.isArray(data?.steps)) {
        for (const step of data.steps) {
          if (step?.type === "model_output" && Array.isArray(step.content)) {
            reply = step.content.filter(part => part?.type === "text").map(part => part.text || "").join("\n").trim();
          }
        }
      }
      if (!reply && Array.isArray(data?.output)) {
        reply = data.output.flatMap(item => item?.content || []).filter(part => part?.type === "text").map(part => part.text || "").join("\n").trim();
      }
      if (!reply) return json({ error: "Gemini returned an empty response.", providerStatus: 502 }, 502, origin);
      return json({ reply, model: MODEL }, 200, origin);
    } catch (error) {
      const message = error?.name === "AbortError" || String(error?.message || "").includes("timed out") ? "Gemini did not respond within 55 seconds. Please retry." : (error.message || "Could not reach Gemini.");
      return json({ error: message }, 504, origin);
    }
  }
};