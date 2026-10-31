// Čtyřka s otočkou – pravidla bez UI. Stejný kód běží v prohlížeči i v node testech.
// Deska: w × h, index = r * w + c, řádek 0 nahoře, gravitace vždy dolů v aktuální orientaci.
// Buňka: 0 prázdno, 1 = hráč x (kuličky), 2 = hráč o (kostky), 3 = kamínek (nikoho, padá), 4 = kotva (nikoho, nepadá).
// Partie se neukládá jako deska, ale jako zadání (cfg) + seznam tahů; stav se vždy přehraje od začátku.
// Tah: "0"–"7" = hoď do sloupce, "L" = otoč desku doleva (proti směru hodin), "R" = doprava (po směru).

export const EMPTY = 0, X = 1, O = 2, PEB = 3, ROCK = 4;
export const other = p => p === "x" ? "o" : "x";
const code = p => p === "x" ? X : O;

export const BOARDS = {
  klasika: { w: 7, h: 6, name: "Klasika", size: "7 × 6" },
  kostka: { w: 6, h: 6, name: "Kostka", size: "6 × 6" },
  vez: { w: 5, h: 7, name: "Věž", size: "5 × 7" },
};
export const MODS = {
  klid: { name: "Čistá deska", hint: "Žádné překvapení. Jen vy dva a otočka." },
  kotva: { name: "Kotva", hint: "Šutr přišroubovaný k desce. Nepadá ani po otočce." },
  kaminky: { name: "Kamínky", hint: "Dva cizí kamínky. Nepatří nikomu a padají s ostatními." },
  otocky: { name: "Dvě otočky", hint: "Každý má v téhle partii otočky dvě." },
};
export const SERIES_TO = 3;
// tituly podle počtu vyhraných sérií (každá série = kdo dřív vyhraje 3 partie)
const TITLES = [[10, "Hora"], [6, "Skála"], [4, "Balvan"], [3, "Valoun"], [2, "Šutr"], [1, "Oblázek"]];
export const titleFor = n => (TITLES.find(([min]) => n >= min) || [0, ""])[1];
export const nextTitle = n => { const t = [...TITLES].reverse().find(([min]) => min > n); return t ? { at: t[0], name: t[1] } : null; };

// ---------- zadání partie ----------
// rnd: funkce vracející 0..1 (v prohlížeči Math.random, v testech semínko). prev = zadání minulé partie (nechceme stejné dvakrát po sobě).
export function makeCfg({ start, bonus = [0, 0], rnd = Math.random, prev = null, board = null, mod = null }) {
  const pick = a => a[Math.floor(rnd() * a.length)];
  let b = board, m = mod;
  for (let i = 0; i < 20 && (!b || !m || (prev && prev.b === b && prev.mod === m)); i++) {
    b = board || pick(Object.keys(BOARDS));
    m = mod || pick(Object.keys(MODS));
  }
  const { w, h } = BOARDS[b];
  const cfg = { b, w, h, mod: m, s: start, rot: [1 + bonus[0], 1 + bonus[1]], rocks: [], peb: [] };
  if (m === "otocky") cfg.rot = cfg.rot.map(n => n + 1);
  if (m === "kotva") {
    // kotva nikdy na kraji ani ve spodní a horní řadě: aby pod ní zbylo místo, které odhalí až otočka
    const r = 1 + Math.floor(rnd() * Math.max(1, h - 3)), c = 1 + Math.floor(rnd() * (w - 2));
    cfg.rocks = [r * w + c];
  }
  if (m === "kaminky") {
    const cols = [...Array(w).keys()];
    for (let i = 0; i < 2; i++) cfg.peb.push(cols.splice(Math.floor(rnd() * cols.length), 1)[0]);
  }
  return cfg;
}

