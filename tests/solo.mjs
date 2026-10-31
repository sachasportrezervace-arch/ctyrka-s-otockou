// node tests/solo.mjs [baseUrl] – sólo proti botovi v Chromiu desktop a WebKitu iPhone 13.
// Kontroluje: #solo i tlačítko „Zkusit sám“, celou partii s botem, „Znovu“ (jiná deska), žádný požadavek na mantledb, žádné chyby.
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { step, replay } from "../src/engine.js";

const require = createRequire(import.meta.url);
const { chromium, webkit, devices } = require(process.env.PW || path.join(process.env.APPDATA || "", "npm/node_modules/playwright"));
const BASE = process.argv[2] || "http://127.0.0.1:8809/";
const shots = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "design", "shots");
const tag = /127\.0\.0\.1|localhost/.test(BASE) ? "" : "live-";
let pass = 0, fail = 0;
const check = (name, ok, extra = "") => { ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  (" + extra + ")" : ""}`); };
const state = p => p.evaluate(() => ({ view: __c4.view, solo: !!(__c4.room && __c4.room.solo), anim: __c4.animating, g: __c4.g }));

async function run(browser, ctxOpt, label, touch, viaButton) {
  const ctx = await browser.newContext(ctxOpt), p = await ctx.newPage();
  const errors = [], sync = [];
  p.on("pageerror", e => errors.push(e.message));
  p.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
  p.on("request", r => { if (/mantledb/.test(r.url())) sync.push(r.url()); });
  if (viaButton) { await p.goto(BASE); await p.waitForFunction(() => window.__c4 && document.body.dataset.ready); await (touch ? p.tap("#soloBtn") : p.click("#soloBtn")); }
  else await p.goto(BASE + "#solo");
  await p.waitForFunction(() => window.__c4 && __c4.view === "play" && __c4.room && __c4.room.solo, null, { timeout: 15000 });
  check(`${label}: sólo běží (${viaButton ? "tlačítko Zkusit sám" : "adresa #solo"})`, (await state(p)).solo);
  check(`${label}: ve hře je vidět Trénink`, /Trénink/.test(await p.textContent("#score")));
  await p.screenshot({ path: path.join(shots, `${tag}40-solo-start-${label}.png`) });
  const cfg1 = (await state(p)).g.cfg;
  let botMoves = 0, guard = 0;
  while (guard++ < 120) {
    const s = await state(p);
    const st = replay(s.g.cfg, s.g.m).st;
    if (st.over) break;
    if (s.anim || st.turn !== "x") { await p.waitForTimeout(300); continue; }
    const cols = [...Array(st.w).keys()].filter(c => step(st, String(c)));
    const c = cols.find(c => step(st, String(c)).st.over?.who === "x") ?? cols[Math.floor(Math.random() * cols.length)];
    const before = s.g.m.length, box = await p.locator("#grid").boundingBox();
    const x = box.x + (c + .5) * box.width / st.w, y = box.y + box.height / 2;
    if (touch) { await p.touchscreen.tap(x, y); await p.waitForTimeout(120); await p.touchscreen.tap(x, y); }
    else { await p.mouse.move(x, y); await p.waitForTimeout(60); await p.mouse.click(x, y); }
    await p.waitForFunction(n => __c4.g.m.length > n, before, { timeout: 8000 });
    // bot odpoví sám s krátkou pauzou
    await p.waitForFunction(n => __c4.g.m.length > n + 1 || (__c4.g && !__c4.animating && document.getElementById("soloAgain")), before, { timeout: 12000 });
    botMoves++;
  }
  const s = await state(p), fin = replay(s.g.cfg, s.g.m).st;
  check(`${label}: partie s botem dohraná (${fin.over?.kind} ${fin.over?.who || ""}, ${s.g.m.length} tahů)`, !!fin.over);
  await p.waitForSelector("#soloAgain", { timeout: 8000 });
  check(`${label}: na konci Znovu a Vyzvat soupeře`, await p.isVisible("#soloAgain") && await p.isVisible("#soloChallenge"));
  await p.screenshot({ path: path.join(shots, `${tag}41-solo-konec-${label}.png`) });
  await (touch ? p.tap("#soloAgain") : p.click("#soloAgain"));
  await p.waitForFunction(() => __c4.g && __c4.g.m.length <= 1 && !__c4.animating, null, { timeout: 10000 })
    .catch(async e => { console.log("stav po Znovu:", JSON.stringify(await p.evaluate(() => ({ m: __c4.g.m, a: __c4.animating, v: __c4.view, h: location.hash }))), errors); throw e; });
  const cfg2 = (await state(p)).g.cfg;
  check(`${label}: Znovu dá jinou desku i překvapení`, cfg2.b !== cfg1.b && cfg2.mod !== cfg1.mod, `${cfg1.b}/${cfg1.mod} -> ${cfg2.b}/${cfg2.mod}`);
  await (touch ? p.tap("#newBtn") : p.click("#newBtn"));
  await p.waitForFunction(() => __c4.view === "setup");
  check(`${label}: žádný požadavek na synchronizaci`, sync.length === 0, sync.slice(0, 2).join(" "));
  check(`${label}: žádné chyby v konzoli`, errors.length === 0, errors.slice(0, 2).join(" | "));
  await ctx.close();
}

const ch = await chromium.launch(), wk = await webkit.launch();
try {
  await run(ch, { viewport: { width: 1440, height: 900 } }, "desktop", false, true);
  await run(wk, { ...devices["iPhone 13"] }, "iphone", true, false);
} catch (e) { fail++; console.log("FAIL  výjimka: " + e.message); }
finally { await ch.close(); await wk.close(); }
console.log(`\n${pass} PASS, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
