// node tests/herna-live.mjs [hernaUrl] – skutečná Herna (výchozí živá) + skutečná Čtyřka s otočkou + skutečný mantledb.
// Mark: Chromium 1440×900 zakládá místnost a vybere Čtyřku, Radka: WebKit iPhone 13 přijme pozvánku a hra se jí přepne sama.
// Ověří: herna=1 v adrese iframe (seat, zaklada), žádná výzva ani setup, skryté sdílení, partii do výhry, skóre v liště Herny (1 : 0),
// jeden záznam v dokumentu místnosti, odvetu (výhra Radky, 1 : 1) a „Jiná hra“ zpět do místnosti.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { step, replay } from "../src/engine.js";

const require = createRequire(import.meta.url);
const { chromium, webkit, devices } = require(process.env.PW || path.join(process.env.APPDATA || "", "npm/node_modules/playwright"));
const HERNA = process.argv[2] || "https://sachasportrezervace-arch.github.io/herna/";
const shotsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "design", "shots");
let pass = 0, fail = 0;
const check = (name, ok, extra = "") => { ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  (" + (typeof extra === "string" ? extra : JSON.stringify(extra)) + ")" : ""}`); };
const errors = [];
const doc = async id => (await fetch(`https://mantledb.sh/v2/herna-${id}/mistnost`, { cache: "no-store" })).json();
const vis = (p, sel) => p.$eval(sel, el => !el.hidden && getComputedStyle(el).display !== "none").catch(() => false);
const src = p => p.$eval("#ram-telo iframe", f => f.src).catch(() => "");
const gameFrame = p => p.frames().find(f => f !== p.mainFrame());
async function cekej(fn, ms = 20000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) { if (await fn().catch(() => false)) return true; await new Promise(r => setTimeout(r, 250)); }
  return false;
}
const skore = async p => (await p.textContent("#ram-skore")).replace(/\s/g, "");

async function ctx(browser, opt, who) {
  const c = await browser.newContext(opt), p = await c.newPage();
  p.on("pageerror", e => errors.push(`${who}: ${e.message}`));
  p.on("console", m => { if (m.type() === "error" && !/mantledb|Failed to load resource/.test(m.text())) errors.push(`${who}: ${m.text()}`); });
  return { c, p, who };
}
function pickMove(s, me, winner) {
  const cols = [...Array(s.w).keys()].filter(c => step(s, String(c)));
  const winsFor = who => cols.filter(c => step({ ...s, turn: who }, String(c))?.st.over?.who === who);
  if (me === winner) { const w = winsFor(me); return w.length ? w[0] : cols[0]; }
  const bad = new Set([...winsFor(me), ...winsFor(winner)]);
  return [...cols].reverse().find(c => !bad.has(c)) ?? cols[cols.length - 1];
}
const st = P => gameFrame(P.p).evaluate(() => ({ g: __c4.g, me: __c4.me, anim: __c4.animating, busy: __c4.busy }));
async function drop(P, col, touch) {
  const f = gameFrame(P.p), box = await (await f.$("#grid")).boundingBox();
  const w = replay((await st(P)).g.cfg, []).st.w;
  const pos = { x: (col + .5) * box.width / w, y: box.height * .5 };
  const g = await f.$("#grid");
  if (touch) { await g.tap({ position: pos }); await P.p.waitForTimeout(150); await g.tap({ position: pos }); }
  else { await P.p.mouse.move(box.x + pos.x, box.y + pos.y); await P.p.waitForTimeout(80); await P.p.mouse.click(box.x + pos.x, box.y + pos.y); }
}
async function play(A, B, win) {
  for (let i = 0; i < 80; i++) {
    let s = await st(A);
    if (s.anim || s.busy) { await A.p.waitForTimeout(300); continue; }
    const r = replay(s.g.cfg, s.g.m).st;
    if (r.over) return;
    const P = r.turn === "x" ? A : B, O = P === A ? B : A, before = s.g.m.length;
    await drop(P, pickMove(r, r.turn, win), P === B);
    if (!(await cekej(async () => { const a = await st(P), b = await st(O); return a.g.m.length === before + 1 && b.g.m.length === before + 1 && !a.anim && !b.anim && !a.busy && !b.busy; }, 20000))) throw new Error("tah nedošel");
  }
  throw new Error("partie nekončí");
}

