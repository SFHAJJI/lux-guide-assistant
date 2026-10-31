// The restitution: what the reader sees in the conversation. Native bubbles of the site (.msg.bot / .msg.me),
// plus the answer card: verdict, short text, the quote with its path, the actions, and the audit drawer.

const L = {
  fr: { ici: "Sur cette fiche", ailleurs: "Sur une autre fiche", trouve: "Dans le guide", faq: "Question déjà traitée par le guide", absent: "Pas dans le guide", voir: "Voir le passage", ouvrir: "Ouvrir la fiche", source: "Source officielle", pourquoi: "Pourquoi ce passage", pasca: "Ce n'est pas ça", merci: "Noté, merci : la question est consignée pour l'auteur du guide.", lu: "Lu", cherche: "Cherché", proche: "Le plus proche", suggestion: "Suggestion", passages: "passages", aucun: "aucun", partiel: "Réponse peut-être partielle : ouvrez la fiche.", conflit: "Deux passages se contredisent : les deux sont cités.", local: "réponse sans modèle", modele: "réponse rédigée par le modèle, vérifiée contre le guide", extrait: "extrait du guide, en français", section: "la section", passage: "le passage" },
  en: { ici: "On this page", ailleurs: "On another page", trouve: "In the guide", faq: "A question the guide already answers", absent: "Not in the guide", voir: "Show the passage", ouvrir: "Open the page", source: "Official source", pourquoi: "Why this passage", pasca: "That's not it", merci: "Noted, thank you: the question is logged for the guide's author.", lu: "Read", cherche: "Searched", proche: "Closest", suggestion: "Suggestion", passages: "passages", aucun: "none", partiel: "Possibly partial: open the page.", conflit: "Two passages disagree: both are quoted.", local: "answer without a model", modele: "written by the model, checked against the guide", extrait: "excerpt from the guide, in French", section: "the section", passage: "the passage" },
  de: { ici: "Auf dieser Seite", ailleurs: "Auf einer anderen Seite", trouve: "Im Guide", faq: "Eine Frage, die der Guide schon beantwortet", absent: "Nicht im Guide", voir: "Stelle zeigen", ouvrir: "Seite öffnen", source: "Offizielle Quelle", pourquoi: "Warum diese Stelle", pasca: "Das ist es nicht", merci: "Notiert, danke.", lu: "Gelesen", cherche: "Gesucht", proche: "Am nächsten", suggestion: "Vorschlag", passages: "Stellen", aucun: "keine", partiel: "Möglicherweise unvollständig: Seite öffnen.", conflit: "Zwei Stellen widersprechen sich: beide sind zitiert.", local: "Antwort ohne Modell", modele: "vom Modell verfasst, gegen den Guide geprüft", extrait: "Auszug aus dem Guide, auf Französisch", section: "den Abschnitt", passage: "die Stelle" },
  pt: { ici: "Nesta ficha", ailleurs: "Noutra ficha", trouve: "No guia", faq: "Pergunta já tratada pelo guia", absent: "Não está no guia", voir: "Ver a passagem", ouvrir: "Abrir a ficha", source: "Fonte oficial", pourquoi: "Porquê esta passagem", pasca: "Não é isso", merci: "Anotado, obrigado.", lu: "Lido", cherche: "Procurado", proche: "O mais próximo", suggestion: "Sugestão", passages: "passagens", aucun: "nenhuma", partiel: "Resposta talvez parcial: abra a ficha.", conflit: "Duas passagens contradizem-se: ambas citadas.", local: "resposta sem modelo", modele: "redigida pelo modelo, verificada contra o guia", extrait: "excerto do guia, em francês", section: "a secção", passage: "a passagem" }
};

export function t(lang, key) { return (L[lang] || L.fr)[key] || L.fr[key] || key; }

export function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined && text !== null) e.textContent = text;
  return e;
}

export function logs() { return [document.getElementById("chat-log"), document.getElementById("widget-log")].filter(Boolean); }

export function bubble(text, who) {
  return logs().map((log) => { const m = el("div", "msg " + who); m.appendChild(document.createTextNode(text)); log.appendChild(m); log.scrollTop = log.scrollHeight; return m; });
}

export function waiting() {
  return logs().map((log) => { const m = el("div", "msg bot attente"); const p = el("span", "points"); p.innerHTML = "<span></span><span></span><span></span>"; m.appendChild(p); log.appendChild(m); log.scrollTop = log.scrollHeight; return m; });
}

