/* SPIDER owner sign-in: Firebase Google + email/password. Server verifies every ID token. */
(function () {
  "use strict";
  const gate = document.getElementById("spiderAuthGate"), status = document.getElementById("spiderAuthStatus");
  const email = document.getElementById("spiderAuthEmail"), password = document.getElementById("spiderAuthPassword");
  const ownerEmail = String(window.SPIDER_OWNER_EMAIL || "").trim().toLowerCase();
  let auth = null, resolveReady, pendingGoogleCredential = null;
  window.spiderAuthReady = new Promise(resolve => { resolveReady = resolve; });
  function message(text, error) { if (status) { status.textContent = text; status.dataset.error = error ? "true" : "false"; } }
  function setAuthenticated(user) {
    const ok = Boolean(user && ownerEmail && String(user.email || "").toLowerCase() === ownerEmail && user.emailVerified);
    document.documentElement.classList.toggle("spider-auth-locked", !ok);
    if (gate) gate.hidden = ok;
    const signOut = document.getElementById("spiderSignOut"); if (signOut) signOut.hidden = !ok;
    const linkEmail = document.getElementById("spiderLinkEmail");
    if (linkEmail) linkEmail.hidden = !ok || user.providerData.some(p => p.providerId === "password");
    if (ok) message("Signed in as " + user.email, false);
    else if (user && String(user.email || "").toLowerCase() !== ownerEmail) { message("This account is not the authorised SPIDER owner.", true); auth.signOut().catch(() => {}); }
    else if (user) message("Verify your owner email address before using SPIDER.", true);
    else message("Sign in with the authorised Google account or its email/password login.", false);
    window.dispatchEvent(new CustomEvent("spider-auth-state", { detail: { user: ok ? user : null } }));
    resolveReady(ok ? user : null);
  }
  function readyConfig() {
    const c = window.SPIDER_FIREBASE_CONFIG;
    if (!c || !c.apiKey || !c.authDomain || !c.projectId || !c.appId || !ownerEmail) {
      message("Firebase setup is incomplete. Configure firebase-config.js and the matching owner email in Cloudflare and Render. Workspace remains locked.", true);
      return false;
    }
    return true;
  }
  async function busy(button, fn) {
    button.disabled = true;
    try { await fn(); } catch (e) { message(e && e.message ? e.message : "Sign-in failed.", true); }
    finally { button.disabled = false; }
  }
  window.spiderGetIdToken = async function () {
    const user = auth && auth.currentUser;
    if (!user || String(user.email || "").toLowerCase() !== ownerEmail || !user.emailVerified) throw new Error("Sign in with the authorised SPIDER owner account first.");
    return user.getIdToken();
  };
  window.spiderSignOut = async function () { if (auth) await auth.signOut(); };
  function init() {
    if (!gate) { resolveReady(null); return; }
    if (!window.firebase || !readyConfig()) { resolveReady(null); return; }
    try { if (!firebase.apps.length) firebase.initializeApp(window.SPIDER_FIREBASE_CONFIG); auth = firebase.auth(); auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(() => {}); }
    catch (e) { message("Firebase could not initialise: " + e.message, true); resolveReady(null); return; }
    document.getElementById("spiderGoogleLogin")?.addEventListener("click", e => busy(e.currentTarget, async () => {
      const p = new firebase.auth.GoogleAuthProvider(); p.setCustomParameters({ prompt: "select_account" });
      try { await auth.signInWithPopup(p); }
      catch (err) { if (["auth/popup-blocked","auth/popup-closed-by-user","auth/cancelled-popup-request"].includes(err.code)) await auth.signInWithRedirect(p); else if (err.code === "auth/account-exists-with-different-credential") { pendingGoogleCredential = firebase.auth.GoogleAuthProvider.credentialFromError(err); message("This owner email already has an email/password login. Sign in with email below to link Google.", true); }
        else throw err; }
    }));
    document.getElementById("spiderEmailLogin")?.addEventListener("click", e => busy(e.currentTarget, async () => {
      const value = (email?.value || "").trim().toLowerCase();
      if (value !== ownerEmail) throw new Error("Use the configured SPIDER owner email address.");
      const result = await auth.signInWithEmailAndPassword(value, password?.value || "");
      if (!result.user.emailVerified) { await result.user.sendEmailVerification(); await auth.signOut(); throw new Error("Email verification link sent. Verify your email, then sign in again."); }
      if (pendingGoogleCredential) { await result.user.linkWithCredential(pendingGoogleCredential); pendingGoogleCredential = null; }
      if (password) password.value = "";
    }));
    document.getElementById("spiderLinkEmail")?.addEventListener("click", async () => {
      const secret = window.prompt("Create a password for your SPIDER owner account (minimum 12 characters).");
      if (secret === null) return;
      if (secret.length < 12) { message("Use a password with at least 12 characters.", true); return; }
      try {
        const credential = firebase.auth.EmailAuthProvider.credential(ownerEmail, secret);
        await auth.currentUser.linkWithCredential(credential);
        message("Email/password sign-in is now linked to this owner account.", false);
        setAuthenticated(auth.currentUser);
      } catch (error) { message(error.message || "Could not link email/password sign-in.", true); }
    });
    document.getElementById("spiderSignOut")?.addEventListener("click", () => auth.signOut().catch(e => message(e.message, true)));
    auth.getRedirectResult().catch(error => {
      if (error.code === "auth/account-exists-with-different-credential") {
        pendingGoogleCredential = firebase.auth.GoogleAuthProvider.credentialFromError(error);
        message("This owner email already has an email/password login. Sign in with email below to link Google.", true);
      } else message(error.message, true);
    });
    auth.onAuthStateChanged(setAuthenticated);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true }); else init();
})();