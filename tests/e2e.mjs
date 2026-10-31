// node tests/e2e.mjs [baseUrl] – dvě zařízení a divák hrají tři partie za sebou přes skutečný mantledb.sh.
// Zakladatel: Chromium desktop 1440×900, soupeř: WebKit iPhone 13 (dotyk), divák: Chromium.
// Kontroluje: výzvu, čekárnu, přisednutí, pojistku „zakladatel nikdy nepřisedne sám k sobě“, divák, otočku,
// konec, odvetu, že se tři partie po sobě liší (deska, překvapení, kdo začíná) a že v konzoli nejsou chyby.
import path from "node:path";
import fs from "node:fs";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { step, replay, BOARDS } from "../src/engine.js";

const require = createRequire(import.meta.url);
const { chromium, webkit, devices } = require(process.env.PW || path.join(process.env.APPDATA || "", "npm/node_modules/playwright"));
const BASE = process.argv[2] || "http://127.0.0.1:8809/";
const shots = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "design", "shots");
fs.mkdirSync(shots, { recursive: true });
const LIVE = !/127\.0\.0\.1|localhost/.test(BASE);
const tag = LIVE ? "live-" : "";

let pass = 0, fail = 0;
const check = (name, ok, extra = "") => { ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  (" + extra + ")" : ""}`); };
const errors = [];
const watchErrors = (p, who) => {
  p.on("pageerror", e => errors.push(`${who}: ${e.message}`));
  p.on("console", m => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(`${who}: ${m.text()}`); });
};
const state = p => p.evaluate(() => ({ view: __c4.view, me: __c4.me, n: __c4.g && __c4.g.n, m: __c4.g ? __c4.g.m.length : -1, anim: __c4.animating, busy: __c4.busy, cfg: __c4.g && __c4.g.cfg, g: __c4.g }));
async function settle(p, pred, ms = 20000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const s = await state(p);
    if (!s.anim && !s.busy && pred(s)) return s;
    await p.evaluate(() => dispatchEvent(new Event("focus")));   // probudí dotazování hned
    await p.waitForTimeout(400);
  }
  throw new Error("timeout čekání na stav: " + JSON.stringify(await state(p)).slice(0, 300));
}
const shot = (p, name) => p.screenshot({ path: path.join(shots, tag + name + ".png") });

// klik na sloupec: myš jedním klikem, dotyk dvakrát (první klepnutí vybírá sloupec)
async function dropAt(p, col, touch) {
  const box = await p.locator("#grid").boundingBox();
  const w = (await state(p)).g ? replay((await state(p)).cfg, (await state(p)).g.m).st.w : 7;
  const x = box.x + (col + .5) * box.width / w, y = box.y + box.height * .5;
  if (touch) { await p.touchscreen.tap(x, y); await p.waitForTimeout(150); await p.touchscreen.tap(x, y); }
  else { await p.mouse.move(x, y); await p.waitForTimeout(80); await p.mouse.click(x, y); }
}
async function rotate(p, dir, touch, shotName) {
  const b = p.locator(dir === "L" ? "#rotL" : "#rotR");
  touch ? await b.tap() : await b.click();
  await p.waitForTimeout(450);
  if (shotName) await shot(p, shotName);
  // potvrzovací tlačítko pulzuje, proto force
  touch ? await b.tap({ force: true }) : await b.click({ force: true });
}
// pravidlo pro hráče v testu: kdo má vyhrát, bere výherní sloupec, jinak staví od kraje; druhý nehraje do výhry ani neblokuje cíleně
function pickMove(st, me, winner) {
  const cols = [...Array(st.w).keys()].filter(c => step(st, String(c)));
  const winsFor = who => cols.filter(c => step({ ...st, turn: who }, String(c))?.st.over?.who === who);
  if (me === winner) { const w = winsFor(me); return w.length ? w[0] : cols[0]; }
  const bad = new Set([...winsFor(me), ...winsFor(winner)]);
  return [...cols].reverse().find(c => !bad.has(c)) ?? cols[cols.length - 1];
}

