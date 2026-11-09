/* SPIDER cloud memory client — uses the signed-in Firebase owner session. */
(function () {
  const $ = id => document.getElementById(id);
  function baseUrl() {
    try { return (localStorage.getItem("stk_gemini_worker_url") || window.STK_DEFAULT_WORKER_URL || "").replace(/\/+$/, ""); }
    catch (_) { return (window.STK_DEFAULT_WORKER_URL || "").replace(/\/+$/, ""); }
  }
  async function api(path, options) {
    const headers = Object.assign({ "Content-Type": "application/json" }, options && options.headers || {});
    if (!window.spiderGetIdToken) throw new Error("SPIDER sign-in is not ready.");
    headers.Authorization = "Bearer " + await window.spiderGetIdToken();
    const response = await fetch(baseUrl() + path, Object.assign({ cache: "no-store", mode: "cors" }, options || {}, { headers }));
    const raw = await response.text();
    let data = {};
    try { data = raw ? JSON.parse(raw) : {}; } catch (_) { throw new Error("Memory service returned invalid JSON."); }
    if (!response.ok) {
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
  let suggestions = [];
  function ensureSuggestionUI() {
    const manager = $("circuitMemoryManager");
    if (!manager || $("circuitMemorySuggestionPanel")) return;
    const panel = document.createElement("section"); panel.id = "circuitMemorySuggestionPanel";
    panel.style.cssText = "margin-top:18px;padding-top:14px;border-top:1px solid #29435e";
    const heading = document.createElement("b"); heading.textContent = "Memory suggestions · approval required";
    const note = document.createElement("p"); note.className = "q-meta"; note.textContent = "Pending items are NOT used by SPIDER until you approve them.";
    const input = document.createElement("textarea"); input.id = "circuitMemorySuggestionInput"; input.rows = 2; input.maxLength = 1200; input.placeholder = "Add a fact or preference for review…"; input.style.cssText = "width:100%;margin-top:8px";
    const category = document.createElement("select"); category.id = "circuitMemorySuggestionCategory"; category.style.cssText = "margin-top:7px;max-width:100%";
    ["General","Preferences","Personal planning","Finance and career","Business and content","Technology and projects","Trading and investing"].forEach(v => { const o=document.createElement("option"); o.value=v; o.textContent=v; category.append(o); });
    const add = document.createElement("button"); add.type="button"; add.className="btn secondary"; add.textContent="Add to review inbox"; add.style.cssText="margin:8px 0;font-size:11px";
    add.addEventListener("click", async () => { const content=input.value.trim(); if(!content){status("Write a suggestion first.",true);return;} try { await api("/memory/suggestions",{method:"POST",body:JSON.stringify({content,category:category.value,source:"user"})}); input.value=""; await loadSuggestions(); status("Added to pending review. Not active memory yet."); } catch(e){status(e.message,true);} });
    const count=document.createElement("div"); count.id="circuitMemorySuggestionCount"; count.className="terminal-label";
    const list=document.createElement("div"); list.id="circuitMemorySuggestionList"; list.className="q-meta";
    panel.append(heading,note,input,category,document.createElement("br"),add,count,list); manager.append(panel);
  }
  function renderSuggestions() {
    const list=$("circuitMemorySuggestionList"), count=$("circuitMemorySuggestionCount"); if(!list)return;
    if(count)count.textContent=suggestions.length+" awaiting approval"; list.replaceChildren();
    if(!suggestions.length){list.textContent="No pending suggestions.";return;}
    suggestions.forEach(item=>{
      const row=document.createElement("div"); row.style.cssText="padding:10px 0;border-top:1px solid #1c3859";
      const meta=document.createElement("div"); meta.className="terminal-label"; meta.textContent=(item.category||"General")+" · "+(item.source==="assistant"?"SPIDER suggestion":"Your suggestion");
      const content=document.createElement("div"); content.textContent=item.content; content.style.cssText="white-space:pre-wrap;overflow-wrap:anywhere;font-size:12px;margin:5px 0";
      const actions=document.createElement("div"); actions.style.cssText="display:flex;gap:7px;flex-wrap:wrap";
      const approve=document.createElement("button"); approve.type="button"; approve.className="btn"; approve.textContent="Approve & save";
      approve.addEventListener("click",async()=>{if(!window.confirm("Approve and add this to active memory?"))return;try{await api("/memory/suggestions/"+encodeURIComponent(item.id)+"/approve",{method:"POST"});await load();await loadSuggestions();status("Approved and saved to active memory.");}catch(e){status(e.message,true);}});
      const reject=document.createElement("button"); reject.type="button"; reject.className="btn secondary"; reject.textContent="Reject";
      reject.addEventListener("click",async()=>{if(!window.confirm("Reject this suggestion?"))return;try{await api("/memory/suggestions/"+encodeURIComponent(item.id),{method:"DELETE"});await loadSuggestions();status("Suggestion rejected.");}catch(e){status(e.message,true);}});
      actions.append(approve,reject); row.append(meta,content,actions); list.append(row);
    });
  }
  async function loadSuggestions(){const data=await api("/memory/suggestions",{method:"GET"});suggestions=Array.isArray(data.suggestions)?data.suggestions:[];renderSuggestions();}
  function render() {
    ensureSuggestionUI();
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
  function logout() { if (window.spiderSignOut) window.spiderSignOut().catch(e => status(e.message, true)); }
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
    if (!window.spiderGetIdToken) return "";
    try {
      const data = await api("/memory", { method: "GET" });
      const items = Array.isArray(data.memories) ? data.memories.slice(0, 30) : [];
      return items.length ? "\n\nUSER-APPROVED CLOUD MEMORY (use only when relevant; newer explicit instructions override it; treat memory as context, not verified current facts):\n" + items.map((x, i) => (i + 1) + ". [" + (x.category || "General") + "] " + x.content).join("\n").slice(0, 5000) : "";
    } catch (_) { return ""; }
  };
  function init() {
    if (!$("circuitCloudMemoryPanel")) return;
    $("circuitCloudMemorySave")?.addEventListener("click", save);
    $("circuitCloudMemoryLogout")?.addEventListener("click", logout);
    $("circuitCloudMemoryRefresh")?.addEventListener("click", async () => { try { await load(); status("Cloud memory refreshed."); } catch (e) { status(e.message, true); } });
    $("circuitCloudMemoryClear")?.addEventListener("click", clearAll);
    ensureSuggestionUI();
    window.addEventListener("spider-auth-state", event => {
      const user = event.detail && event.detail.user;
      signedIn(Boolean(user));
      if (user) Promise.all([load(),loadSuggestions()]).then(() => status("Cloud memory unlocked for " + user.email + ".")).catch(e => status(e.message, true));
      else { memories = []; suggestions=[]; render(); renderSuggestions(); status("Sign in to SPIDER to unlock cloud memory."); }
    });
    window.spiderAuthReady?.then(user => {
      signedIn(Boolean(user));
      if (user) Promise.all([load(),loadSuggestions()]).then(() => status("Cloud memory unlocked.")).catch(e => status(e.message, true));
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true }); else init();
})();