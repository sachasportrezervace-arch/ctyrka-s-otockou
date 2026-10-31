// node tests/herna.mjs [baseUrl] – napojení na místnost Herny (react-apps/HERNA-PROTOKOL.md) ve dvou prohlížečích.
// Hra běží v iframe pod rodičovskou stránkou, která zachytává postMessage (jako Herna). Zakladatel: Chromium desktop, druhý: WebKit iPhone 13.
// Kontroluje: čekání bez dokumentu, založení se jmény z adresy, přisednutí bez výzvy, skryté sdílení a „Zkusit sám“,
// zprávy pripraveno/stav/vysledek (jednou za partii, stejná partie u obou), odvetu, „Jiná hra“, obě rozdělení sedadel.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { step, replay } from "../src/engine.js";

const require = createRequire(import.meta.url);
const { chromium, webkit, devices } = require(process.env.PW || path.join(process.env.APPDATA || "", "npm/node_modules/playwright"));
const BASE = process.argv[2] || "http://127.0.0.1:8809/";
const shotsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "design", "shots");
const tag = /127\.0\.0\.1|localhost/.test(BASE) ? "" : "live-";
let pass = 0, fail = 0;
const check = (name, ok, extra = "") => { ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  (" + extra + ")" : ""}`); };
const errors = [];
const rid = () => "t" + Math.random().toString(36).slice(2, 13);

const INIT = h => {
  window.__msgs = [];
  addEventListener("message", e => { if (e.data && e.data.herna === 1) __msgs.push(e.data); });
  document.head.insertAdjacentHTML("beforeend", '<meta name="viewport" content="width=device-width, initial-scale=1">');
  document.body.style.margin = "0";
  document.body.innerHTML = `<iframe id="f" style="width:100vw;height:100vh;border:0" src="${h}"></iframe>`;
};
// rodič = stránka na stejném originu (404), do které vložím iframe s hrou a zachytávám zprávy
async function open(browser, ctxOpt, who, hash) {
  const ctx = await browser.newContext(ctxOpt), p = await ctx.newPage();
  p.on("pageerror", e => errors.push(`${who}: ${e.message}`));
  p.on("console", m => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(`${who}: ${m.text()}`); });
  await p.goto(BASE + "__rodic__");
  await p.evaluate(INIT, BASE + hash);
  const frame = async () => { const h = await p.$("#f"); return h.contentFrame(); };
  return { p, ctx, frame, touch: !!ctxOpt.hasTouch, msgs: () => p.evaluate(() => __msgs) };
}
const st = async w => (await w.frame()).evaluate(() => window.__c4 ? ({ view: __c4.view, me: __c4.me, g: __c4.g, anim: __c4.animating, busy: __c4.busy }) : null);
async function until(w, pred, ms = 25000, what = "") {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const s = await st(w).catch(() => null);
    if (s && pred(s)) return s;
    await w.p.waitForTimeout(300);
  }
  throw new Error("timeout " + what + " " + JSON.stringify(await st(w).catch(() => null)).slice(0, 300));
}
const visible = async (w, sel) => (await w.frame()).evaluate(s => { const e = document.querySelector(s); return !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== "hidden"; }, sel);
const q = (r, seat, names, zaklada) => `#herna=1&m=test000000&r=${r}&seat=${seat}&names=${names.map(encodeURIComponent).join(",")}&zaklada=${zaklada}`;

function pickMove(s, me, winner) {
  const cols = [...Array(s.w).keys()].filter(c => step(s, String(c)));
  const winsFor = who => cols.filter(c => step({ ...s, turn: who }, String(c))?.st.over?.who === who);
  if (me === winner) { const w = winsFor(me); return w.length ? w[0] : cols[0]; }
  const bad = new Set([...winsFor(me), ...winsFor(winner)]);
  return [...cols].reverse().find(c => !bad.has(c)) ?? cols[cols.length - 1];
}
async function dropAt(w, col, touch) {
  const f = await w.frame(), box = await (await f.$("#grid")).boundingBox();
  const cfg = await f.evaluate(() => __c4.g.cfg);
  const width = replay(cfg, []).st.w;
  const x = box.x + (col + .5) * box.width / width, y = box.y + box.height * .5;
  if (touch) { const g = await f.$("#grid"), pos = { x: (col + .5) * box.width / width, y: box.height * .5 }; await g.tap({ position: pos }); await w.p.waitForTimeout(150); await g.tap({ position: pos }); }
  else { await w.p.mouse.move(x, y); await w.p.waitForTimeout(80); await w.p.mouse.click(x, y); }
}
// odehraje partii dokonce; who = { x: okno, o: okno, win: "x" | "o" }
async function playGame(A, B, who) {
  for (let guard = 0; guard < 80; guard++) {
    const s = await until(A, s => !s.anim && !s.busy, 20000, "klid");
    const r = replay(s.g.cfg, s.g.m).st;
    if (r.over) return r;
    const w = r.turn === "x" ? who.x : who.o, other = w === A ? B : A, before = s.g.m.length;
    await dropAt(w, pickMove(r, r.turn, who.win), w.touch);
    await until(w, s => s.g.m.length === before + 1 && !s.anim && !s.busy, 20000, "můj tah");
    await until(other, s => s.g.m.length === before + 1 && !s.anim && !s.busy, 20000, "soupeřův pohled");
  }
  throw new Error("partie nekončí");
}

