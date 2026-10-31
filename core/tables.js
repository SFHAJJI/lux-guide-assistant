// The relational index in memory: fiche, section, bloc, faq, link, parcours, plus the folded forms used for matching
// and the corpus vocabulary used for typo correction. Loaded once, in the proxy and in the browser alike.
import { fold, rawTokens, stems, tokens } from "./text.js";

const VALUE_RE = /\d|€|gratuit/i;

export function loadTables(raw) {
  const T = { raw, built_at: raw.built_at, upstream: raw.upstream, verifie: raw.verifie,
    fiche: raw.fiche, section: raw.section, bloc: raw.bloc, faq: raw.faq, link: raw.link || [], parcours: raw.parcours || [],
    ficheById: new Map(), sectionById: new Map(), blocById: new Map(), blocsByFiche: new Map(), sectionsByFiche: new Map(), faqById: new Map(),
    vocab: new Map() };

  const addVocab = (text) => { for (const t of rawTokens(text)) if (t.length > 1) T.vocab.set(t, (T.vocab.get(t) || 0) + 1); };

  for (const f of T.fiche) {
    f._titleStems = new Set(stems(f.titre));
    f._tagStems = new Set((f.tags || []).flatMap((t) => stems(t)));
    f._tagFolds = (f.tags || []).map(fold);
    f._resumeStems = new Set(stems(f.resume || ""));
    f._fold = fold(f.titre);
    T.ficheById.set(f.id, f);
    T.blocsByFiche.set(f.id, []);
    T.sectionsByFiche.set(f.id, []);
    addVocab(f.titre); (f.tags || []).forEach(addVocab); addVocab(f.resume || "");
  }
  for (const s of T.section) {
    s._fold = fold(s.titre);
    s._stems = new Set(stems(s.titre));
    T.sectionById.set(s.section_id, s);
    T.sectionsByFiche.get(s.fiche_id)?.push(s);
    addVocab(s.titre);
  }
  for (const b of T.bloc) {
    b._fold = fold(b.text);
    b._stems = new Set(stems(b.text));
    b._hasValue = VALUE_RE.test(b.text);
    T.blocById.set(b.bloc_id, b);
    T.blocsByFiche.get(b.fiche_id)?.push(b);
    addVocab(b.text);
  }
  for (const q of T.faq) {
    q._fold = fold(q.q);
    q._stems = new Set(stems(q.q));
    q._aStems = new Set(stems(q.a));
    T.faqById.set(q.qid, q);
    addVocab(q.q); addVocab(q.a);
  }
  // Document frequency per stem, for the specificity of the reader's words: idf normalised to (0, 1].
  T.df = new Map();
  for (const b of T.bloc) for (const s of b._stems) T.df.set(s, (T.df.get(s) || 0) + 1);
  const N = T.bloc.length + 1, logN = Math.log(N);
  T.idfOf = (s) => { const d = T.df.get(s) || 0; return Math.min(1, Math.log(N / (d + 1)) / logN); };
  return T;
}

export function blocsOfSpan(T, span) {
  const a = T.blocById.get(span.bloc_start), b = T.blocById.get(span.bloc_end);
  if (!a || !b || a.fiche_id !== b.fiche_id) return [];
  return (T.blocsByFiche.get(a.fiche_id) || []).filter((x) => x.n >= a.n && x.n <= b.n);
}

export function spanText(T, span) { return blocsOfSpan(T, span).map((b) => b.text).join(" "); }

export function pathOf(T, blocId) {
  const b = T.blocById.get(blocId);
  if (!b) return null;
  const f = T.ficheById.get(b.fiche_id), s = T.sectionById.get(b.section_id);
  return { fiche_id: f.id, fiche: f.titre, section_id: s.section_id, section: s.level === 1 ? null : s.titre, tab: s.tab || null, kind: f.kind };
}

export function sectionsBlocs(T, sectionId) {
  const s = T.sectionById.get(sectionId);
  if (!s) return [];
  return (T.blocsByFiche.get(s.fiche_id) || []).filter((b) => b.n >= s.start_bloc && b.n <= s.end_bloc);
}

export function contentTokensOf(text) { return tokens(text); }
