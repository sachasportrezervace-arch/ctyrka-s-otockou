// node tests/otocka.mjs [baseUrl] – otočka jako velký moment: sekvence snímků (bomba, výhra otočkou, vyrušení obou čtyřek).
// Pozice se najdou náhodným hledáním v enginu, v prohlížeči se nahrají přes __c4.load a otočka se odklepne dvěma kliky.
// Kontroluje: animace doběhne, deska odpovídá enginu, výherní čtyřka má svatozář, žádná textová hláška přes desku, žádné chyby.
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { step, start, makeCfg, replay } from "../src/engine.js";

const require = createRequire(import.meta.url);
const { chromium, webkit, devices } = require(process.env.PW || path.join(process.env.APPDATA || "", "npm/node_modules/playwright"));
const BASE = process.argv[2] || "http://127.0.0.1:8809/";
const shots = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "design", "shots");
let pass = 0, fail = 0;
const check = (name, ok, extra = "") => { ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  (" + extra + ")" : ""}`); };

// hledá pozici, kde x je na tahu a otočka splní want(ev, st)
let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
function find(cfgOpt, want, minPly = 10) {
  for (let t = 0; t < 20000; t++) {
    const cfg = makeCfg({ start: "x", rnd, ...cfgOpt });
    let st = start(cfg); const m = [];
    while (!st.over && m.length < 34) {
      if (st.turn === "x" && m.length >= minPly) for (const d of ["R", "L"]) { const r = step(st, d); if (r && want(r.ev, r.st)) return { cfg, m, d }; }
      const opts = [...Array(st.w).keys()].map(String).filter(c => { const r = step(st, c); return r && !r.st.over; });
      if (!opts.length) break;
      const mv = opts[Math.floor(rnd() * opts.length)];
      st = step(st, mv).st; m.push(mv);
    }
  }
  throw new Error("pozice nenalezena");
}
const SCENES = [
  { key: "bomba", pos: find({ mod: "bomba", board: "klasika" }, ev => ev.rounds.some(r => r.boom && r.boom.ids.length >= 4), 12) },
  { key: "vyhra", pos: find({ mod: "klid", board: "kostka" }, (ev, st) => st.over?.by === "turn" && st.over.who === "x") },
  { key: "zruseni", pos: find({ mod: "klid", board: "klasika" }, ev => ev.rounds.some(r => r.cancel), 14) },
];

async function scene(browser, ctxOpt, label, touch, sc) {
  const ctx = await browser.newContext(ctxOpt), p = await ctx.newPage();
  const errors = [];
  p.on("pageerror", e => errors.push(e.message));
  p.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
  await p.goto(BASE);
  await p.waitForFunction(() => window.__c4 && document.body.dataset.ready);
  await p.evaluate(({ cfg, m }) => __c4.load(cfg, m), sc.pos);
  await p.waitForTimeout(300);
  const btn = "#rot" + sc.pos.d;
  await (touch ? p.tap(btn) : p.click(btn));
  await p.waitForTimeout(250);
  await (touch ? p.tap(btn, { force: true }) : p.click(btn, { force: true }));
  // sekvence: nádech, otočení, napětí, sesypání, výbuch / vyrušení
  const frames = label === "desktop" ? [150, 700, 1350, 1800, 2400, 2900, 3500] : [700, 1800, 2900];
  let t0 = Date.now();
  for (const [k, at] of frames.entries()) {
    await p.waitForTimeout(Math.max(0, at - (Date.now() - t0)));
    await p.screenshot({ path: path.join(shots, `seq-${sc.key}-${label}-${k + 1}.png`) });
  }
  await p.waitForFunction(() => !__c4.animating && __c4.g.m.length > 0, null, { timeout: 15000 });
  await p.waitForTimeout(700);
  await p.screenshot({ path: path.join(shots, `seq-${sc.key}-${label}-konec.png`) });
  const s = await p.evaluate(() => ({ m: __c4.g.m, cfg: __c4.g.cfg, n: document.querySelectorAll("#stones .st:not(.ghost)").length, win: document.querySelectorAll("#stones .st.win").length, toast: (document.getElementById("toast") || {}).textContent || "" }));
  const st = replay(s.cfg, s.m.slice(0, sc.pos.m.length + 1)).st;
  const full = replay(s.cfg, s.m).st;
  check(`${label} ${sc.key}: otočka doběhla a deska sedí s enginem`, s.n === full.cells.filter(v => v).length, `${s.n} kamenů`);
  if (sc.key === "vyhra") check(`${label} ${sc.key}: výherní čtyřka svítí`, !!st.over && s.win >= 4, `${s.win} se svatozáří`);
  check(`${label} ${sc.key}: žádná hláška přes desku`, !/obě vyletěly|Čtyřka pro oba/.test(s.toast));
  check(`${label} ${sc.key}: žádné chyby v konzoli`, errors.length === 0, errors.slice(0, 2).join(" | "));
  await ctx.close();
}

const ch = await chromium.launch(), wk = await webkit.launch();
try {
  for (const sc of SCENES) await scene(ch, { viewport: { width: 1440, height: 900 } }, "desktop", false, sc);
  for (const sc of SCENES) await scene(wk, { ...devices["iPhone 13"] }, "iphone", true, sc);
} catch (e) { fail++; console.log("FAIL  výjimka: " + e.message); }
finally { await ch.close(); await wk.close(); }
console.log(`\n${pass} PASS, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