const ch = await chromium.launch(), wk = await webkit.launch();
const wins = [];
try {
  // ---------- scénář 1: Mark (seat 0) zakládá, Radka (seat 1) čeká ----------
  const r1 = rid();
  const B = await open(wk, { ...devices["iPhone 13"] }, "radka", q(r1, 1, ["Mark", "Radka"], 0)); wins.push(B);
  await until(B, s => s.view === "info", 15000, "čekání");
  check("druhý hráč bez dokumentu čeká („Čeká se, až hra naskočí“)", /Čeká se, až hra naskočí/.test(await (await B.frame()).textContent("#infoTitle")));
  check("při čekání nejsou tlačítka Založit/Zkusit znovu", !(await visible(B, "#infoNew")) && !(await visible(B, "#infoRetry")));
  const A = await open(ch, { viewport: { width: 1440, height: 852 } }, "mark", q(r1, 0, ["Mark", "Radka"], 1)); wins.push(A);
  await until(A, s => s.view === "play" && s.me === "x", 20000, "A hraje");
  const sB = await until(B, s => s.view === "play" && s.me === "o", 20000, "B sedí");
  const sA = await st(A);
  check("zakladatel je x se jménem ze seat 0, druhý o se jménem ze seat 1", sA.g.x === "Mark" && sA.g.o === "Radka" && sB.g.o === "Radka", `${sA.g.x}/${sA.g.o}`);
  check("1. partie je klasika bez překvapení", sA.g.n === 1 && sA.g.cfg.b === "klasika" && sA.g.cfg.mod === "klid");
  for (const [w, nm] of [[A, "desktop"], [B, "iPhone"]]) {
    check(`${nm}: nic z výzvy/setupu/sdílení, žádné „Zkusit sám“`, !(await visible(w, "#setup")) && !(await visible(w, "#share")) && !(await visible(w, "#intro")) && !(await visible(w, "#soloBtn")) && !(await visible(w, "#linkBtn")) && !(await visible(w, "#newBtn")));
    check(`${nm}: celá obrazovka skrytá`, !(await visible(w, "#fsBtn")));
  }
  await A.p.screenshot({ path: path.join(shotsDir, tag + "50-herna-desktop.png") }); await B.p.screenshot({ path: path.join(shotsDir, tag + "50-herna-iphone.png") });
  let mA = await A.msgs(), mB = await B.msgs();
  check("obě okna poslala pripraveno", mA.some(m => m.typ === "pripraveno") && mB.some(m => m.typ === "pripraveno"));
  check("obě okna hlásí stav hraje po přisednutí", mA.some(m => m.typ === "stav" && m.faze === "hraje") && mB.some(m => m.typ === "stav" && m.faze === "hraje"), JSON.stringify(mA.filter(m => m.typ === "stav")));
  check("zakladatel nejdřív hlásil ceka", mA.find(m => m.typ === "stav")?.faze === "ceka");

  // partie 1: vyhrává Mark (x, seat 0) -> vitez 0
  await playGame(A, B, { x: A, o: B, win: "x" });
  await until(A, s => !s.anim && !s.busy, 15000); await until(B, s => !s.anim && !s.busy, 15000);
  await A.p.waitForTimeout(900);
  mA = await A.msgs(); mB = await B.msgs();
  const vA = mA.filter(m => m.typ === "vysledek"), vB = mB.filter(m => m.typ === "vysledek");
  check("partie 1: každé okno poslalo výsledek právě jednou", vA.length === 1 && vB.length === 1, JSON.stringify([vA, vB]));
  check("partie 1: vitez = seat Marka (0), stejná partie u obou", vA[0]?.vitez === 0 && vB[0]?.vitez === 0 && vA[0]?.partie === `${r1}:1` && vA[0]?.partie === vB[0]?.partie, JSON.stringify([vA, vB]));
  check("po konci stav konec", mA.some(m => m.typ === "stav" && m.faze === "konec"));
  check("tlačítko Jiná hra je vidět", await visible(A, "#otherBtn") && await visible(B, "#otherBtn"));
  await A.p.screenshot({ path: path.join(shotsDir, tag + "51-herna-konec-desktop.png") }); await B.p.screenshot({ path: path.join(shotsDir, tag + "51-herna-konec-iphone.png") });

  // odveta: vyhrává Radka (o, seat 1) -> vitez 1
  await (await A.frame()).click("#againBtn");
  await until(A, s => s.g.n === 2 && !s.anim, 20000, "odveta A"); await until(B, s => s.g.n === 2 && !s.anim, 20000, "odveta B");
  mA = await A.msgs();
  check("po odvetě znovu stav hraje", mA.filter(m => m.typ === "stav").at(-1)?.faze === "hraje");
  await playGame(A, B, { x: A, o: B, win: "o" });
  await A.p.waitForTimeout(1500);
  mA = await A.msgs(); mB = await B.msgs();
  const v2A = mA.filter(m => m.typ === "vysledek"), v2B = mB.filter(m => m.typ === "vysledek");
  check("partie 2: nová partie r:2, vitez = seat Radky (1) u obou", v2A.length === 2 && v2B.length === 2 && v2A[1].partie === `${r1}:2` && v2A[1].vitez === 1 && v2B[1].vitez === 1, JSON.stringify([v2A, v2B]));
  await (await B.frame()).click("#otherBtn");
  await B.p.waitForTimeout(300);
  check("Jiná hra pošle jina-hra", (await B.msgs()).some(m => m.typ === "jina-hra"));
  // obnovení po konci: zase x ve stejné hře (n=2)
  await A.p.evaluate(INIT, BASE + q(r1, 0, ["Mark", "Radka"], 1));
  const sR = await until(A, s => s.view === "play" && s.me === "x" && s.g.n === 2, 20000, "reload A");
  check("obnovení zakladatele: sedí zase jako x v téže hře (n=2), bez nové výzvy", sR.me === "x" && sR.g.n === 2);
  await A.ctx.close(); await B.ctx.close();

  // ---------- scénář 2: Radka (seat 1) zakládá, Mark (seat 0) přisedá; vyhrává zakladatel ----------
  const r2 = rid();
  const A2 = await open(wk, { ...devices["iPhone 13"] }, "radka-zaklada", q(r2, 1, ["Mark", "Žofie, Ó"], 1));
  const B2 = await open(ch, { viewport: { width: 1440, height: 852 } }, "mark-pozvany", q(r2, 0, ["Mark", "Žofie, Ó"], 0));
  const a2 = await until(A2, s => s.view === "play" && s.me === "x", 20000, "A2");
  await until(B2, s => s.view === "play" && s.me === "o", 20000, "B2");
  check("zakladatel na seat 1 je x a hraje za names[1] (čárka a diakritika ve jméně přežily)", a2.g.x === "Žofie, Ó" && a2.g.o === "Mark", `${a2.g.x}/${a2.g.o}`);
  await playGame(A2, B2, { x: A2, o: B2, win: "x" });
  await A2.p.waitForTimeout(1500);
  const w2A = (await A2.msgs()).filter(m => m.typ === "vysledek"), w2B = (await B2.msgs()).filter(m => m.typ === "vysledek");
  check("scénář 2: vyhrál zakladatel ze seat 1 -> vitez 1 u obou", w2A.length === 1 && w2B.length === 1 && w2A[0].vitez === 1 && w2B[0].vitez === 1, JSON.stringify([w2A, w2B]));
  await A2.ctx.close(); await B2.ctx.close();

  check("bez chyb v konzoli", errors.length === 0, errors.slice(0, 3).join(" | "));
} catch (e) {
  fail++; console.log("FAIL  výjimka: " + e.message);
  for (const [i, w] of wins.entries()) await w.p.screenshot({ path: path.join(shotsDir, `${tag}59-fail-${i}.png`) }).catch(() => {});
} finally {
  await ch.close(); await wk.close();
}
console.log(`\n${pass} PASS, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
