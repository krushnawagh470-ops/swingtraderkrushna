# SPIDER owner authentication setup

This branch adds Firebase Authentication with Google and email/password sign-in. The browser controls presentation only; the Cloudflare Worker and FastAPI backend independently verify Firebase ID-token signatures and enforce one configured owner email.

## Firebase setup
1. Create/select a Firebase project and add a Web app.
2. Copy its public web config into `firebase-config.js`.
3. In Authentication → Sign-in method, enable **Google** and **Email/Password**.
4. Add `krushnawagh470-ops.github.io` to Authentication → Settings → Authorised domains.
5. Set the same verified owner email in `firebase-config.js`, Cloudflare Worker variables, and Render environment.
6. Use the owner-only email account creation control once; verify the email. Google sign-in must use the same email.

## Server variables
Cloudflare Worker: `FIREBASE_PROJECT_ID`, `SPIDER_OWNER_EMAIL`. Keep AI provider secrets and D1 binding. The old `CIRCUIT_MEMORY_PASSWORD` and `CIRCUIT_MEMORY_JWT_SECRET` are no longer used by this branch.
Render: `FIREBASE_PROJECT_ID`, `SPIDER_OWNER_EMAIL`.
The updated backend requirements install `google-auth`. No service-account private key is needed. Firebase web API key is public by design; restrict its APIs and authorised domains. Never put AI provider keys in browser config.

## Security behaviour
- Worker chat and every cloud-memory route require a valid Firebase ID token.
- Only the exact verified owner email is authorised. CORS is not authentication.
- Render Gemini chat requires the same owner token.
- Health and public market/news read endpoints remain public because they do not expose private user data.

## Rollout
This branch is not deployed. Configure Firebase and hosting variables, run CI, then test successful owner sign-in and unauthenticated rejection on a preview environment before merging. Live `main` and production services remain unchanged.