export function chips(list) {
  const c = el("div", "chips");
  for (const ch of list) {
    const b = ch.href ? el("a", "chip", ch.label) : el("button", "chip" + (ch.ghost ? " ghost" : ""), ch.label);
    if (ch.href) { b.href = ch.href; if (/^https?:/.test(ch.href)) { b.target = "_blank"; b.rel = "noopener"; } }
    else { b.type = "button"; b.addEventListener("click", (ev) => { ev.preventDefault(); ch.action(b); }); }
    c.appendChild(b);
  }
  return c;
}

function pathLabel(p) { return p ? [p.fiche, p.section].filter(Boolean).join(" › ") : ""; }

// Builds the answer card. `on` carries the callbacks: show(spans, widen), open(fiche_id, spans), feedback(), audit().
export function answerCard(reply, on) {
  const lang = reply.language || "fr";
  const m = el("div", "msg bot carte");
  const v = reply.verdict;
  const vk = v === "sur_cette_fiche" ? "ici" : v === "ailleurs" ? "ailleurs" : "trouve";
  const head = el("div", "verdict v-" + vk);
  head.appendChild(el("span", "v-lbl", reply.primary?.via === "faq" ? t(lang, "faq") : t(lang, vk)));
  if (reply.primary) head.appendChild(el("span", "v-fiche", " · " + reply.primary.fiche));
  m.appendChild(head);

  if (reply.items.length === 1) m.appendChild(el("p", "texte", reply.items[0].text));
  else { const ol = el("ol", "texte liste"); reply.items.forEach((it) => ol.appendChild(el("li", null, it.text))); m.appendChild(ol); }
  if (!reply.complete) m.appendChild(el("p", "note", t(lang, "partiel")));
  if (reply.conflicting) m.appendChild(el("p", "note", t(lang, "conflit")));
  for (const c of (reply.caveats || []).slice(0, 2)) m.appendChild(el("p", "note", c));
  if (reply.clarification) m.appendChild(el("p", "note question", reply.clarification));

  const spans = reply.items.flatMap((it) => it.spans);
  const first = spans[0];
  if (first) {
    const bq = el("blockquote", "passage");
    bq.appendChild(el("span", "chemin", pathLabel(first.path)));
    bq.appendChild(el("span", "cite", "« " + first.quote + " »"));
    if (lang !== "fr") bq.appendChild(el("span", "extrait", t(lang, "extrait")));
    if (spans.length > 1) bq.appendChild(el("span", "plus", "+" + (spans.length - 1) + " " + t(lang, "passages")));
    m.appendChild(bq);
  }

  const acts = [];
  if (reply.primary) {
    const onPage = v === "sur_cette_fiche";
    acts.push({ label: onPage ? t(lang, "voir") : t(lang, "ouvrir"), action: () => on.open(reply.primary.fiche_id, spans) });
  }
  for (const s of reply.sources.slice(0, 1)) acts.push({ label: t(lang, "source") + " ↗", href: s.u });
  acts.push({ label: t(lang, "pourquoi"), ghost: true, action: (b) => { const d = m.querySelector("details.audit"); d.open = !d.open; } });
  acts.push({ label: t(lang, "pasca"), ghost: true, action: (b) => { on.feedback(); b.replaceWith(el("span", "merci", t(lang, "merci"))); } });
  m.appendChild(chips(acts));
  m.appendChild(auditDrawer(reply, lang));
  const foot = el("div", "pied");
  foot.appendChild(el("span", "mode " + (reply.generated_by === "model" ? "modele" : "local"), reply.generated_by === "model" ? t(lang, "modele") : t(lang, "local")));
  if (reply.verifie) foot.appendChild(el("span", "verif", " · guide vérifié " + reply.verifie));
  m.appendChild(foot);
  return m;
}

