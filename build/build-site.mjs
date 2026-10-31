// Assembles site/: the guide at the pinned commit, untouched except for two functions of app/ui.js that hand the
// assistant over to this module, plus one stylesheet and one script tag in index.html. The diff is this file.
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const up = join(root, "upstream"), site = join(root, "site");
if (!existsSync(join(up, "index.html"))) throw new Error("run `npm run fetch` first");
rmSync(site, { recursive: true, force: true });
mkdirSync(site, { recursive: true });

// 1. The guide, minus its git metadata and its recruitment page (not part of the demo).
cpSync(up, site, { recursive: true, filter: (src) => !/[\\/](\.git|recrutement-ia)([\\/]|$)/.test(src) });

// 2. Exact-string patches to app/ui.js: each must match once, or the build fails (the commit is pinned, so it will not).
const uiPath = join(site, "app", "ui.js");
let ui = readFileSync(uiPath, "utf8").replace(/\r\n/g, "\n");
const patches = [
  {
    why: "every entry point of the conversation (buttons, Enter, the FAQ and fiche bars) hands the question to the assistant",
    from: "  function envoyer(texteForce) {\n    var q = texteForce;",
    to: "  function envoyer(texteForce) {\n    if (window.ASSISTANT && window.ASSISTANT.envoyer) { return window.ASSISTANT.envoyer(texteForce); }\n    var q = texteForce;"
  },
  {
    why: "the greeting is the assistant's, without the profile questionnaire",
    from: "  function demarrerChat() {\n    bulle(\"Bonjour. Quelques questions",
    to: "  function demarrerChat() {\n    if (window.ASSISTANT && window.ASSISTANT.demarrer) { return window.ASSISTANT.demarrer(); }\n    bulle(\"Bonjour. Quelques questions"
  },
  {
    why: "a conversation stored by the previous assistant is not replayed into the new one",
    from: "    if (chargerConversation()) {",
    to: "    if (!window.ASSISTANT && chargerConversation()) {"
  }
];
for (const p of patches) {
  const n = ui.split(p.from).length - 1;
  if (n !== 1) throw new Error(`patch "${p.why}" matched ${n} times`);
  ui = ui.replace(p.from, p.to);
}
writeFileSync(uiPath, ui);

// 3. The module, its core and its data.
cpSync(join(root, "core"), join(site, "core"), { recursive: true });
cpSync(join(root, "assistant"), join(site, "assistant"), { recursive: true });
mkdirSync(join(site, "assistant", "data"), { recursive: true });
for (const f of ["tables.json", "dictionary.json", "coverage.json"]) {
  const src = join(root, "data", "index", f);
  if (existsSync(src)) cpSync(src, join(site, "assistant", "data", f));
}
const proxy = process.env.PROXY_URL || readFileSync(join(root, "build", "proxy-url.txt"), "utf8").trim();
const manifest = JSON.parse(readFileSync(join(root, "build", "manifest.json"), "utf8"));
writeFileSync(join(site, "assistant", "config.js"), `export default ${JSON.stringify({ proxy, upstream: manifest.upstream.repo, commit: manifest.upstream.commit, built_at: new Date().toISOString() }, null, 2)};\n`);

// 4. index.html: the banner, the stylesheet, the module.
const idxPath = join(site, "index.html");
let idx = readFileSync(idxPath, "utf8");
const banner = `<div id="demo-bandeau" role="note">Démonstration : l'assistant de cette copie est un exercice d'ingénierie. Le guide est l'œuvre de son auteur : <a href="https://lux-guide.github.io/" rel="noopener">lux-guide.github.io</a>. Copie retirée sur simple demande.</div>\n`;
if (!idx.includes('<header class="top" id="entete"')) throw new Error("index.html: header not found");
idx = idx.replace('<header class="top" id="entete"', banner + '<header class="top" id="entete"');
idx = idx.replace("</head>", '<link rel="stylesheet" href="assistant/assistant.css">\n</head>');
idx = idx.replace("</body>", '<script type="module" src="assistant/assistant.js"></script>\n</body>');
writeFileSync(idxPath, idx);
writeFileSync(join(site, ".nojekyll"), "");
console.log(`site/ assembled (proxy: ${proxy || "none, local mode only"})`);