const ch = await chromium.launch(), wk = await webkit.launch();
const cx = await ch.newContext({ viewport: { width: 1440, height: 900 } });
const A = await cx.newPage(); watchErrors(A, "zakladatel");
const cm = await wk.newContext({ ...devices["iPhone 13"] });
const B = await cm.newPage(); watchErrors(B, "soupeř");
try {
  // ---------- výzva a čekárna ----------
  await A.goto(BASE);
  await A.waitForFunction(() => window.__c4 && document.body.dataset.ready);
  await shot(A, "01-uvod-desktop");
  await A.fill("#nameX", "Mark"); await A.fill("#nameO", "Radka");
  await A.click("#setupBtn");
  await A.waitForFunction(() => __c4.view === "share", null, { timeout: 15000 });
  const link = await A.inputValue("#shareLink");
  check("výzva má odkaz #r.<id>", /#r\.[0-9a-z]{12}$/.test(link), link);
  await shot(A, "02-cekarna-desktop");

  // pojistka: zakladatel otevře vlastní odkaz v dalším panelu = pořád on, žádná výzva
  const A2 = await cx.newPage(); watchErrors(A2, "zakladatel-2");
  await A2.goto(link); await settle(A2, s => s.view === "play");
  check("zakladatel na vlastním odkazu nevidí výzvu (introMine)", (await state(A2)).me === "x");
  await A2.close();

  // ---------- přisednutí soupeře na iPhonu ----------
  await B.goto(BASE); await B.waitForFunction(() => window.__c4 && document.body.dataset.ready);
  await shot(B, "03-uvod-iphone");
  await B.goto(link); await settle(B, s => s.view === "intro");
  check("cizí zařízení vidí výzvu", (await state(B)).view === "intro");
  check("výzva nabízí pojistku „tohle je moje hra“", /Mark/.test(await B.textContent("#introMine")));
  await shot(B, "04-vyzva-iphone");
  await B.fill("#introName", "Radka");
  await B.tap("#acceptBtn");
  await settle(B, s => s.view === "play" && s.me === "o");
  check("soupeř sedí jako o", (await state(B)).me === "o");
  await settle(A, s => true);
  await A.waitForFunction(() => /už sedí/.test(document.getElementById("shareWait").textContent), null, { timeout: 15000 }).catch(() => {});
  check("čekárna pozná, že soupeř přisedl", /už sedí/.test(await A.textContent("#shareWait")));
  await A.click("#shareGo"); await settle(A, s => s.view === "play");

  // ---------- divák ----------
  const cw = await ch.newContext({ viewport: { width: 1280, height: 800 } });
  const W = await cw.newPage(); watchErrors(W, "divák");
  await W.goto(link); await settle(W, s => s.view === "play");
  check("třetí zařízení je divák", (await state(W)).me === "watch");

  // ---------- tři partie ----------
  const plan = [{ winner: "x", rot: "R" }, { winner: "o", rot: "L" }, { winner: "x", rot: null }];
  const cfgs = [];
  for (let gi = 0; gi < 3; gi++) {
    const { winner, rot } = plan[gi];
    let s = await settle(A, s => s.n === gi + 1);
    await settle(B, s => s.n === gi + 1);
    cfgs.push(s.cfg);
    await shot(A, `1${gi}-partie${gi + 1}-start-desktop`); await shot(B, `1${gi}-partie${gi + 1}-start-iphone`);
    let rotated = false, guard = 0;
    while (guard++ < 80) {
      s = await state(A);
      const st = replay(s.cfg, s.g.m).st;
      if (st.over) break;
      const p = st.turn === "x" ? A : B, other = p === A ? B : A, touch = p === B;
      const before = s.m;
      if (rot && !rotated && st.ply >= 6 && st.turn === winner && st.rot[st.turn] > 0) {
        // otočka jen když nikomu nedá výhru hned, ať partie pokračuje
        const r = step(st, rot);
        if (r && !r.st.over) { await rotate(p, rot, touch, `1${gi}-partie${gi + 1}-otocka-${touch ? "iphone" : "desktop"}`); rotated = true; }
        else rotated = true;
        if (r && !r.st.over) { await settle(p, s => s.m === before + 1); await settle(other, s => s.m === before + 1); continue; }
      }
      await dropAt(p, pickMove(st, st.turn, winner), touch);
      await settle(p, s => s.m === before + 1);
      await settle(other, s => s.m === before + 1);
    }
    s = await state(A);
    const fin = replay(s.cfg, s.g.m).st;
    check(`partie ${gi + 1} skončila (${fin.over?.kind} ${fin.over?.who || ""})`, !!fin.over);
    if (rot) check(`partie ${gi + 1}: otočka proběhla`, s.g.m.some(m => m === "L" || m === "R"));
    await settle(W, w => w.n === gi + 1 && w.m === s.m);
    check(`divák vidí stejnou desku v partii ${gi + 1}`, (await state(W)).m === s.m);
    await A.waitForTimeout(700);
    await shot(A, `2${gi}-partie${gi + 1}-konec-desktop`); await shot(B, `2${gi}-partie${gi + 1}-konec-iphone`);
    if (gi === 0) await shot(W, "29-divak-desktop");
    if (gi < 2) {
      const loser = fin.over.kind === "win" ? (fin.over.who === "x" ? B : A) : A;
      const btn = loser.locator("#againBtn");
      loser === B ? await btn.tap() : await btn.click();
      await settle(A, s => s.n === gi + 2); await settle(B, s => s.n === gi + 2);
      const nx = (await state(A)).cfg;
      if (fin.over.kind === "win") check(`partii ${gi + 2} začíná poražený`, nx.s !== fin.over.who);
    }
  }
  const [c1, c2, c3] = cfgs;
  check("partie 1 je klasika na rozehřátí", c1.b === "klasika" && c1.mod === "klid");
  check("partie 2 má jinou desku i překvapení než 1", c2.b !== c1.b && c2.mod !== c1.mod, `${c2.b}/${c2.mod}`);
  check("partie 3 má jinou desku i překvapení než 2", c3.b !== c2.b && c3.mod !== c2.mod, `${c3.b}/${c3.mod}`);
  check("tři partie: tři různé desky a tři různá překvapení", new Set(cfgs.map(c => c.b)).size === 3 && new Set(cfgs.map(c => c.mod)).size === 3);
  check("tři partie se liší i tím, kdo začíná", new Set(cfgs.map(c => c.s)).size === 2, cfgs.map(c => c.s).join(""));
  const fs3 = await state(B);
  check("skóre série po třech partiích", JSON.stringify(fs3.g.sw) === "[1,1]", JSON.stringify(fs3.g.sw) + " (třetí výsledek se zapíše odvetou)");
  check("v konzoli nejsou chyby", errors.length === 0, errors.slice(0, 3).join(" | "));
  // rozměry desky odpovídají zadání
  check("deska partie 3 má rozměry z katalogu", !!BOARDS[c3.b]);
} catch (e) {
  fail++; console.log("FAIL  výjimka: " + e.message);
  await shot(A, "zz-chyba-desktop").catch(() => {}); await shot(B, "zz-chyba-iphone").catch(() => {});
} finally {
  await ch.close(); await wk.close();
}
console.log(`\n${pass} PASS, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
