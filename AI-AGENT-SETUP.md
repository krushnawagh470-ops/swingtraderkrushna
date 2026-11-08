# CIRCUIT AI Core — free-first setup

CIRCUIT now has a provider-independent AI core in `worker.js`. Groq remains the default provider. The website calls the Cloudflare Worker; provider API keys stay private in Cloudflare and are never placed in the public website.

## What changed

- A central CIRCUIT identity and operating prompt now lives in the Worker, rather than being tied to one model provider.
- The Worker uses a provider adapter. Groq is active by default.
- OpenAI can be selected later by changing one Worker variable and adding an API key secret. The website chat interface does not need to be rebuilt.
- The browser's existing learning memory remains user-controlled and local to that browser for now. It is not yet cross-device cloud memory; that requires a secure user identity and persistent database.

## Deploy the updated CIRCUIT brain

A GitHub commit does **not** automatically update the already-running Cloudflare Worker unless a Cloudflare deployment pipeline has been configured. The website may deploy separately through GitHub Pages.

1. Open Cloudflare Dashboard: https://dash.cloudflare.com/
2. Go to **Workers & Pages** and open the existing Worker used by CIRCUIT (the URL currently saved in the website).
3. Open **Edit code** / **Quick Edit**.
4. In this repository, open `worker.js`: https://github.com/krushnawagh470-ops/swingtraderkrushna/blob/main/worker.js
5. Replace the Worker editor contents with the complete `worker.js` file, then **Save and Deploy**.
6. Keep the existing `GROQ_API_KEY` secret. Do not paste it into GitHub or into this chat.
7. Open the website's AI Agent connection test. The health response should show **CIRCUIT Core v2**, provider **Groq**, and `configured: true`.

## Optional: switch to OpenAI later

Only do this when you choose to pay for OpenAI API usage. ChatGPT Free and OpenAI API billing are separate.

In the same Cloudflare Worker:
1. Open **Settings → Variables and Secrets**.
2. Add a plain-text variable `AI_PROVIDER` with value `openai`.
3. Add `OPENAI_API_KEY` as a **Secret**.
4. Save and deploy. The Worker health check should report provider **OpenAI**.

To switch back, set `AI_PROVIDER` to `groq` (or remove the variable) and ensure `GROQ_API_KEY` remains configured.

Optional model overrides:
- `GROQ_MODEL` (defaults to `openai/gpt-oss-120b`)
- `OPENAI_MODEL` (defaults to `gpt-4.1-mini`)

## Current limits — stated clearly

- This is CIRCUIT's central reasoning/assistant layer, not a direct connection to the ChatGPT Free app.
- It does not automatically gain access to ChatGPT, Claude, Gemini, broker accounts, GitHub actions, or other apps. Those require separate, explicitly connected tools.
- Learning memory is currently saved in browser local storage. Clearing browser data or changing devices may make that memory unavailable.
- Market data/news context is only available when the website successfully retrieves and attaches it. The AI must not invent missing live data.
- The Worker accepts chat messages only; no broker execution or financial transactions are implemented.
- Groq and OpenAI API availability, quotas, and charges are controlled by their respective providers. Check current terms and limits before relying on a free tier or enabling paid API use.

## Security

- Never put provider API keys in `index.html`, GitHub, screenshots, or chat messages.
- Store keys only as Cloudflare Worker **Secrets**.
- The Worker restricts browser origins to the SwingTraderKrushna GitHub Pages origin. Origin checks are not a substitute for user authentication; do not expose sensitive personal records through this public chat endpoint.
