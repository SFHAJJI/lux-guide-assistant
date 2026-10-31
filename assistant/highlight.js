// The highlight is computed from the cited blocs, never from the model's words: the quote is looked up in the fiche
// as the site rendered it, and the matching text range is wrapped in <mark>. On the guided fiche the tab that holds
// the passage is activated first. If the text cannot be found, nothing is marked and the caller is told.

const TEXT_SELECTOR = ".detail-texte p, .detail-texte li, .detail-texte td, .detail-texte th, .detail-texte h2, .detail-texte h3, .detail-texte dd, .detail-texte dt, .detail-cote li, .g-p, .g-note, .g-etape h3, .g-etape p, .g-etape dd, .g-item, .g-repere, .g-cas-item p, .g-cas-item strong, .g-pli p, .g-pli summary, .g-table td";

function foldKeep(s) {
  // Fold for matching while keeping a map from folded index to original index.
  const map = [];
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const ch = s[i].toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[’'`´]/g, "'").replace(/[  ]/g, " ");
    for (const c of ch) { out += c; map.push(i); }
  }
  return { text: out.replace(/\s+/g, (m) => m), map };
}

export function clearMarks(root = document) {
  root.querySelectorAll("mark.surligne").forEach((m) => {
    const p = m.parentNode;
    while (m.firstChild) p.insertBefore(m.firstChild, m);
    p.removeChild(m); p.normalize();
  });
}

// Finds `needle` (a verbatim quote) inside the text nodes of `el` and wraps it. Returns the <mark> or null.
function markIn(el, needle) {
  const nodes = [];
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  let full = "", n;
  while ((n = walker.nextNode())) { nodes.push({ node: n, start: full.length }); full += n.nodeValue; }
  const hay = foldKeep(full), nd = foldKeep(needle).text.replace(/\s+/g, " ").trim();
  const hayText = hay.text.replace(/\s+/g, " ");
  // Whitespace was squashed above only for comparison; locate on the unsquashed folded text instead.
  const idx = findLoose(hay.text, nd);
  if (idx < 0) return null;
  const startO = hay.map[idx.start], endO = hay.map[idx.end - 1] + 1;
  const range = document.createRange();
  const locate = (off) => { for (let i = nodes.length - 1; i >= 0; i--) if (off >= nodes[i].start) return [nodes[i].node, off - nodes[i].start]; return [nodes[0].node, 0]; };
  const [sn, so] = locate(startO), [en, eo] = locate(endO);
  range.setStart(sn, so); range.setEnd(en, Math.min(eo, en.nodeValue.length));
  const mark = document.createElement("mark");
  mark.className = "surligne";
  try { range.surroundContents(mark); } catch { // the range crosses element boundaries: mark each text node piece
    const frag = range.extractContents(); mark.appendChild(frag); range.insertNode(mark);
  }
  void hayText;
  return mark;
}

// A loose search: whitespace runs in the haystack may differ from the needle's single spaces.
function findLoose(hay, needle) {
  if (!needle) return -1;
  const re = new RegExp(needle.split(" ").map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\s+"), "i");
  const m = re.exec(hay);
  return m ? { start: m.index, end: m.index + m[0].length } : -1;
}

function activateTab(el) {
  const panel = el.closest(".g-panneau");
  if (panel && panel.hidden) { const tab = document.getElementById(panel.getAttribute("aria-labelledby")); if (tab) tab.click(); }
  const det = el.closest("details");
  if (det && !det.open) det.open = true;
}

// Marks every quote of `spans` (objects with `quote` and `text`): the quote first, the whole bloc text as fallback.
export function highlightSpans(spans, { scroll = true } = {}) {
  const root = document.getElementById("fiche-detail");
  if (!root || root.hidden) return { marked: 0 };
  clearMarks(root);
  const els = [...root.querySelectorAll(TEXT_SELECTOR)];
  let first = null, marked = 0;
  for (const sp of spans) {
    for (const needle of [sp.quote, sp.text]) {
      if (!needle) continue;
      let done = false;
      for (const el of els) {
        if (el.querySelector("mark.surligne")) continue;
        const m = markIn(el, needle.length > 400 ? needle.slice(0, 400) : needle);
        if (m) { marked++; if (!first) first = m; activateTab(el); done = true; break; }
      }
      if (done) break;
    }
  }
  if (first && scroll) {
    first.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "center" });
    first.classList.add("pulse");
    setTimeout(() => first.classList.remove("pulse"), 1600);
  }
  return { marked, first };
}

// Waits until the fiche with this title is rendered in #fiche-detail (the site renders it synchronously on hashchange,
// but the hash change itself is asynchronous for us).
export function whenFicheShown(ficheTitle, timeout = 2500) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    (function check() {
      const d = document.getElementById("fiche-detail");
      const h1 = d && !d.hidden ? d.querySelector("h1") : null;
      if (h1 && h1.textContent.trim() === ficheTitle) return resolve(true);
      if (Date.now() - t0 > timeout) return resolve(false);
      requestAnimationFrame(check);
    })();
  });
}
