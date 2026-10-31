// Brick 1, document parsing: the guide's knowledge base becomes relational tables.
// Reads upstream/app/kb.js, app/fiches/vehicule.js and app/guide.js in a sandbox (no DOM, no network) and writes
// data/index/tables.json (fiche, section, bloc, faq, link, parcours) and data/index/coverage.json.
// The bloc is the citation unit: every answer and every candidate points at bloc ids, never at model text.
import vm from "node:vm";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as parseYaml } from "yaml";
import { stems } from "../core/text.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const up = join(root, "upstream");
const out = join(root, "data", "index");
mkdirSync(out, { recursive: true });

// ---------- 1. Load the guide's data in a sandbox ----------
const ctx = vm.createContext({ window: {}, console: { log() {}, warn() {} } });
for (const rel of ["app/fiches/vehicule.js", "app/kb.js", "app/guide.js"]) {
  vm.runInContext(readFileSync(join(up, rel), "utf8"), ctx, { filename: rel });
}
const KB = ctx.window.KB;
const FicheGuide = ctx.window.FicheGuide;
if (!KB || !KB.fiches || !KB.faq || !KB.timeline) throw new Error("KB not loaded");

// ---------- 2. Tables ----------
const fiche = [], section = [], bloc = [], faq = [], link = [], parcours = [];
const words = (s) => String(s).split(/\s+/).filter(Boolean).length;

function addFiche(f) {
  const kind = f.guide ? "guidee" : "article";
  let nb = 0, ns = 0;
  const F = { id: f.id, titre: f.titre, cat: f.cat, resume: f.resume || "", tags: f.tags || [], sources: f.sources || [], kind, verifie: KB.meta?.verifie || null };
  const sec = (titre, level, extra = {}) => {
    const s = { section_id: `${f.id}#s${ns}`, fiche_id: f.id, titre, level, start_bloc: nb + 1, end_bloc: nb, ...extra };
    ns++; section.push(s); return s;
  };
  const push = (text, kindB, cur, locator) => {
    const t = String(text).replace(/\s+/g, " ").trim();
    if (!t) return;
    nb++;
    bloc.push({ bloc_id: `${f.id}#b${nb}`, n: nb, fiche_id: f.id, section_id: cur.section_id, kind: kindB, text: t, locator });
    cur.end_bloc = nb;
  };

  let cur = sec(f.titre, 1);
  if (f.resume) push(f.resume, "chapo", cur, { kind: "chapo" });

  if (kind === "article") {
    let pi = 0, hi = 0;
    for (const p of f.corps || []) {
      if (p && typeof p === "object" && p.h) { cur = sec(p.h, 2, { locator: { kind: "h", index: hi++ } }); continue; }
      push(p, "p", cur, { kind: "p", index: pi++ });
    }
    for (const t of f.tableaux || []) {
      cur = sec(t.titre, 2, { table: true });
      t.lignes.forEach((l, ri) => push(l.map((c, i) => `${t.colonnes[i]} : ${c}`).join(" | "), "row", cur, { kind: "row", table: t.titre, index: ri }));
    }
  } else {
    // Guided fiche: the same derived text his site uses for search (FicheGuide.texte), tracked per tab.
    const g = f.guide;
    if (g.reperes) { cur = sec("Repères", 2); FicheGuide.texte({ reperes: g.reperes }).forEach((t, i) => push(t, "guide", cur, { kind: "repere", index: i })); }
    if (g.cas) {
      cur = sec(g.cas.titre, 2);
      FicheGuide.texte({ cas: g.cas }).filter((x) => typeof x === "string").forEach((t, i) => push(t, "guide", cur, { kind: "cas", index: i }));
    }
    for (const o of g.onglets || []) {
      cur = sec(o.titre, 2, { tab: o.id });
      FicheGuide.texte({ onglets: [o] }).filter((x) => typeof x === "string").forEach((t, i) => push(t, "guide", cur, { kind: "onglet", tab: o.id, index: i }));
    }
  }
  if (f.aRetenir && f.aRetenir.length) {
    cur = sec("À retenir", 2, { retenir: true });
    f.aRetenir.forEach((x, i) => push(x, "retenir", cur, { kind: "retenir", index: i }));
  }
  F.n_blocs = nb; F.n_sections = ns;
  F.words = bloc.filter((b) => b.fiche_id === f.id).reduce((a, b) => a + words(b.text), 0);
  fiche.push(F);
}
KB.fiches.forEach(addFiche);
const ficheIds = new Set(fiche.map((f) => f.id));

// The installation timeline as a virtual fiche "parcours": listing questions about the steps are answerable.
{
  const f = { id: "parcours", titre: "Parcours d'installation", cat: "Parcours", resume: "Les démarches dans l'ordre, celles qui conditionnent les autres d'abord.", tags: ["parcours", "étapes", "démarches", "chronologie", "avant le départ", "premiers jours"], sources: [], kind: "parcours", verifie: KB.meta?.verifie || null };
  let nb = 0, ns = 0;
  const first = `parcours#s${ns}`;
  section.push({ section_id: first, fiche_id: "parcours", titre: f.titre, level: 1, start_bloc: 1, end_bloc: 1 });
  bloc.push({ bloc_id: `parcours#b${++nb}`, n: nb, fiche_id: "parcours", section_id: first, kind: "chapo", text: f.resume, locator: { kind: "parcours" } });
  ns++;
  for (const ph of KB.timeline) {
    const s = { section_id: `parcours#s${ns++}`, fiche_id: "parcours", titre: ph.phase, level: 2, start_bloc: nb + 1, end_bloc: nb };
    section.push(s);
    for (const it of ph.items) {
      nb++;
      bloc.push({ bloc_id: `parcours#b${nb}`, n: nb, fiche_id: "parcours", section_id: s.section_id, kind: "etape", text: it.t, locator: { kind: "parcours", phase: ph.phase }, fiche_ref: it.fiche || null, si: it.si || null });
      s.end_bloc = nb;
      parcours.push({ bloc_id: `parcours#b${nb}`, phase: ph.phase, text: it.t, fiche_id: it.fiche || null, si: it.si || null });
      if (it.fiche && ficheIds.has(it.fiche)) link.push({ from: `parcours#b${nb}`, to: it.fiche, kind: "etape" });
    }
  }
  f.n_blocs = nb; f.n_sections = ns; f.words = parcours.reduce((a, p) => a + words(p.text), 0);
  fiche.push(f);
  ficheIds.add("parcours");
}