export function validCfg(c) {
  if (!c || typeof c !== "object" || !BOARDS[c.b] || !MODS[c.mod]) return false;
  const { w, h } = BOARDS[c.b];
  const intIn = (v, n) => Number.isInteger(v) && v >= 0 && v < n;
  return c.w === w && c.h === h && (c.s === "x" || c.s === "o")
    && Array.isArray(c.rot) && c.rot.length === 2 && c.rot.every(n => intIn(n, 6))
    && Array.isArray(c.rocks) && c.rocks.length <= 2 && c.rocks.every(i => intIn(i, w * h))
    && Array.isArray(c.peb) && c.peb.length <= 3 && c.peb.every(i => intIn(i, w));
}

// ---------- stav ----------
function fresh(cfg) {
  const st = {
    w: cfg.w, h: cfg.h, cells: new Array(cfg.w * cfg.h).fill(EMPTY), ids: new Array(cfg.w * cfg.h).fill(0),
    nextId: 1, turn: cfg.s, rot: { x: cfg.rot[0], o: cfg.rot[1] }, angle: 0, over: null, ply: 0,
  };
  for (const i of cfg.rocks) { st.cells[i] = ROCK; st.ids[i] = st.nextId++; }
  for (const c of cfg.peb) { const r = landRow(st, c); if (r >= 0) { st.cells[r * st.w + c] = PEB; st.ids[r * st.w + c] = st.nextId++; } }
  return st;
}
const cloneSt = s => ({ ...s, cells: [...s.cells], ids: [...s.ids], rot: { ...s.rot }, over: s.over && { ...s.over } });

export function landRow(st, c) {
  if (c < 0 || c >= st.w) return -1;
  let r = -1;
  for (let y = 0; y < st.h; y++) { if (st.cells[y * st.w + c] !== EMPTY) break; r = y; }
  return r;
}
export const canDrop = (st, c) => landRow(st, c) >= 0;
export const anyDrop = st => [...Array(st.w).keys()].some(c => canDrop(st, c));

// všechny řady 4+ stejných kamenů daného hráče (každá řada jen jednou, maximální délka)
const DIRS = [[0, 1], [1, 0], [1, 1], [1, -1]];
export function fours(st, who) {
  const v = code(who), out = [];
  const at = (r, c) => r >= 0 && r < st.h && c >= 0 && c < st.w ? st.cells[r * st.w + c] : -1;
  for (let r = 0; r < st.h; r++) for (let c = 0; c < st.w; c++) {
    if (at(r, c) !== v) continue;
    for (const [dr, dc] of DIRS) {
      if (at(r - dr, c - dc) === v) continue;   // není začátek řady
      const line = [];
      for (let y = r, x = c; at(y, x) === v; y += dr, x += dc) line.push(y * st.w + x);
      if (line.length >= 4) out.push(line);
    }
  }
  return out;
}

// gravitace: kameny (ne kotva) padají dolů; vrací přesuny {id, from, to} (indexy v aktuální orientaci)
function settle(st) {
  const moves = [];
  for (let c = 0; c < st.w; c++) {
    let floor = st.h - 1;
    for (let r = st.h - 1; r >= 0; r--) {
      const i = r * st.w + c, v = st.cells[i];
      if (v === EMPTY) continue;
      if (v === ROCK) { floor = r - 1; continue; }
      if (r !== floor) {
        const j = floor * st.w + c;
        st.cells[j] = v; st.ids[j] = st.ids[i]; st.cells[i] = EMPTY; st.ids[i] = 0;
        moves.push({ id: st.ids[j], from: i, to: j, fall: floor - r });
      }
      floor--;
    }
  }
  return moves;
}

// otočení o 90°: R = po směru hodin, L = proti. Rozměry se prohodí.
export function turnGrid(st, dir) {
  const { w, h } = st, cells = new Array(w * h), ids = new Array(w * h), map = new Array(w * h);
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) {
    const nr = dir === "R" ? c : w - 1 - c, nc = dir === "R" ? h - 1 - r : r;
    const j = nr * h + nc;   // nová šířka = h
    cells[j] = st.cells[r * w + c]; ids[j] = st.ids[r * w + c]; map[r * w + c] = j;
  }
  st.cells = cells; st.ids = ids; st.w = h; st.h = w;
  return map;
}

