// The three behaviours, in a real browser, as evidence: open a fiche, ask on it, see the highlight; ask about
// another fiche and see it open with its passage marked; ask something the guide does not treat and read the
// evidence. Runs in CI against site/ served locally, in local mode (no proxy), and writes screenshots + a JSON log.
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "build", "journey");
mkdirSync(out, { recursive: true });

const server = spawn(process.execPath, [join(root, "build", "serve-site.mjs")], { env: { ...process.env, PORT_SITE: "8941" }, stdio: "inherit" });
await new Promise((r) => setTimeout(r, 800));
const base = "http://localhost:8941/";
const log = [];
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1380, height: 900 } });
  page.on("pageerror", (e) => log.push({ pageerror: String(e) }));
  // Local mode: the proxy is not reachable from CI; the client must fall back without an error.
  await page.route("**/health", (route) => route.abort());
  await page.route("**/answer", (route) => route.abort());

  await page.goto(base + "#fiche/bail");
  await page.waitForSelector("#fiche-detail:not([hidden]) h1");
  await page.click("#widget-btn");
  await page.waitForSelector("#widget:not([hidden])");

  async function ask(q, name) {
    await page.fill("#widget-input", q);
    await page.press("#widget-input", "Enter");
    await page.waitForSelector("#widget-log .msg.carte:last-of-type", { timeout: 15000 });
    await page.waitForTimeout(900);
    const card = page.locator("#widget-log .msg.carte").last();
    const verdict = await card.locator(".verdict").innerText();
    const marks = await page.locator("#fiche-detail mark.surligne").count();
    const h1 = await page.locator("#fiche-detail h1").innerText().catch(() => null);
    const hash = await page.evaluate(() => location.hash);
    await page.screenshot({ path: join(out, name + ".png"), fullPage: false });
    log.push({ q, verdict, marks, fiche: h1, hash });
    return { verdict, marks, h1 };
  }

  const a = await ask("Combien de mois de loyer pour la garantie locative ?", "1-sur-cette-fiche");
  if (!/Sur cette fiche/i.test(a.verdict) || a.marks < 1) throw new Error("behaviour 1 failed: " + JSON.stringify(a));
  const b = await ask("Comment immatriculer ma voiture ?", "2-ailleurs");
  if (!/autre fiche/i.test(b.verdict) || !/Immatriculer/i.test(b.h1 || "") || b.marks < 1) throw new Error("behaviour 2 failed: " + JSON.stringify(b));
  const c = await ask("Quel est le prix d'un abonnement de ski à Pétange ?", "3-pas-dans-le-guide");
  if (!/Pas dans le guide/i.test(c.verdict)) throw new Error("behaviour 3 failed: " + JSON.stringify(c));
  const errors = log.filter((l) => l.pageerror);
  if (errors.length) throw new Error("page errors: " + JSON.stringify(errors));
  console.log("journey ok", JSON.stringify(log, null, 1));
} finally {
  writeFileSync(join(out, "journey.json"), JSON.stringify(log, null, 1));
  await browser.close();
  server.kill();
}