// ---------- 3. FAQ with its backing span (sentence overlap, deterministic) ----------
const blocsByFiche = new Map();
for (const b of bloc) { if (!blocsByFiche.has(b.fiche_id)) blocsByFiche.set(b.fiche_id, []); blocsByFiche.get(b.fiche_id).push(b); }
const stemSet = (t) => new Set(stems(t));
KB.faq.forEach((e, i) => {
  const qid = `faq#${i + 1}`;
  const row = { qid, q: e.q, a: e.a, fiche_id: ficheIds.has(e.fiche) ? e.fiche : null, fiche_declared: e.fiche, span: null, overlap: 0 };
  if (row.fiche_id) {
    link.push({ from: qid, to: row.fiche_id, kind: "faq" });
    const A = stemSet(e.a);
    const bs = blocsByFiche.get(row.fiche_id) || [];
    let best = null;
    for (let k = 0; k < bs.length; k++) {
      for (const len of [1, 2]) {
        if (k + len > bs.length) break;
        const union = new Set();
        for (let j = k; j < k + len; j++) for (const s of stemSet(bs[j].text)) union.add(s);
        let hit = 0; for (const s of A) if (union.has(s)) hit++;
        const ov = (hit / Math.max(1, A.size)) - (len - 1) * 0.05;
        if (!best || ov > best.ov) best = { ov, start: bs[k].n, end: bs[k + len - 1].n };
      }
    }
    if (best && best.ov >= 0.3) { row.span = { bloc_start: best.start, bloc_end: best.end }; row.overlap = Math.round(best.ov * 100) / 100; }
  }
  faq.push(row);
});

// ---------- 4. Links: a fiche naming another fiche's title in its text, and the guided fiche's own links ----------
const titles = fiche.filter((f) => f.kind !== "parcours").map((f) => ({ id: f.id, t: f.titre.toLowerCase() }));
for (const b of bloc) {
  const low = b.text.toLowerCase();
  for (const t of titles) if (t.id !== b.fiche_id && low.includes(`« ${t.t} »`)) link.push({ from: b.bloc_id, to: t.id, kind: "mention" });
}
(function walk(o) {
  if (!o || typeof o !== "object") return;
  if (Array.isArray(o)) return o.forEach(walk);
  if (o.lien && o.lien.fiche && ficheIds.has(o.lien.fiche)) link.push({ from: "vehicule", to: o.lien.fiche, kind: "lien" });
  Object.values(o).forEach(walk);
})(KB.fiches.find((f) => f.guide)?.guide);

// ---------- 5. The expert dictionary, compiled from YAML ----------
let dictionary = null;
const dictPath = join(root, "data", "dictionary.yaml");
if (existsSync(dictPath)) {
  dictionary = parseYaml(readFileSync(dictPath, "utf8"));
  const bad = dictionary.concepts.flatMap((c) => (c.fiches || []).filter((id) => !ficheIds.has(id)).map((id) => `${c.id} → ${id}`));
  if (bad.length) throw new Error("dictionary routes to unknown fiches: " + bad.join(", "));
  writeFileSync(join(out, "dictionary.json"), JSON.stringify(dictionary));
}

// ---------- 6. Write ----------
const manifest = JSON.parse(readFileSync(join(root, "build", "manifest.json"), "utf8"));
const tables = { built_at: new Date().toISOString(), upstream: manifest.upstream, verifie: KB.meta?.verifie || null, fiche, section, bloc, faq, link, parcours };
const json = JSON.stringify(tables);
writeFileSync(join(out, "tables.json"), json);
const coverage = {
  built_at: tables.built_at,
  upstream_commit: manifest.upstream.commit,
  index_sha256: createHash("sha256").update(json).digest("hex").slice(0, 12),
  fiches: fiche.length, sections: section.length, blocs: bloc.length,
  words: fiche.reduce((a, f) => a + f.words, 0),
  faq: faq.length, faq_with_span: faq.filter((x) => x.span).length, faq_unresolved_fiche: faq.filter((x) => !x.fiche_id).map((x) => x.fiche_declared),
  parcours_steps: parcours.length, links: link.length,
  sources: fiche.reduce((a, f) => a + (f.sources || []).length, 0),
  dictionary: dictionary ? { concepts: dictionary.concepts.length, patterns: (dictionary.patterns || []).length } : null,
  per_fiche: fiche.map((f) => ({ id: f.id, kind: f.kind, sections: f.n_sections, blocs: f.n_blocs, words: f.words }))
};
writeFileSync(join(out, "coverage.json"), JSON.stringify(coverage, null, 2));
console.log(`fiches ${coverage.fiches}  sections ${coverage.sections}  blocs ${coverage.blocs}  words ${coverage.words}  faq ${coverage.faq} (${coverage.faq_with_span} with a span)  steps ${coverage.parcours_steps}  links ${coverage.links}  index ${coverage.index_sha256}`);
