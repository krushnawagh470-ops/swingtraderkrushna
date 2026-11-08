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


## CIRCUIT Persistent Memory v1 — one-time setup

The website now includes a cloud-memory panel. It is intentionally locked until you configure a D1 database and two Worker Secrets. The existing Groq chat continues to work without these memory bindings.

### 1. Create the D1 database

1. Open https://dash.cloudflare.com/ and select **Workers & Pages → D1 SQL Database**.
2. Create a database named `circuit-memory`.
3. Open the database's **Console**.
4. Open `migrations/0001_circuit_memory.sql` in this repository, copy the complete SQL, paste it into the D1 Console, and run it.
5. Confirm the tables `circuit_memories` and `memory_login_attempts` exist.

### 2. Bind D1 to the existing Worker

1. Open **Workers & Pages** and select the Worker whose URL is saved in CIRCUIT.
2. Open **Settings → Bindings → Add binding → D1 database**.
3. Set the variable/binding name to exactly `DB`.
4. Select the `circuit-memory` database and save.

### 3. Add two Worker Secrets

In the same Worker, open **Settings → Variables and Secrets** and add:

- `CIRCUIT_MEMORY_PASSWORD` — create a long, unique passphrase (at least 20 characters). This is the password you will enter in CIRCUIT's Cloud memory panel. Save it in your password manager.
- `CIRCUIT_MEMORY_JWT_SECRET` — generate a separate random secret of at least 32 characters. Do not use the memory passphrase again.

Add both as **Secrets**, not plain-text variables. Never put either value in GitHub, website code, screenshots, or chat.

### 4. Deploy and verify

1. Open the Worker editor, confirm it contains the latest `worker.js` from this repository, then **Save and Deploy**.
2. Open the CIRCUIT website and go to **AI → Cloud memory**.
3. Enter the passphrase you set for `CIRCUIT_MEMORY_PASSWORD`, then tap **Unlock cloud memory**.
4. Save a harmless test memory, for example: `Use 12-hour time format in answers.`
5. Refresh the page and unlock again. The test memory should still appear. Sign in on another device to confirm cross-device persistence.

### What v1 does and does not do

- Cloud memories are stored in your D1 database and are available across devices after signing in.
- Only memories you explicitly add are saved. The AI does not silently write memories.
- Each memory can be edited or deleted; **Delete all** clears all cloud memories for this owner.
- The browser keeps the signed-in token in session storage for up to 12 hours. Lock memory or close the browser session to remove it from that session.
- The current implementation is single-owner: all authenticated memory operations use one owner namespace. Do not share the passphrase.
- Memory content is sent to Groq as context when you send a chat message while cloud memory is unlocked. Do not save passwords, API keys, banking credentials, account numbers, or highly sensitive personal details.
- D1 stores the memory text; this version does not provide end-to-end encryption. Anyone with access to the Cloudflare account/database or Worker secrets may be able to access it.
- The login endpoint limits repeated failed attempts per IP using D1. This is an additional safeguard, not a replacement for a strong unique passphrase and secure Cloudflare account access.
- Existing browser-only learning notes remain separate in local storage; they are not automatically copied to cloud memory.

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
