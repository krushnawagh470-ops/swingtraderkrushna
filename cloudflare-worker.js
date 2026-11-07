const ALLOWED_ORIGIN = "https://krushnawagh470-ops.github.io";

function json(data, status = 200, origin = ALLOWED_ORIGIN) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Vary": "Origin",
      "Cache-Control": "no-store"
    }
  });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";
    if (origin !== ALLOWED_ORIGIN) return new Response("Forbidden origin", { status: 403 });

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Max-Age": "86400",
          "Vary": "Origin"
        }
      });
    }

    const url = new URL(request.url);
    if (url.pathname === "/health" && request.method === "GET") {
      return json({ ok: true, service: "SwingTraderKrushna Claude Agent", configured: Boolean(env.ANTHROPIC_API_KEY && env.AGENT_ACCESS_TOKEN) });
    }

    if (url.pathname !== "/chat" || request.method !== "POST") return json({ error: "Not found" }, 404);
    if (!env.ANTHROPIC_API_KEY || !env.AGENT_ACCESS_TOKEN) return json({ error: "Worker secrets are not configured yet." }, 503);

    const auth = request.headers.get("Authorization") || "";
    if (auth !== `Bearer ${env.AGENT_ACCESS_TOKEN}`) return json({ error: "Access token is incorrect." }, 401);

    const length = Number(request.headers.get("Content-Length") || 0);
    if (length > 20000) return json({ error: "Request is too large." }, 413);

    let body;
    try { body = await request.json(); } catch { return json({ error: "Invalid JSON request." }, 400); }
    if (!Array.isArray(body.messages) || body.messages.length < 1 || body.messages.length > 12) {
      return json({ error: "Send between 1 and 12 chat messages." }, 400);
    }

    const messages = body.messages.map(m => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: String(m.content || "").slice(0, 6000)
    })).filter(m => m.content.trim());

    if (!messages.length || messages[messages.length - 1].role !== "user") {
      return json({ error: "The latest message must be from the user." }, 400);
    }

    try {
      const upstream = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${env.ANTHROPIC_API_KEY}`,
          "anthropic-version": "2026-10-21",
          "content-type": "application/json"
        },
        body: JSON.stringify({
          model: "claude-sonnet-5-5",
          max_tokens: 1200,
          system: "You are SwingTraderKrushna's AI assistant. Be accurate, practical and concise. Explain assumptions. Never claim to have accessed a broker, executed a trade, browsed the web, changed files, or completed an external action unless a connected tool actually did it. This chat currently has no external tools and cannot execute trades.",
          messages
        })
      });

      const result = await upstream.json();
      if (!upstream.ok) {
        const message = result?.error?.message || "Claude API request failed.";
        return json({ error: message }, upstream.status === 429 ? 429 : 502);
      }
      const reply = (result.content || []).filter(x => x.type === "text").map(x => x.text).join("\n").trim();
      return json({ reply, model: result.model, usage: result.usage || null });
    } catch {
      return json({ error: "Could not reach Claude API. Please try again." }, 502);
    }
  }
};
