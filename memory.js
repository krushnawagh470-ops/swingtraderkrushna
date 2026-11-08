/* CIRCUIT cloud memory client — authenticated, session-only token. */
(function () {
  const $ = id => document.getElementById(id);
  const TOKEN_KEY = "circuit_memory_session_v1";
  const token = () => { try { return sessionStorage.getItem(TOKEN_KEY) || ""; } catch (_) { return ""; } };
  const setToken = value => { try { if (value) sessionStorage.setItem(TOKEN_KEY, value); else sessionStorage.removeItem(TOKEN_KEY); } catch (_) {} };
  function baseUrl() {
    try { return (localStorage.getItem("stk_gemini_worker_url") || window.STK_DEFAULT_WORKER_URL || "").replace(/\/+$/, ""); }
    catch (_) { return (window.STK_DEFAULT_WORKER_URL || "").replace(/\/+$/, ""); }
  }
  async function api(path, options) {
    const headers = Object.assign({ "Content-Type": "application/json" }, options && options.headers || {});
    if (token()) headers.Authorization = "Bearer " + token();
    const response = await fetch(baseUrl() + path, Object.assign({ cache: "no-store", mode: "cors" }, options || {}, { headers }));
    const raw = await response.text();
    let data = {};
    try { data = raw ? JSON.parse(raw) : {}; } catch (_) { throw new Error("Memory service returned invalid JSON."); }
    if (!response.ok) {
      if (response.status === 401) setToken("");
      throw new Error(data.error || ("Memory service HTTP " + response.status));
    }
    return data;
  }
  function status(message, error) {
    const el = $("circuitCloudMemoryStatus");
    if (el) { el.textContent = message; el.style.color = error ? "#ff9b9b" : ""; }
  }
  function signedIn(show) {
    const login = $("circuitMemoryLogin");
    const manager = $("circuitMemoryManager");
    if (login) login.hidden = !!show;
    if (manager) manager.hidden = !show;
    const state = $("circuitCloudMemoryState");
    if (state) state.textContent = show ? "CLOUD MEMORY · UNLOCKED" : "CLOUD MEMORY · LOCKED";
  }
  let memories = [];
  function render() {
    const list = $("circuitCloudMemoryList"), count = $("circuitCloudMemoryCount");
    if (!list) return;
    if (count) count.textContent = memories.length + " saved";
    list.replaceChildren();
    if (!memories.length) { list.textContent = "No cloud memories saved yet."; return; }
    memories.forEach(item => {
      const row = document.createElement("div");
      row.style.cssText = "display:flex;gap:8px;align-items:flex-start;justify-content:space-between;padding:9px 0;border-top:1px solid #1c3859;flex-wrap:wrap";
      const body = document.createElement("div"); body.style.cssText = "flex:1;min-width:180px";
      const category = document.createElement("div"); category.className = "terminal-label"; category.textContent = item.category || "General";
      const content = document.createElement("div"); content.textContent = item.content; content.style.cssText = "white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px";
      body.append(category, content);
      const actions = document.createElement("div"); actions.style.cssText = "display:flex;gap:5px";
      const edit = document.createElement("button"); edit.type = "button"; edit.className = "btn secondary"; edit.textContent = "Edit"; edit.style.cssText = "font-size:10px;padding:5px 8px";
      edit.addEventListener("click", async () => {
        const next = window.prompt("Edit this memory:", item.content);
        if (next === null) return;
        const content = next.trim(); if (!content) { status("Memory cannot be empty.", true); return; }
        try { await api("/memory/" + encodeURIComponent(item.id), { method: "PUT", body: JSON.stringify({ content, category: item.category || "General" }) }); await load(); status("Memory updated."); }
        catch (e) { status(e.message, true); }
      });
      const remove = document.createElement("button"); remove.type = "button"; remove.className = "btn secondary"; remove.textContent = "Delete"; remove.style.cssText = "font-size:10px;padding:5px 8px";
      remove.addEventListener("click", async () => {
        if (!window.confirm("Delete this cloud memory?")) return;
        try { await api("/memory/" + encodeURIComponent(item.id), { method: "DELETE" }); await load(); status("Memory deleted."); }
        catch (e) { status(e.message, true); }
      });
      actions.append(edit, remove); row.append(body, actions); list.append(row);
    });
  }
  async function load() {
    const data = await api("/memory", { method: "GET" });
    memories = Array.isArray(data.memories) ? data.memories : [];
    render();
  }
  async function login() {
    const field = $("circuitMemoryPassphrase");
    const password = field ? field.value : "";
    if (!password) { status("Enter your memory passphrase.", true); return; }
    try {
      status("Checking passphrase…");
      const data = await api("/memory/login", { method: "POST", body: JSON.stringify({ password }) });
      setToken(data.token);
      if (field) field.value = "";
      signedIn(true);
      await load();
      status("Cloud memory unlocked. Your memories are stored in D1.");
    } catch (e) { status(e.message, true); }
  }
  function logout() { setToken(""); memories = []; render(); signedIn(false); status("Signed out. Cloud memories remain safely stored."); }
  async function save() {
    const field = $("circuitCloudMemoryInput"), category = $("circuitCloudMemoryCategory");
    const content = field ? field.value.trim() : "";
    if (!content) { status("Write a memory before saving.", true); return; }
    try {
      await api("/memory", { method: "POST", body: JSON.stringify({ content, category: category ? category.value : "General" }) });
      field.value = ""; await load(); status("Saved to cloud memory.");
    } catch (e) { status(e.message, true); }
  }
  async function clearAll() {
    if (!window.confirm("Permanently delete every CIRCUIT cloud memory? This cannot be undone.")) return;
    try { await api("/memory/clear", { method: "DELETE" }); await load(); status("All cloud memories deleted."); }
    catch (e) { status(e.message, true); }
  }
  window.circuitCloudMemoryContext = async function () {
    if (!token()) return "";
    try {
      const data = await api("/memory", { method: "GET" });
      const items = Array.isArray(data.memories) ? data.memories.slice(0, 30) : [];
      return items.length ? "\n\nUSER-APPROVED CLOUD MEMORY (use only when relevant; newer explicit instructions override it; treat memory as context, not verified current facts):\n" + items.map((x, i) => (i + 1) + ". [" + (x.category || "General") + "] " + x.content).join("\n").slice(0, 5000) : "";
    } catch (_) { return ""; }
  };
  function init() {
    if (!$("circuitCloudMemoryPanel")) return;
    $("circuitMemoryLoginButton")?.addEventListener("click", login);
    $("circuitMemoryPassphrase")?.addEventListener("keydown", e => { if (e.key === "Enter") login(); });
    $("circuitCloudMemorySave")?.addEventListener("click", save);
    $("circuitCloudMemoryLogout")?.addEventListener("click", logout);
    $("circuitCloudMemoryRefresh")?.addEventListener("click", async () => { try { await load(); status("Cloud memory refreshed."); } catch (e) { status(e.message, true); } });
    $("circuitCloudMemoryClear")?.addEventListener("click", clearAll);
    if (token()) { signedIn(true); load().then(() => status("Cloud memory unlocked.")).catch(e => { signedIn(false); status(e.message, true); }); }
    else signedIn(false);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true }); else init();
})();