// ---------- tah ----------
// Vrací { st, ev } nebo null, když tah není dovolený. ev popisuje, co animovat.
export function step(prev, mv) {
  if (prev.over) return null;
  const st = cloneSt(prev), who = st.turn;
  let ev;
  if (mv === "L" || mv === "R") {
    if (st.rot[who] < 1) return null;
    st.rot[who]--;
    const before = cloneSt(st);
    const map = turnGrid(st, mv);
    st.angle = (st.angle + (mv === "R" ? 90 : -90) + 360) % 360;
    ev = { kind: "turn", who, dir: mv, before, map, rounds: [] };
    // sesypání a řetězení: obě čtyřky naráz = vyruší se, kameny vyletí a sype se znovu
    for (let guard = 0; guard < 12; guard++) {
      const round = { pre: cloneSt(st), moves: settle(st) };
      ev.rounds.push(round);
      const fx = fours(st, "x"), fo = fours(st, "o");
      if (fx.length && fo.length) {
        const gone = [...new Set([...fx, ...fo].flat())];
        round.cancel = { x: fx, o: fo, ids: gone.map(i => st.ids[i]) };
        for (const i of gone) { st.cells[i] = EMPTY; st.ids[i] = 0; }
        continue;
      }
      if (fx.length || fo.length) {
        const winner = fx.length ? "x" : "o";
        st.over = { kind: "win", who: winner, lines: fx.length ? fx : fo, by: winner === who ? "turn" : "gift" };
      }
      break;
    }
  } else {
    const c = Number(mv);
    if (!/^\d$/.test(mv) || !canDrop(st, c)) return null;
    const r = landRow(st, c), i = r * st.w + c;
    st.cells[i] = code(who); st.ids[i] = st.nextId++;
    ev = { kind: "drop", who, col: c, row: r, idx: i, id: st.ids[i] };
    const f = fours(st, who);
    if (f.length) st.over = { kind: "win", who, lines: f, by: "drop" };
  }
  st.ply++;
  if (!st.over && !anyDrop(st)) st.over = { kind: "draw" };
  if (!st.over) st.turn = other(who);
  return { st, ev };
}

// přehraje celou partii; vrací konečný stav a události všech tahů (null, pokud je seznam tahů neplatný)
export function replay(cfg, moves) {
  let st = fresh(cfg);
  const evs = [], states = [st];
  for (const mv of moves) {
    const r = step(st, mv);
    if (!r) return null;
    st = r.st; evs.push(r.ev); states.push(st);
  }
  return { st, evs, states };
}
export const start = cfg => fresh(cfg);

// ---------- série ----------
// g.sw = výhry v rozehrané sérii [x, o], g.sc = vyhrané série [x, o], g.ls = prohry v řadě [x, o]
// Zapisují se až při založení další partie; během konce partie se výsledek jen dopočítá (tally).
export function tally(g, over) {
  const sw = [...g.sw], sc = [...g.sc], ls = [...g.ls];
  let seriesWon = null;
  if (over && over.kind === "win") {
    const wi = over.who === "x" ? 0 : 1, li = 1 - wi;
    sw[wi]++; ls[wi] = 0; ls[li]++;
    if (sw[wi] >= SERIES_TO) { sc[wi]++; seriesWon = over.who; }
  }
  return { sw, sc, ls, seriesWon };
}
// zadání další partie: kdo prohrál, začíná; kdo prohrál 2× za sebou, má otočku navíc. Remíza = střídání.
export function nextGame(g, over, rnd = Math.random) {
  const t = tally(g, over);
  const start = over && over.kind === "win" ? other(over.who) : other(g.cfg.s);
  const bonus = [t.ls[0] >= 2 ? 1 : 0, t.ls[1] >= 2 ? 1 : 0];
  return {
    ...g, n: g.n + 1, m: [],
    sw: t.seriesWon ? [0, 0] : t.sw, sc: t.sc, ls: t.ls,
    cfg: makeCfg({ start, bonus, rnd, prev: g.cfg }),
  };
}
