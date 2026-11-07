# SwingTraderKrushna Trading Terminal

A mobile-friendly, static trading workspace.

## Included
- Overview dashboard and watchlist for XAUUSD, EURUSD and BTCUSD
- TradingView embedded interactive charts
- Cash-risk calculator (not broker-specific lot sizing)
- Local trade journal with CSV export
- SMC concept playbook

## Deploy free with GitHub Pages
1. Open this repository on GitHub.
2. Go to **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**.
4. Select branch **main** and folder **/(root)**, then Save.
5. Wait for GitHub Pages to publish. Your site URL will be shown on that page.

Journal entries are stored in the browser's local storage on the device used. Export CSV backups regularly. Charts are provided by TradingView. This app does not execute trades or connect to a broker.

## AI Agent (free-tier mode)

The AI Workbench uses the Gemini 2.5 Flash API through Google AI Studio. To use it:
1. Create a Gemini API key at https://aistudio.google.com/app/apikey.
2. Keep the project on Google's Free tier; do not link billing if you want to avoid API charges.
3. Open the terminal, select **Desk → AI Agent**, paste the key into the Gemini API key field, and send a message.
4. The key is held in page memory only and is not saved to local storage or the repository. It is sent directly from the browser to Google's API. For a public or multi-user deployment, replace this with a server-side proxy and secret storage before use.

Free-tier model access and request limits can change. Check your active limits in Google AI Studio. This assistant does not have automatic live-market data or broker execution unless separately integrated.

## Disclaimer
For education and trade planning only. Not financial advice. Verify all prices, contract specifications, tick values, spreads and execution details with your broker before trading.
