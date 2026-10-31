// The assistant's entry point inside the guide. The site's own `envoyer` and `demarrerChat` hand over to this module
// (two lines patched at build time); everything else of the site is untouched. The assistant reads the page from the
// URL hash, asks the proxy (or the local pipeline), renders the card, opens the fiche and highlights the passage.
import config from "./config.js";
import { createClient } from "./client.js";
import { bubble, waiting, chips, answerCard, absenceCard, el, t, logs } from "./render.js";
import { highlightSpans, whenFicheShown, clearMarks } from "./highlight.js";

const client = createClient(config);
let lastFiche = null;
let lastReply = null;
const history = [];

function currentPage() { return (location.hash || "").replace(/^#/, ""); }

function profile() {
  try {
    const d = JSON.parse(localStorage.getItem("luxguide.chat.v1") || "null");
    const o = d && d.profil && d.profil.origine;
    if (!o) return null;
    return { statut: o === "Hors UE" ? "hors_ue" : "ue", origine: o };
  } catch { return null; }
}

function railOpen() { return document.body.classList.contains("rail-ouvert"); }
function railPossible() { return window.innerWidth >= 1100; }

async function openFiche(ficheId, spans, { auto = false } = {}) {
  const fiche = (await client.data()).T.ficheById.get(ficheId);
  if (!fiche) return;
  if (ficheId === "parcours") { location.hash = "#parcours"; return; }
  // On a large screen the conversation stays beside the fiche; on a small one, the fiche takes the screen.
  if (railPossible() && !railOpen()) { const b = document.getElementById("widget-btn"); if (b && !b.hidden) b.click(); }
  if (location.hash !== "#fiche/" + ficheId) location.hash = "#fiche/" + ficheId;
  else if (!auto) window.dispatchEvent(new HashChangeEvent("hashchange"));
  const shown = await whenFicheShown(fiche.titre);
  if (shown && spans && spans.length) {
    const r = highlightSpans(spans);
    if (!r.marked && !auto) bubble("Le passage n'a pas pu être surligné dans la page : il est cité ci-dessus.", "bot");
  }
}

function render(reply, question) {
  const cards = logs().map((log) => {
    const card = reply.kind === "absence" ? absenceCard(reply, callbacks(reply, question)) : answerCard(reply, callbacks(reply, question));
    log.appendChild(card); log.scrollTop = log.scrollHeight; return card;
  });
  return cards;
}

function callbacks(reply, question) {
  return {
    open: (ficheId, spans) => openFiche(ficheId, spans),
    feedback: () => client.feedback({ question, verdict: reply.verdict, primary: reply.primary || null, page: currentPage(), at: new Date().toISOString() })
  };
}

async function envoyer(texteForce) {
  let q = texteForce;
  const inputs = [document.getElementById("chat-input"), document.getElementById("widget-input")].filter(Boolean);
  if (!q) for (const i of inputs) if (i.value.trim()) { q = i.value.trim(); break; }
  inputs.forEach((i) => { i.value = ""; });
  if (!q) return;
  bubble(q, "me");
  const dots = waiting();
  const page = currentPage();
  let reply;
  try {
    reply = await client.ask({ question: q, page, profile: profile(), previous: lastFiche ? { fiche_id: lastFiche } : null });
  } catch (e) {
    dots.forEach((d) => d.remove());
    bubble("L'assistant n'a pas pu répondre : " + (e && e.message ? e.message : e), "bot");
    return;
  }
  dots.forEach((d) => d.remove());
  lastReply = reply;
  history.push({ q, verdict: reply.verdict, kind: reply.kind });

  if (reply.kind === "smalltalk" || reply.kind === "precisez") {
    const ms = bubble(reply.text, "bot");
    if (reply.kind === "precisez") ms.forEach((m) => m.appendChild(chips(examples(reply.language))));
    return;
  }
  render(reply, q);
  if (reply.primary) {
    lastFiche = reply.primary.fiche_id;
    const spans = reply.items.flatMap((it) => it.spans);
    const onThisPage = reply.verdict === "sur_cette_fiche";
    // The passage is shown at once when the fiche is already in front of the reader, or when the conversation sits
    // beside the content (the rail). Otherwise the card offers to open it.
    if (onThisPage) { const r = highlightSpans(spans); if (!r.marked) await openFiche(reply.primary.fiche_id, spans, { auto: true }); }
    else if (railOpen() || (railPossible() && reply.verdict === "ailleurs")) await openFiche(reply.primary.fiche_id, spans, { auto: true });
  }
}

function examples(lang) {
  const ex = { fr: ["Combien de mois de loyer pour la garantie locative ?", "Comment immatriculer ma voiture ?", "Quels documents apporter à la commune ?"], en: ["How do I get my social security number?", "Is public transport free?", "Which documents for the commune?"], de: ["Wie melde ich mein Auto an?", "Ist der öffentliche Verkehr kostenlos?"], pt: ["Como registar o meu carro?", "Quais documentos levar à comuna?"] }[lang] || [];
  return ex.map((q) => ({ label: q, action: () => envoyer(q) }));
}

function demarrer() {
  const page = currentPage();
  const greeting = "Bonjour. Posez votre question : je réponds à partir des fiches du guide, j'ouvre la bonne fiche et je surligne le passage qui porte la réponse." + (page.startsWith("fiche/") ? " Je tiens compte de la fiche que vous lisez." : "");
  const ms = bubble(greeting, "bot");
  ms.forEach((m) => m.appendChild(chips(examples("fr"))));
}

// A new fiche in front of the reader: the previous highlight goes away.
window.addEventListener("hashchange", () => { if (!location.hash.startsWith("#fiche/")) clearMarks(); });

window.ASSISTANT = { envoyer, demarrer, version: config.commit, client, get lastReply() { return lastReply; } };
client.data();   // warm the tables while the reader looks around
client.health();
