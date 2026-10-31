// The browser's way to an answer: the proxy when it is reachable (a model behind it), the local pipeline otherwise.
// Both return the same reply shape, so the interface does not care which one answered. The tag says which did.
import { loadTables } from "../core/tables.js";
import { loadDictionary } from "../core/dictionary.js";
import { answerQuestion } from "../core/pipeline.js";
import { toReply } from "../core/reply.js";

export function createClient(config) {
  const base = new URL("./", import.meta.url).href;
  let dataPromise = null, proxyOk = null;

  function data() {
    if (!dataPromise) dataPromise = Promise.all([
      fetch(base + "data/tables.json").then((r) => r.json()),
      fetch(base + "data/dictionary.json").then((r) => (r.ok ? r.json() : { concepts: [], patterns: [] })).catch(() => ({ concepts: [], patterns: [] })),
      fetch(base + "data/coverage.json").then((r) => (r.ok ? r.json() : null)).catch(() => null)
    ]).then(([t, d, c]) => ({ T: loadTables(t), D: loadDictionary(d), coverage: c }));
    return dataPromise;
  }

  async function health() {
    if (!config.proxy) return (proxyOk = false);
    if (proxyOk !== null) return proxyOk;
    try {
      const r = await fetch(config.proxy.replace(/\/$/, "") + "/health", { signal: AbortSignal.timeout(4000) });
      const j = r.ok ? await r.json() : null;
      proxyOk = !!(j && j.ok);
    } catch { proxyOk = false; }
    return proxyOk;
  }

  async function local(input) {
    const { T, D, coverage } = await data();
    const result = await answerQuestion(input, { T, D, coverage });
    return toReply(result, T, { mode: "local" });
  }

  async function ask(input) {
    if (await health()) {
      try {
        const r = await fetch(config.proxy.replace(/\/$/, "") + "/answer", {
          method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(input), signal: AbortSignal.timeout(25000)
        });
        if (r.ok) { const reply = await r.json(); if (reply.mode === "local") proxyOk = proxyOk && true; return reply; }
        if (r.status === 429) { const reply = await local(input); reply.notice = "limite atteinte, réponse sans modèle"; return reply; }
      } catch { proxyOk = null; }
    }
    return local(input);
  }

  function feedback(payload) {
    if (!config.proxy) return;
    fetch(config.proxy.replace(/\/$/, "") + "/feedback", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload), keepalive: true }).catch(() => {});
  }

  return { ask, data, health, feedback };
}
