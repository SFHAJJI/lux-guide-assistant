// The proxy: holds the model key, runs the pipeline server-side (prompts are assembled here, never in the browser),
// logs every question without any personal data, rate-limits per visitor, and caps the model calls per day.
// When the cap is reached or no key is configured, it answers in local mode, exactly as the browser would.
import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { loadTables } from "../core/tables.js";
import { loadDictionary } from "../core/dictionary.js";
import { answerQuestion } from "../core/pipeline.js";
import { toReply } from "../core/reply.js";
import { createLlm } from "./llm.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const idx = join(root, "data", "index");
const T = loadTables(JSON.parse(readFileSync(join(idx, "tables.json"), "utf8")));
const D = loadDictionary(existsSync(join(idx, "dictionary.json")) ? JSON.parse(readFileSync(join(idx, "dictionary.json"), "utf8")) : { concepts: [], patterns: [] });
const coverage = existsSync(join(idx, "coverage.json")) ? JSON.parse(readFileSync(join(idx, "coverage.json"), "utf8")) : null;
const llm = createLlm();
const PORT = Number(process.env.PORT || 8787);
const DAILY_CAP = Number(process.env.DAILY_CAP || 600);
const RATE_PER_MIN = Number(process.env.RATE_PER_MIN || 20);
const ORIGINS = (process.env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
const LOG_DIR = process.env.LOG_DIR || join(root, "proxy", "log");
mkdirSync(LOG_DIR, { recursive: true });

const day = () => new Date().toISOString().slice(0, 10);
let calls = { day: day(), model: 0, questions: 0 };
const buckets = new Map(); // hashed visitor -> timestamps of the last minute

function visitorKey(req) {
  const ip = (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim();
  return createHash("sha256").update(day() + "|" + ip + "|" + (process.env.SALT || "lux")).digest("hex").slice(0, 16);
}
function limited(key) {
  const now = Date.now();
  const arr = (buckets.get(key) || []).filter((t) => now - t < 60000);
  if (arr.length >= RATE_PER_MIN) { buckets.set(key, arr); return true; }
  arr.push(now); buckets.set(key, arr);
  if (buckets.size > 5000) buckets.clear();
  return false;
}
function rollDay() { if (calls.day !== day()) calls = { day: day(), model: 0, questions: 0 }; }
function log(file, obj) { try { appendFileSync(join(LOG_DIR, file), JSON.stringify(obj) + "\n"); } catch { /* ephemeral disk */ } }

function cors(req, res) {
  const origin = req.headers.origin;
  if (origin && (ORIGINS.length === 0 || ORIGINS.includes(origin))) {
    res.setHeader("access-control-allow-origin", origin);
    res.setHeader("vary", "origin");
  }
  res.setHeader("access-control-allow-methods", "GET, POST, OPTIONS");
  res.setHeader("access-control-allow-headers", "content-type");
  res.setHeader("access-control-max-age", "600");
}
function send(res, status, obj) { res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }); res.end(JSON.stringify(obj)); }
function body(req) { return new Promise((resolve, reject) => { let s = ""; req.on("data", (c) => { s += c; if (s.length > 20000) { reject(new Error("too large")); req.destroy(); } }); req.on("end", () => { try { resolve(s ? JSON.parse(s) : {}); } catch (e) { reject(e); } }); }); }

const server = createServer(async (req, res) => {
  cors(req, res);
  const url = new URL(req.url, "http://x");
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }
  rollDay();
  if (req.method === "GET" && url.pathname === "/health") {
    return send(res, 200, { ok: true, model: !!llm, provider: llm ? llm.provider : "none", model_name: llm ? llm.model : null, day: calls.day, model_calls_today: calls.model, questions_today: calls.questions, cap: DAILY_CAP, index: coverage ? coverage.index_sha256 : null, fiches: T.fiche.length, blocs: T.bloc.length, concepts: D.concepts.length });
  }
  if (req.method === "POST" && url.pathname === "/feedback") {
    try { const b = await body(req); log("feedback.jsonl", { at: new Date().toISOString(), question: String(b.question || "").slice(0, 300), verdict: b.verdict, primary: b.primary, page: b.page }); } catch { /* ignore */ }
    return send(res, 200, { ok: true });
  }
  if (req.method === "POST" && url.pathname === "/answer") {
    const key = visitorKey(req);
    if (limited(key)) return send(res, 429, { error: "rate limited" });
    let b;
    try { b = await body(req); } catch (e) { return send(res, 400, { error: "bad request" }); }
    const question = String(b.question || "").slice(0, 500);
    if (!question.trim()) return send(res, 400, { error: "empty question" });
    const useModel = !!llm && calls.model < DAILY_CAP;
    const t0 = Date.now();
    try {
      const result = await answerQuestion({ question, page: String(b.page || "").slice(0, 80), profile: b.profile && typeof b.profile === "object" ? { statut: b.profile.statut } : null, previous: b.previous && b.previous.fiche_id ? { fiche_id: String(b.previous.fiche_id) } : null }, { T, D, coverage, llm: useModel ? llm : null });
      calls.questions++; calls.model += result.audit.model_calls_count || 0;
      const reply = toReply(result, T, { mode: useModel ? "proxy" : "local" });
      if (!useModel && llm) reply.notice = "cap reached";
      log("questions.jsonl", { at: new Date().toISOString(), visitor: key, question, page: b.page || null, kind: result.kind, verdict: result.R?.verdict || null, route: result.R?.route || null, primary: result.R?.primary ? { fiche_id: result.R.primary.fiche_id, section_id: result.R.primary.section_id } : null, confidence: result.R?.confidence ?? null, model_calls: result.audit.model_calls, generated_by: result.audit.generated_by || null, validation: result.audit.validation?.status || null, discovered_keywords: result.answer?.discovered_keywords || [], ms: Date.now() - t0, prompt_version: result.audit.prompt_version || null, index: coverage?.index_sha256 || null });
      return send(res, 200, reply);
    } catch (e) {
      log("errors.jsonl", { at: new Date().toISOString(), question, error: String(e && e.stack || e).slice(0, 600) });
      return send(res, 500, { error: "pipeline failed" });
    }
  }
  send(res, 404, { error: "not found" });
});
server.listen(PORT, () => console.log(`proxy on :${PORT}  model=${llm ? llm.provider + "/" + llm.model : "none"}  cap=${DAILY_CAP}/day  origins=${ORIGINS.join(",") || "*"}`));
