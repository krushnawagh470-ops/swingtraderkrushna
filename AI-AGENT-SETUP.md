# SwingTraderKrushna Claude Agent — setup

This Worker keeps the Anthropic API key off the public GitHub Pages site.

## 1. Deploy the Worker from a phone

1. Sign in or create a Cloudflare account: https://dash.cloudflare.com/
2. Open **Workers & Pages**: https://dash.cloudflare.com/?to=/:account/workers-and-pages
3. Choose **Create application** → **Create Worker** and name it `swingtraderkrushna-agent`.
4. Open the Worker editor / Quick Edit. Replace the sample code with the complete contents of `cloudflare-worker.js` from this repository.
5. Save and deploy. Copy the Worker URL, for example `https://swingtraderkrushna-agent.<your-subdomain>.workers.dev`.

## 2. Add two private Worker secrets

In the Worker dashboard open **Settings → Variables and Secrets → Add**. Add both as type **Secret**:

- `ANTHROPIC_API_KEY` — create a key at https://platform.claude.com/settings/keys
- `AGENT_ACCESS_TOKEN` — create a separate long random password. Do not reuse your Claude API key.

Save and deploy the Worker again. Never put either value in GitHub or send either value in chat.

## 3. Connect the website

Open https://krushnawagh470-ops.github.io/swingtraderkrushna/ and go to Home → AI Agent.
Enter the Worker URL and the same Agent Access Token, then press **Save & test connection**.
The Anthropic API key itself is entered only in Cloudflare as a secret.

## Important

- The Worker only accepts browser requests from the SwingTraderKrushna GitHub Pages origin and also requires the separate access token. Origin checks alone are not authentication.
- This first version is a conversational Claude assistant. It does not browse, control other apps, execute trades, or operate a broker.
- Cloudflare Workers has a free plan with usage limits; Claude API calls are separately billed by Anthropic. Set a spend limit in Claude Console before testing.
- If the access token is lost, replace the `AGENT_ACCESS_TOKEN` secret in Cloudflare and update the saved token in the website.
