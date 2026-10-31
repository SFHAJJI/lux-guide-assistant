// Evaluation per slice, never one number. Runs the labelled set (eval/questions.yaml) plus the guide's 55 FAQ entries
// through the pipeline, with or without a model (LLM_* env vars), and writes eval/report.md and eval/report.json.
//   node eval/run.mjs            no model (the deterministic path, as in CI)
//   node eval/run.mjs --model    with the model configured in the environment
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import { loadTables } from "../core/tables.js";
import { loadDictionary } from "../core/dictionary.js";
import { answerQuestion } from "../core/pipeline.js";
import { createLlm } from "../proxy/llm.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const idx = join(root, "data", "index");
const T = loadTables(JSON.parse(readFileSync(join(idx, "tables.json"), "utf8")));
const D = loadDictionary(existsSync(join(idx, "dictionary.json")) ? JSON.parse(readFileSync(join(idx, "dictionary.json"), "utf8")) : { concepts: [], patterns: [] });
const coverage = JSON.parse(readFileSync(join(idx, "coverage.json"), "utf8"));
const useModel = process.argv.includes("--model");
const llm = useModel ? createLlm() : null;
if (useModel && !llm) throw new Error("--model asked but no LLM_* configuration");

const set = parseYaml(readFileSync(join(root, "eval", "questions.yaml"), "utf8")).questions;
const faqQs = T.faq.filter((f) => f.fiche_id).map((f) => ({ id: f.qid, slice: "faq", q: f.q, expect: { fiche: f.fiche_id, span: f.span } }));
const all = [...set, ...faqQs];

const rows = [];
for (const item of all) {
  const t0 = Date.now();
  const r = await answerQuestion({ question: item.q, page: item.page || null }, { T, D, llm, coverage });
  const ms = Date.now() - t0;
  const ex = item.expect || {};
  const primary = r.R?.primary || null;
  const checks = {};
  if (ex.kind) checks.kind = r.kind === ex.kind;
  if (ex.verdict) checks.verdict = ex.verdict === "precisez" ? r.kind === "precisez" : (r.R?.verdict === ex.verdict || (ex.verdict === "pas_dans_le_guide" && r.kind === "absence"));
  if (ex.fiche) checks.fiche = primary?.fiche_id === ex.fiche;
  if (ex.fiche_any) checks.fiche = ex.fiche_any.includes(primary?.fiche_id);
  if (ex.section && primary) { const s = T.sectionById.get(primary.section_id); checks.section = !!s && s.titre.toLowerCase().includes(ex.section.toLowerCase()); }
  if (ex.span && primary?.span) { const a = T.blocById.get(primary.span.bloc_start), b = T.blocById.get(primary.span.bloc_end); checks.span = !!a && !(b.n < ex.span.bloc_start || a.n > ex.span.bloc_end); }
  const quoteOk = r.kind !== "answer" ? null : r.answer.items.every((it) => (it.spans || []).every((sp) => !sp.quote || T.blocById.get(sp.bloc_start)));
  const ok = Object.values(checks).every(Boolean);
  rows.push({ id: item.id, slice: item.slice, q: item.q, page: item.page || null, kind: r.kind, verdict: r.R?.verdict || null, route: r.R?.route || null, primary: primary ? `${primary.fiche_id} ${primary.section_id}` : null, expected: ex.fiche || ex.fiche_any?.join("|") || ex.verdict || ex.kind, checks, ok, model_calls: r.audit.model_calls_count, generated_by: r.audit.generated_by || null, validation: r.audit.validation?.status || null, quote_ok: quoteOk, ms });
}

const slices = [...new Set(rows.map((r) => r.slice))];
const pct = (a, b) => (b ? Math.round((100 * a) / b) : 0) + " %";
const med = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };
const lines = [];
lines.push(`# Évaluation par tranche`, ``, `Générée le ${new Date().toISOString()} sur l'index \`${coverage.index_sha256}\` (${coverage.fiches} fiches, ${coverage.blocs} blocs, dictionnaire ${coverage.dictionary ? coverage.dictionary.concepts + " concepts" : "absent"}), ${useModel ? "avec modèle " + llm.provider + "/" + llm.model : "sans modèle"}.`, ``, `${rows.length} questions ; ${pct(rows.filter((r) => r.ok).length, rows.length)} conformes à l'attendu ; ${rows.reduce((a, r) => a + r.model_calls, 0)} appels modèle au total (${(rows.reduce((a, r) => a + r.model_calls, 0) / rows.length).toFixed(2)} par question) ; médiane ${med(rows.map((r) => r.ms))} ms.`, ``);
lines.push(`| tranche | n | conforme | fiche | verdict | span | appels modèle / q | médiane ms |`, `|---|---:|---:|---:|---:|---:|---:|---:|`);
for (const s of slices) {
  const rs = rows.filter((r) => r.slice === s);
  const f = rs.filter((r) => "fiche" in r.checks), v = rs.filter((r) => "verdict" in r.checks), sp = rs.filter((r) => "span" in r.checks);
  lines.push(`| ${s} | ${rs.length} | ${pct(rs.filter((r) => r.ok).length, rs.length)} | ${f.length ? pct(f.filter((r) => r.checks.fiche).length, f.length) : "–"} | ${v.length ? pct(v.filter((r) => r.checks.verdict).length, v.length) : "–"} | ${sp.length ? pct(sp.filter((r) => r.checks.span).length, sp.length) : "–"} | ${(rs.reduce((a, r) => a + r.model_calls, 0) / rs.length).toFixed(2)} | ${med(rs.map((r) => r.ms))} |`);
}
lines.push(``, `## Les écarts`, ``);
const bad = rows.filter((r) => !r.ok);
if (!bad.length) lines.push(`Aucun.`);
else { lines.push(`| id | tranche | question | obtenu | attendu |`, `|---|---|---|---|---|`); for (const r of bad) lines.push(`| ${r.id} | ${r.slice} | ${r.q.replace(/\|/g, "/")} | ${r.kind}${r.verdict ? " · " + r.verdict : ""}${r.primary ? " · " + r.primary : ""} | ${r.expected} |`); }
lines.push(``, `## Toutes les questions`, ``, `| id | tranche | page | question | verdict | fiche › section | appels | ms | ok |`, `|---|---|---|---|---|---|---:|---:|:-:|`);
for (const r of rows) lines.push(`| ${r.id} | ${r.slice} | ${r.page || ""} | ${r.q.replace(/\|/g, "/")} | ${r.kind === "answer" || r.kind === "absence" ? r.verdict : r.kind} | ${r.primary || ""} | ${r.model_calls} | ${r.ms} | ${r.ok ? "✓" : "✗"} |`);
writeFileSync(join(root, "eval", useModel ? "report-model.md" : "report.md"), lines.join("\n") + "\n");
writeFileSync(join(root, "eval", useModel ? "report-model.json" : "report.json"), JSON.stringify({ at: new Date().toISOString(), index: coverage.index_sha256, model: useModel ? llm.model : null, rows }, null, 1));
console.log(lines.slice(0, 6 + slices.length + 2).join("\n"));
console.log(`\n${bad.length} écart(s)`);
if (process.argv.includes("--strict") && bad.length) process.exit(1);
