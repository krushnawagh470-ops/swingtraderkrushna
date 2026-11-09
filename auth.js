/* SPIDER owner sign-in: Firebase Google + email/password. Server verifies every ID token. */
(function () {
  "use strict";
  const gate = document.getElementById("spiderAuthGate"), status = document.getElementById("spiderAuthStatus");
  const email = document.getElementById("spiderAuthEmail"), password = document.getElementById("spiderAuthPassword");
  const ownerEmail = String(window.SPIDER_OWNER_EMAIL || "").trim().toLowerCase();
  let auth = null, resolveReady, pendingGoogleCredential = null;
  window.spiderAuthReady = new Promise(resolve => { resolveReady = resolve; });
  function message(text, error) {
    if (status) { status.textContent = text; status.dataset.error = error ? "true" : "false"; }
    // Once the owner is signed in, the auth gate is hidden. Keep auth/linking
    // feedback visible on the dashboard instead of writing into hidden content.
    if (gate && gate.hidden) {
      let toast = document.getElementById("spiderAuthToast");
      if (!toast) {
        toast = document.createElement("div");
        toast.id = "spiderAuthToast";
        toast.setAttribute("role", "status");
        toast.setAttribute("aria-live", "polite");
        toast.style.cssText = "position:fixed;top:58px;right:12px;z-index:10001;max-width:min(420px,calc(100vw - 32px));padding:11px 14px;border:1px solid #3975a8;border-radius:8px;background:#07172a;color:#d9edff;font:12px/1.5 system-ui,sans-serif;box-shadow:0 8px 28px #0008";
        document.body.appendChild(toast);
      }
      toast.textContent = text;
      toast.style.borderColor = error ? "#b85b5b" : "#3975a8";
      toast.style.color = error ? "#ffb0b0" : "#d9edff";
    }
  }
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
    document.getElementById("spiderLinkEmail")?.addEventListener("click", () => {
      // Avoid window.prompt: it is suppressed in some Android WebViews/PWA contexts.
      let modal = document.getElementById("spiderPasswordSetup");
      if (!modal) {
        modal = document.createElement("div");
        modal.id = "spiderPasswordSetup";
        modal.setAttribute("role", "dialog");
        modal.setAttribute("aria-modal", "true");
        modal.style.cssText = "position:fixed;inset:0;z-index:2147483600;display:flex;align-items:center;justify-content:center;padding:18px;background:#020914dd;font:14px system-ui,sans-serif";
        modal.innerHTML = '<form style="width:min(100%,390px);padding:22px;border:1px solid #3975a8;border-radius:14px;background:#0b1b30;color:#eaf4ff;box-shadow:0 20px 70px #000a"><h2 style="margin:0 0 8px;font-size:19px">Enable email/password login</h2><p style="color:#a8c8e6;font-size:12px;line-height:1.5">Create a password for the same SPIDER owner account. Use at least 12 characters.</p><label for="spiderNewPassword" style="display:block;margin:14px 0 6px;font-size:11px">NEW PASSWORD</label><input id="spiderNewPassword" type="password" minlength="12" autocomplete="new-password" required style="width:100%;box-sizing:border-box;padding:12px;border:1px solid #315577;border-radius:8px;background:#061426;color:#fff"><label for="spiderConfirmPassword" style="display:block;margin:12px 0 6px;font-size:11px">CONFIRM PASSWORD</label><input id="spiderConfirmPassword" type="password" minlength="12" autocomplete="new-password" required style="width:100%;box-sizing:border-box;padding:12px;border:1px solid #315577;border-radius:8px;background:#061426;color:#fff"><div id="spiderPasswordSetupError" role="alert" style="min-height:18px;margin-top:9px;color:#ff9b9b;font-size:11px"></div><div style="display:flex;gap:9px;margin-top:10px"><button type="button" id="spiderPasswordCancel" style="flex:1;padding:11px;border:1px solid #345879;border-radius:8px;background:#10223d;color:#d9edff">Cancel</button><button type="submit" id="spiderPasswordSave" style="flex:1;padding:11px;border:0;border-radius:8px;background:#58aaff;color:#04101f;font-weight:700">Save password</button></div></form>';
        document.body.appendChild(modal);
        modal.querySelector("form").addEventListener("submit", async event => {
          event.preventDefault();
          const first = modal.querySelector("#spiderNewPassword").value;
          const second = modal.querySelector("#spiderConfirmPassword").value;
          const errorBox = modal.querySelector("#spiderPasswordSetupError");
          const save = modal.querySelector("#spiderPasswordSave");
          if (first.length < 12) { errorBox.textContent = "Use at least 12 characters."; return; }
          if (first !== second) { errorBox.textContent = "Passwords do not match."; return; }
          save.disabled = true; save.textContent = "Saving…"; errorBox.textContent = "";
          try {
            const credential = firebase.auth.EmailAuthProvider.credential(ownerEmail, first);
            await auth.currentUser.linkWithCredential(credential);
            modal.remove();
            message("Email/password sign-in is now linked to this owner account.", false);
            setAuthenticated(auth.currentUser);
          } catch (error) {
            errorBox.textContent = error.message || "Could not link email/password sign-in.";
            save.disabled = false; save.textContent = "Save password";
          }
        });
        modal.querySelector("#spiderPasswordCancel").addEventListener("click", () => modal.remove());
      }
      modal.querySelector("#spiderNewPassword").focus();
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