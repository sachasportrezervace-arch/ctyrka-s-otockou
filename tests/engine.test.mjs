// node tests/engine.test.mjs – pravidla bez prohlížeče
import { replay, step, start, turnGrid, fours, makeCfg, nextGame, tally, validCfg, titleFor, botMove, X, O, PEB, ROCK, EMPTY, BOMB } from "../src/engine.js";

let pass = 0, fail = 0;
const check = (name, ok, extra = "") => { ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}${extra ? "  (" + extra + ")" : ""}`); };
const cfg = (o = {}) => ({ b: "klasika", w: 7, h: 6, mod: "klid", s: "x", rot: [1, 1], rocks: [], peb: [], ...o });
const grid = st => { const rows = []; for (let r = 0; r < st.h; r++) rows.push(st.cells.slice(r * st.w, r * st.w + st.w).map(v => ".xo*#"[v]).join("")); return rows.join("/"); };

// 1) pád a výhra svisle
{
  const r = replay(cfg(), ["0", "1", "0", "1", "0", "1", "0"]);
  check("svislá čtyřka vyhrává", r.st.over?.who === "x" && r.st.over.kind === "win");
  check("tah po konci je zakázaný", step(r.st, "2") === null);
}
// 2) vodorovně + diagonála
{
  const r = replay(cfg(), ["0", "0", "1", "1", "2", "2", "3"]);
  check("vodorovná čtyřka", r.st.over?.who === "x");
  const d = replay(cfg(), ["0", "1", "1", "2", "2", "3", "2", "3", "3", "6", "3"]);
  check("diagonála", d.st.over?.who === "x", grid(d.st));
}
// 3) plný sloupec
{
  const r = replay(cfg(), ["0", "0", "0", "0", "0", "0"]);
  check("plný sloupec nejde", r && step(r.st, "0") === null);
}
// 4) otočení: geometrie R a L, rozměry se prohodí
{
  const st = start(cfg());
  st.cells[5 * 7 + 0] = X;  // vlevo dole
  const a = { ...st, cells: [...st.cells], ids: [...st.ids] }; turnGrid(a, "R");
  check("R: rozměry 6×7", a.w === 6 && a.h === 7);
  check("R: vlevo dole -> vlevo nahoře", a.cells[0] === X);
  const b = { ...st, cells: [...st.cells], ids: [...st.ids] }; turnGrid(b, "L");
  check("L: vlevo dole -> vpravo dole", b.cells[(b.h - 1) * b.w + b.w - 1] === X);
  const c = { ...st, cells: [...st.cells], ids: [...st.ids] }; turnGrid(c, "R"); turnGrid(c, "L");
  check("R pak L = původní", c.cells.join() === st.cells.join() && c.w === 7);
}
// 5) otočka spotřebuje tah i otočku, kameny se sesypou
{
  const r = replay(cfg(), ["0", "6", "R"]);
  check("otočka prošla", !!r);
  check("otočka ubyla", r.st.rot.x === 0 && r.st.rot.o === 1);
  check("na tahu je soupeř", r.st.turn === "o");
  check("druhá otočka nejde", step(replay(cfg(), ["0", "6", "R", "1"]).st, "L") === null);
  // po R: sloupec 0 (vlevo dole x) -> horní řada vlevo; spadne dolů. Vše leží na dně = v každém sloupci pod kamenem nic prázdného
  const st = r.st; let floating = 0;
  for (let c = 0; c < st.w; c++) for (let y = 0; y < st.h - 1; y++) if (st.cells[y * st.w + c] && st.cells[y * st.w + c] !== ROCK && st.cells[(y + 1) * st.w + c] === EMPTY) floating++;
  check("po otočce nic nevisí", floating === 0, grid(st));
  check("událost má přesuny", r.evs[2].rounds[0].moves.length > 0);
}
// 6) otočka vytvoří čtyřku jen jednomu
{
  // x leží 4 vedle sebe ve spodní řadě? to by už vyhrál. Postavíme: x ve sloupci 0 třikrát + o mezi. Po otočce L se spodní řada stane sloupcem.
  // ručně: svislá trojice x ve sloupci 6 (vpravo) a čtvrtý x vedle; po L se pravý sloupec stane spodní řadou
  const r = replay(cfg(), ["6", "0", "6", "0", "6", "1", "5", "1", "L"]);
  // po L: pravý sloupec (x,x,x odspodu) -> spodní řada vpravo... ověříme jen, že výsledek je konzistentní
  check("otočka L proběhla", !!r, r ? grid(r.st) : "");
}
// 7) obě čtyřky naráz se vyruší a hraje se dál
{
  // deska 7×6: x ve sloupci 0 (3 kusy), o ve sloupci 1 (3 kusy) -> R otočí sloupce na řádky
  // Připravíme přímo stav: dva sloupce plné tak, aby po otočce vznikly dvě vodorovné čtyřky.
  const st = start(cfg());
  // sloupec 0: odspodu x x x x? To je výhra hned. Použijeme svislé trojice + po otočce se přidá z jiné řady.
  // Jednodušší kontrola mechanismu: ruční stav, kde po R a pádu mají oba čtyřku.
  // Řádek 5 (dno): x x x x . o o ; řádek 4: o o o o (nad x) -> nelegální stav ze hry, ale testuje vyrušení.
  const W = 7;
  [0, 1, 2, 3].forEach(c => { st.cells[5 * W + c] = X; st.ids[5 * W + c] = st.nextId++; st.cells[4 * W + c] = O; st.ids[4 * W + c] = st.nextId++; });
  st.cells[5 * W + 6] = O; st.ids[5 * W + 6] = st.nextId++;
  // před otočkou mají oba čtyřku; po R (sloupce -> řádky) zůstanou svislé čtyřky? x v řádku 5 sloupce 0..3 -> po R svisle ve sloupci 0, řádky 0..3 -> padají dolů, zůstanou svisle.
  const res = step(st, "R");
  const round = res.ev.rounds[0];
  check("obě čtyřky se vyruší", !!round.cancel && round.cancel.ids.length === 8, JSON.stringify(round.cancel && round.cancel.ids.length));
  check("po vyrušení hra pokračuje", !res.st.over && res.st.turn === "o", grid(res.st));
  check("vyrušené kameny zmizely", res.st.cells.filter(v => v === X).length === 0 && res.st.cells.filter(v => v === O).length === 1);
}
// 8) otočka dá čtyřku soupeři = dárek
{
  const st = start(cfg({ s: "x" }));
  const W = 7;
  [0, 1, 2, 3].forEach(c => { st.cells[5 * W + c] = O; st.ids[5 * W + c] = st.nextId++; });
  const res = step(st, "L");
  check("čtyřka jen soupeři = soupeř vyhrává", res.st.over?.who === "o" && res.st.over.by === "gift");
}
// 9) kotva nepadá, kamínky padají
{
  const c = cfg({ mod: "kotva", rocks: [2 * 7 + 3] });
  const r = replay(c, ["3", "3"]);
  check("kámen přistane na kotvě", r.st.cells[1 * 7 + 3] === X && r.st.cells[0 * 7 + 3] === O && r.st.cells[5 * 7 + 3] === EMPTY && step(r.st, "3") === null, grid(r.st));
  const t = step(r.st, "R").st;
  check("kotva zůstala po otočce", t.cells.filter(v => v === ROCK).length === 1);
  const rockAt = t.cells.indexOf(ROCK), rr = Math.floor(rockAt / t.w), rc = rockAt % t.w;
  check("kotva je na otočené pozici", rr === 3 && rc === 3, rr + "," + rc);
  const p = replay(cfg({ mod: "kaminky", peb: [2, 4] }), []);
  check("kamínky leží na dně", p.st.cells[5 * 7 + 2] === PEB && p.st.cells[5 * 7 + 4] === PEB);
}
// 10) remíza: plná deska bez čtyřky
{
  const st = start(cfg({ b: "kostka", w: 6, h: 6, s: "o" }));
  for (let r = 0; r < 6; r++) for (let c = 0; c < 6; c++) if (r || c) { st.cells[r * 6 + c] = ((c >> 1) + r) % 2 ? X : O; st.ids[r * 6 + c] = st.nextId++; }
  const res = step(st, "0");
  check("plná deska bez čtyřky = remíza", res && res.st.over?.kind === "draw");
}
// 11) série, comeback, tituly
{
  const g = { n: 1, sw: [2, 0], sc: [0, 0], ls: [0, 2], cfg: cfg({ s: "x" }), m: [] };
  const t = tally(g, { kind: "win", who: "x" });
  check("třetí výhra bere sérii", t.seriesWon === "x" && t.sc[0] === 1);
  const n = nextGame(g, { kind: "win", who: "x" }, () => 0.3);
  check("série se vynuluje", n.sw[0] === 0 && n.sw[1] === 0 && n.sc[0] === 1);
  check("poražený začíná", n.cfg.s === "o");
  check("3 prohry v řadě = otočka navíc", n.cfg.rot[1] >= 2 && n.cfg.rot[0] === 1 || n.cfg.mod === "otocky", JSON.stringify(n.cfg.rot));
  const d = nextGame({ ...g, sw: [0, 0], ls: [0, 0] }, { kind: "draw" }, () => 0.6);
  check("po remíze se začínající střídá", d.cfg.s === "o");
  check("tituly", titleFor(0) === "" && titleFor(1) === "Oblázek" && titleFor(5) === "Balvan");
  for (let i = 0; i < 200; i++) { const c = makeCfg({ start: "x", rnd: Math.random }); if (!validCfg(c)) { check("náhodné zadání je platné", false, JSON.stringify(c)); break; } }
  check("200 náhodných zadání platných", true);
  let same = 0; let prev = makeCfg({ start: "x" });
  for (let i = 0; i < 200; i++) { const c = makeCfg({ start: "x", prev }); if (c.b === prev.b && c.mod === prev.mod) same++; prev = c; }
  check("stejná deska+modifikátor nikdy dvakrát po sobě", same === 0);
  let rep = 0; prev = makeCfg({ start: "x", board: "klasika", mod: "klid" });
  for (let i = 0; i < 300; i++) { const c = makeCfg({ start: "x", prev }); if (c.b === prev.b || c.mod === prev.mod) rep++; prev = c; }
  check("další partie má jinou desku i jiný modifikátor", rep === 0);
  let tri = 0; let p1 = makeCfg({ start: "x", board: "klasika", mod: "klid" }), p2 = makeCfg({ start: "o", prev: p1 });
  for (let i = 0; i < 300; i++) { const c = makeCfg({ start: "x", prev: p2 }); if (new Set([p1.b, p2.b, c.b]).size < 3 || new Set([p1.mod, p2.mod, c.mod]).size < 3) tri++; p1 = p2; p2 = c; }
  check("tři partie za sebou: tři desky a tři různá překvapení", tri === 0);
}
// 12) náhodné partie: přehrání nikdy nespadne a stav je konzistentní
{
  let bad = 0, games = 0, turns = 0, cancels = 0, lens = [];
  for (let gI = 0; gI < 3000; gI++) {
    const c = makeCfg({ start: Math.random() < .5 ? "x" : "o" });
    let st = start(c); const moves = [];
    while (!st.over && moves.length < 200) {
      const opts = [...Array(st.w).keys()].map(String).filter(m => step(st, m));
      if (st.rot[st.turn] && Math.random() < .08) opts.push(Math.random() < .5 ? "L" : "R");
      const mv = opts[Math.floor(Math.random() * opts.length)];
      const r = step(st, mv); if (!r) { bad++; break; }
      if (r.ev.kind === "turn") { turns++; if (r.ev.rounds.some(x => x.cancel)) cancels++; }
      st = r.st; moves.push(mv);
    }
    if (!st.over) bad++;
    const rp = replay(c, moves);
    if (!rp || rp.st.cells.join() !== st.cells.join()) bad++;
    games++; lens.push(moves.length);
  }
  lens.sort((a, b) => a - b);
  check("3000 náhodných partií bez chyby", bad === 0, `otoček ${turns}, vyrušení ${cancels}, medián tahů ${lens[lens.length >> 1]}`);
}

// 13) bomba: otočka ji shodí, bouchne a vymete okolí; bez pádu nebouchne
{
  const c = cfg({ mod: "bomba", bm: [3] });
  check("zadání s bombou je platné", validCfg(c) && !validCfg({ ...c, bm: [9] }));
  const s0 = start(c);
  check("bomba padne na dno", s0.cells[5 * 7 + 3] === BOMB);
  const r = replay(c, ["2", "4", "3", "R"]);
  const ev = r.evs[3], boom = ev.rounds.find(x => x.boom)?.boom;
  check("shozená bomba bouchne a vymete sousedy", !!boom && boom.ids.length === 4 && r.st.cells.every(v => v === EMPTY), grid(r.st));
  const d = replay(c, ["3", "3"]);
  check("bez otočky bomba nebouchne", d.st.cells.includes(BOMB) && d.st.cells.filter(v => v === X || v === O).length === 2);
}
// 14) placka 8 × 5: sloupec 7 funguje, otočka z ní udělá věž 5 × 8
{
  const c = makeCfg({ start: "x", board: "placka", mod: "klid" });
  const r = replay(c, ["7", "0", "R"]);
  check("placka 8×5 se otočí na 5×8", c.w === 8 && c.h === 5 && r && r.st.w === 5 && r.st.h === 8);
}
// 15) bot Kostkobot: vyhraje, zablokuje, nedaruje; proti náhodě skoro vždy vyhraje, starý hltavý bot s ním prohrává
{
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const win = replay(cfg(), ["0", "6", "0", "6", "1", "6", "2"]);   // o má tři ve sloupci 6, x hrozí dole v řadě
  check("bot vezme výhru", botMove(win.st, rnd) === "6");
  const blk = replay(cfg(), ["0", "6", "0", "5", "0"]);
  check("bot zablokuje", botMove(blk.st, rnd) === "0");
  // starý bot z 31. 10.: vyhraje/zablokuje/bezpečný tah, střed s náhodou, jen o tah dopředu a bez obrany proti otočce
  const greedy = st => {
    const me = st.turn, opp = me === "x" ? "o" : "x", all = s => [...Array(s.w).keys()].map(String);
    const cols = all(st).filter(m => step(st, m));
    const winsFor = (s, who) => all(s).filter(m => { const q = step({ ...s, turn: who }, m); return q && q.st.over && q.st.over.who === who; });
    const w = cols.find(m => step(st, m).st.over?.who === me); if (w) return w;
    const b = winsFor(st, opp).find(m => cols.includes(m)); if (b) return b;
    const safe = cols.filter(m => { const q = step(st, m); return !q.st.over && !winsFor(q.st, opp).length; });
    const pool = safe.length ? safe : cols, mid = (st.w - 1) / 2;
    return pool.map(m => [m, Math.abs(m - mid) + rnd() * 2.2]).sort((a, b) => a[1] - b[1])[0][0];
  };
  const randomMv = st => { const o = [...Array(st.w).keys()].map(String).filter(m => step(st, m)); return o[Math.floor(rnd() * o.length)]; };
  const duel = (opp, n) => {
    let won = 0, lost = 0, ms = 0, moves = 0, turnsByBot = 0; let prev = null;
    for (let i = 0; i < n; i++) {
      const c = makeCfg({ start: i % 2 ? "x" : "o", rnd, prev }); prev = c;
      let st = start(c);
      while (!st.over) {
        let mv;
        if (st.turn === "o") { const t = performance.now(); mv = botMove(st, rnd); ms += performance.now() - t; moves++; if (mv === "L" || mv === "R") turnsByBot++; }
        else mv = opp(st);
        st = step(st, mv).st;
      }
      if (st.over.who === "o") won++; else if (st.over.who === "x") lost++;
    }
    return { won, lost, avg: ms / moves, turnsByBot };
  };
  const vr = duel(randomMv, 100);
  check("bot proti náhodným tahům vyhrává ≥ 95 %", vr.won >= 95, `${vr.won}:${vr.lost}`);
  const vg = duel(greedy, 100);
  check("bot porazí starého bota většinou, ale ne vždy", vg.won >= 55 && vg.won <= 98, `${vg.won}:${vg.lost}, otoček bota ${vg.turnsByBot}, ${vg.avg.toFixed(1)} ms na tah`);
  check("bot přemýšlí pod 60 ms", vg.avg < 60, vg.avg.toFixed(1) + " ms");
}

console.log(`\n${pass} PASS, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