export function absenceCard(reply, on) {
  const lang = reply.language || "fr";
  const a = reply.absence;
  const m = el("div", "msg bot carte absence");
  const head = el("div", "verdict v-absent");
  head.appendChild(el("span", "v-lbl", t(lang, "absent")));
  m.appendChild(head);
  const dl = el("dl", "preuves");
  const row = (k, node) => { dl.appendChild(el("dt", null, k)); const dd = el("dd"); if (typeof node === "string") dd.textContent = node; else dd.appendChild(node); dl.appendChild(dd); };
  const read = a.read.page ? `${a.read.page.fiche} (${a.read.page.sections} sections, ${a.read.page.blocs} ${t(lang, "passages")}), puis les ${a.read.guide.fiches} fiches du guide` : `les ${a.read.guide.fiches} fiches du guide, ${a.read.guide.blocs} ${t(lang, "passages")}`;
  row(t(lang, "lu"), read);
  const ul = el("ul");
  for (const s of a.searched.slice(0, 5)) {
    const li = el("li");
    li.appendChild(el("strong", null, s.label));
    if (s.variants.length) li.appendChild(document.createTextNode(" (" + s.variants.filter((v) => v.toLowerCase() !== s.label.toLowerCase()).slice(0, 4).join(", ") + ")"));
    li.appendChild(document.createTextNode(" : " + (s.total ? s.hits.map((h) => `${h.n} dans « ${h.fiche} »`).join(", ") : t(lang, "aucun"))));
    ul.appendChild(li);
  }
  row(t(lang, "cherche"), ul);
  if (a.closest) {
    const d = el("div");
    d.appendChild(el("span", "chemin", [a.closest.fiche, a.closest.section].filter(Boolean).join(" › ")));
    d.appendChild(el("span", "cite", "« " + a.closest.snippet + " » "));
    d.appendChild(el("span", "why", "— " + a.closest.why));
    row(t(lang, "proche"), d);
  }
  for (const c of (a.model_caveats || []).slice(0, 1)) row("Modèle", c);
  m.appendChild(dl);
  const acts = [];
  if (a.suggestion) {
    if (a.suggestion.url) acts.push({ label: t(lang, "suggestion") + " : " + a.suggestion.label + " ↗", href: a.suggestion.url });
    else acts.push({ label: t(lang, "suggestion") + " : " + a.suggestion.label, action: () => { location.hash = a.suggestion.hash; } });
  }
  acts.push({ label: t(lang, "pourquoi"), ghost: true, action: () => { const d = m.querySelector("details.audit"); d.open = !d.open; } });
  acts.push({ label: t(lang, "pasca"), ghost: true, action: (b) => { on.feedback(); b.replaceWith(el("span", "merci", t(lang, "merci"))); } });
  m.appendChild(chips(acts));
  m.appendChild(auditDrawer(reply, lang));
  return m;
}

function auditDrawer(reply, lang) {
  const d = el("details", "audit");
  d.appendChild(el("summary", null, t(lang, "pourquoi")));
  const a = reply.audit || {};
  const q = a.question || {}, r = a.retrieval || {};
  const lines = [];
  lines.push(`question : ${q.language} · ${q.shape}${q.listing ? " · liste" : ""}${q.corrections?.length ? " · corrigé " + q.corrections.map((c) => c.from + "→" + c.to).join(", ") : ""}`);
  lines.push(`mots du lecteur : ${(q.direct || []).join(", ") || "—"}`);
  lines.push(`dictionnaire : ${(q.concepts || []).map((c) => c.id + " (" + c.variant + ")").join(", ") || "—"}`);
  lines.push(`parcours : ${r.route || "—"} · verdict ${r.verdict || "—"} · confiance ${r.confidence ?? "—"} · marge ${r.margin ?? "—"}${r.arbiter_needed ? " · arbitre sollicité" : " · marge nette, pas d'arbitre"}`);
  if (r.faq?.outcome && r.faq.outcome !== "miss") lines.push(`FAQ : ${r.faq.outcome} (${r.faq.best?.qid}, ${r.faq.best?.score})`);
  for (const s of (r.sections || []).slice(0, 5)) lines.push(`  ${s.role.padEnd(10)} ${s.section_id} ${s.score}  ${s.methods.join("+")}  [${s.matched.join(", ")}]${s.reason ? "  — " + s.reason : ""}`);
  lines.push(`modèle : ${a.model_calls_count || 0} appel(s)${(a.model_calls || []).map((c) => ` · ${c.purpose} ${c.ms} ms${c.ok ? "" : " ✗"}`).join("")} · ${reply.mode === "local" ? "mode local" : "proxy"}`);
  if (a.validation) lines.push(`validateur : ${a.validation.status}${a.validation.errors?.length ? " · " + a.validation.errors.join(" ; ") : ""}`);
  if (a.timings) lines.push(`temps : ${a.timings.total} ms`);
  d.appendChild(el("pre", null, lines.join("\n")));
  return d;
}