const ch = await chromium.launch(), wk = await webkit.launch();
const wins = [];
try {
  const A = await ctx(ch, { viewport: { width: 1440, height: 900 } }, "Mark"), B = await ctx(wk, { ...devices["iPhone 13"] }, "Radka");
  wins.push(A, B);
  const a = A.p, b = B.p;
  await a.goto(HERNA, { waitUntil: "networkidle" });
  await a.waitForSelector("#pas:not([hidden])");
  await a.click("#pas-zalozit");
  await a.fill('input[name="ja"]', "Mark"); await a.fill('input[name="on"]', "Radka");
  await a.click('#dlg-form [type="submit"]');
  await a.waitForURL(/#m=[0-9a-z]{10}$/, { timeout: 15000 });
  const odkaz = a.url(), mid = /#m=([0-9a-z]{10})$/.exec(odkaz)[1];
  await a.waitForSelector("#dlg .dlg-odkaz");
  await a.click("#dlg [data-dlg-zavri].tl");
  await b.goto(odkaz, { waitUntil: "networkidle" });
  await b.waitForSelector('#dlg:not([hidden]) [data-akce="vstoupit"]');
  await b.click('[data-akce="vstoupit"]');
  await b.waitForFunction(() => document.getElementById("sk-j1").classList.contains("je-ja"), null, { timeout: 15000 });
  check("Radka sedí v místnosti, Mark to vidí", await cekej(async () => /Hrajete spolu/.test(await a.textContent("#mist-stav"))));

  check("karta Čtyřka s otočkou je k hraní", await a.$eval('.hra[data-id="ctyrka-s-otockou"] .hra-odkaz', e => !!e.href).catch(() => false));
  await a.click('.hra[data-id="ctyrka-s-otockou"] .hra-odkaz');
  check("Mark: adresa hry s herna=1, seat=0, zaklada=1", await cekej(async () => /\/ctyrka-s-otockou\/#herna=1&m=[0-9a-z]{10}&r=[0-9a-z]{10,16}&seat=0&names=Mark,Radka&zaklada=1$/.test(await src(a))), await src(a));
  check("Radce se hra přepne sama (seat=1, zaklada=0)", await cekej(async () => await vis(b, "#ram") && /\/ctyrka-s-otockou\/#herna=1&m=[0-9a-z]{10}&r=[0-9a-z]{10,16}&seat=1&names=Mark,Radka&zaklada=0$/.test(await src(b))), await src(b));
  check("obě iframe mají stejné r", /&r=([0-9a-z]+)&/.exec(await src(a))?.[1] === /&r=([0-9a-z]+)&/.exec(await src(b))?.[1]);
  for (const P of [A, B]) await gameFrame(P.p).waitForFunction(() => window.__c4 && __c4.view === "play" && __c4.me, null, { timeout: 25000 });
  check("obě hry sedí v partii (Mark = x, Radka = o)", (await st(A)).me === "x" && (await st(B)).me === "o");
  const ids = ["setup", "share", "intro", "soloBtn", "linkBtn", "newBtn", "fsBtn"];
  const skryte = [];
  for (const P of [A, B]) skryte.push(await gameFrame(P.p).evaluate(l => l.filter(id => { const e = document.getElementById(id); return e && e.getClientRects().length > 0; }), ids));
  check("hra skryje výzvu, setup, sdílení, Zkusit sám a celou obrazovku", skryte.every(s => s.length === 0), skryte);
  check("lišta Herny: skóre 0 : 0", await skore(a) === "Mark0:0Radka" && await skore(b) === "Mark0:0Radka", [await skore(a), await skore(b)]);
  await a.waitForTimeout(600);
  await a.screenshot({ path: path.join(shotsDir, "live-60-herna-start-desktop.png") }); await b.screenshot({ path: path.join(shotsDir, "live-60-herna-start-iphone.png") });

  await play(A, B, "x");
  check("skóre 1 : 0 v liště u obou (Mark vyhrál jako sedadlo 0)", await cekej(async () => await skore(a) === "Mark1:0Radka" && await skore(b) === "Mark1:0Radka"), [await skore(a), await skore(b)]);
  await a.waitForTimeout(600);
  await a.screenshot({ path: path.join(shotsDir, "live-61-herna-konec-desktop.png") }); await b.screenshot({ path: path.join(shotsDir, "live-61-herna-konec-iphone.png") });
  await a.waitForTimeout(6000);
  const d = await doc(mid);
  check("dokument místnosti: sk 1,0 a jeden záznam ctyrka-s-otockou (vítěz 0)", d.g && d.g.sk.join() === "1,0" && d.g.log.length === 1 && d.g.log[0].g === "ctyrka-s-otockou" && d.g.log[0].w === 0, d.g);
  check("skóre po 6 s pořád 1 : 0", await skore(a) === "Mark1:0Radka" && await skore(b) === "Mark1:0Radka");

  // odveta ve stejné hře, vyhrává Radka (sedadlo 1)
  await gameFrame(a).click("#againBtn");
  await cekej(async () => (await st(A)).g.n === 2 && (await st(B)).g.n === 2 && !(await st(A)).anim && !(await st(B)).anim);
  await play(A, B, "o");
  check("po odvetě skóre 1 : 1 u obou", await cekej(async () => await skore(a) === "Mark1:1Radka" && await skore(b) === "Mark1:1Radka"), [await skore(a), await skore(b)]);

  await gameFrame(b).click("#otherBtn");
  check("Jiná hra vrátí Radku do místnosti", await cekej(async () => !(await vis(b, "#ram")) && await vis(b, "#hry")));
  check("v místnosti skóre 1 : 1", (await b.textContent("#sk-0")) === "1" && (await b.textContent("#sk-1")) === "1", [await b.textContent("#sk-0"), await b.textContent("#sk-1")]);
  check("žádné chyby v konzoli", errors.length === 0, errors.slice(0, 3));
} catch (e) {
  fail++; console.log("FAIL  výjimka: " + e.message);
  for (const [i, w] of wins.entries()) await w.p.screenshot({ path: path.join(shotsDir, `live-69-fail-${i}.png`) }).catch(() => {});
} finally {
  await ch.close(); await wk.close();
}
console.log(`\n${pass} PASS, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
