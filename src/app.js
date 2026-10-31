// Čtyřka s otočkou – obrazovky, sdílená hra a animace. Pravidla jsou v engine.js, síť v net.js, kresby v art.js.
import { replay, step, makeCfg, nextGame, tally, other, titleFor, BOARDS, MODS, SERIES_TO, canDrop, landRow, ROCK, X, O } from "./engine.js";
import { loadDoc, saveDoc, store, randId, deviceToken, decode, roleFor } from "./net.js";
import { stoneSVG, teamSVG, ballSVG, cubeSVG, pebbleSVG, rockSVG, turnIcon } from "./art.js";

const $ = id => document.getElementById(id);
const device = deviceToken();
const BASE_URL = location.origin + location.pathname;
const calm = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const wait = ms => new Promise(r => setTimeout(r, calm() ? Math.min(ms, 30) : ms));
const attempt = (f, fb) => { try { return f(); } catch { return fb; } };

// ---------- stav ----------
let g = null, rp = null, room = null, me = null, view = "setup", busy = false, animating = false, net = "", bootSeq = 0;
let sel = null, armed = null, dizzyUntil = 0;
const stEl = new Map();   // id kamene -> prvek na desce
const S = () => rp && rp.st;
const nameOf = p => p === "x" ? g.x : (g.o || "Soupeř");
const freeSeat = () => room && !room.so ? "o" : null;
const over = () => S() && S().over;
const canAct = () => !!g && !!room && (me === "x" || me === "o") && !busy && !animating && !over() && S().turn === me;
const linkFor = () => BASE_URL + "#r." + room.id;
function setG(next) { g = next; rp = replay(g.cfg, g.m); }

// ---------- zvuk: krátké syntetické zvuky, žádné soubory ----------
let ac = null, muted = store.get("c4-mute") === "1";
function tone(f0, f1, ms, type = "sine", vol = .18, delay = 0) {
  if (muted) return;
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
    if (ac.state === "suspended") ac.resume();
    const t = ac.currentTime + delay, o = ac.createOscillator(), gn = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + ms / 1000);
    gn.gain.setValueAtTime(vol, t); gn.gain.exponentialRampToValueAtTime(.001, t + ms / 1000);
    o.connect(gn).connect(ac.destination); o.start(t); o.stop(t + ms / 1000 + .02);
  } catch {}
}
const sfx = {
  drop: (k = 0) => tone(320 - k * 18, 120, 140, "triangle", .22),
  tick: () => tone(900, 700, 40, "square", .04),
  turn: () => { tone(180, 520, 420, "sawtooth", .05); tone(240, 90, 520, "triangle", .12, .1); },
  poof: () => tone(700, 1400, 160, "triangle", .12),
  win: () => [523, 659, 784, 1046].forEach((f, i) => tone(f, f, 200, "triangle", .14, i * .11)),
  lose: () => [392, 330, 262].forEach((f, i) => tone(f, f * .97, 240, "triangle", .1, i * .14)),
};
const buzz = (ms = 12) => { try { navigator.vibrate && navigator.vibrate(ms); } catch {} };
function syncSound() { $("soundWave").style.display = muted ? "none" : ""; $("soundBtn").setAttribute("aria-pressed", String(!muted)); $("soundBtn").title = muted ? "Zvuk vypnutý" : "Zvuk zapnutý"; }
$("soundBtn").addEventListener("click", () => { muted = !muted; store.set("c4-mute", muted ? "1" : "0"); syncSound(); if (!muted) sfx.drop(); });
syncSound();

// ---------- kresby na úvodních obrazovkách ----------
const miniBoard = `<svg viewBox="0 0 64 64" aria-hidden="true"><rect x="4" y="8" width="56" height="48" rx="10" fill="currentColor"/>${[0, 1, 2, 3].map(c => [0, 1, 2].map(r => `<circle cx="${14 + c * 12}" cy="${20 + r * 12}" r="4.2" fill="${r === 2 && c < 2 ? "var(--x)" : r === 2 && c === 2 ? "var(--o)" : "var(--hole)"}"/>`).join("")).join("")}</svg>`;
for (const k of ["setup", "share", "intro"]) { $(k + "Ball").innerHTML = ballSVG(); $(k + "Cube").innerHTML = cubeSVG(); $(k + "Mini").innerHTML = miniBoard; }
$("brandIco").innerHTML = ballSVG(); $("brandIco").dataset.m = "idle";
$("rotL").innerHTML = turnIcon("L"); $("rotR").innerHTML = turnIcon("R");
$("legend").innerHTML = [[ballSVG(), "Kuličky", "idle"], [cubeSVG(), "Kostky", "idle"], [pebbleSVG(), "Cizí kamínek", "idle"], [rockSVG(), "Kotva, nepadá", "idle"]]
  .map(([s, t, m]) => `<div><i data-m="${m}">${s}</i>${t}</div>`).join("");

// ---------- obrazovky ----------
function setView(v) {
  view = v;
  document.body.dataset.view = v;
  for (const id of ["setup", "share", "intro", "info", "game"]) $(id).hidden = id !== (v === "play" ? "game" : v);
  $("newBtn").hidden = v === "setup";
  $("linkBtn").hidden = !(room && !room.solo && g && (v === "play"));
  render();
  if (v === "play") requestAnimationFrame(fit);
}
function render() {
  document.title = canAct() ? "Jsi na tahu · Čtyřka" : "Čtyřka s otočkou";
  if (view === "setup") renderSetup();
  if (view === "share") renderShare();
  if (view === "intro") renderIntro();
  if (view === "play") renderGame();
}

function renderSetup() {
  $("setupBtn").disabled = busy;
  $("setupBtn").textContent = busy ? "Chystám desku…" : "Vyzvat soupeře";
  const list = recentRooms(), box = $("recentList");
  $("recent").hidden = !list.length;
  box.textContent = "";
  for (const r of list) {
    const a = document.createElement("a"); a.className = "btn ghost slim"; a.href = "#r." + r.id;
    a.textContent = `${r.x} × ${r.o || "?"}`;
    const sp = document.createElement("span"); sp.textContent = r.me === "x" || r.me === "o" ? `hraješ jako ${r.me === "x" ? r.x : r.o}` : "díváš se";
    a.append(sp); box.append(a);
  }
}
function renderShare() {
  $("shareLink").value = linkFor();
  $("shareLead").textContent = `${g.o ? g.o + " si" : "Soupeř si"} přisedne, jakmile odkaz otevře. Tahy se pak objevují samy, klidně i po hodinách.`;
  const joined = !!room.so;
  $("shareWait").textContent = joined ? `${nameOf("o")} už sedí u desky.` : "Čekám, až soupeř přisedne…";
  document.querySelector("#share .wait").hidden = joined;
  $("shareGoSub").textContent = S() && S().turn === "x" && !S().ply ? "První hod je tvůj, můžeš začít hned" : "";
  $("shareSend").hidden = !navigator.share;
}
function renderIntro() {
  $("introTitle").textContent = `${g.x} tě vyzývá`;
  if (!$("introName").value) $("introName").value = g.o || store.get("c4-name") || "";
  $("introMine").textContent = `Tohle je moje hra, jsem ${g.x}`;
  $("acceptBtn").disabled = busy;
  $("acceptBtn").textContent = busy ? "Sedám si…" : "Přijmout výzvu";
}

// ---------- hra: HUD ----------
const cfgLabel = c => `${BOARDS[c.b].name} ${BOARDS[c.b].size}`;
function scoreNow() {
  const o = over();
  return o ? tally(g, o) : { sw: g.sw, sc: g.sc, seriesWon: null };
}
function tokens(el, p) {
  const st = S(), have = st.rot[p], total = g.cfg.rot[p === "x" ? 0 : 1];
  const html = Array.from({ length: Math.max(total, have) }, (_, i) => `<i class="${i >= have ? "used" : ""}">${turnIcon("R")}</i>`).join("");
  if (el.dataset.h !== html) { el.innerHTML = html; el.dataset.h = html; }
  el.title = have ? `${have === 1 ? "1 otočka" : have + " otočky"} k dispozici` : "otočka použitá";
}
function renderHud() {
  const st = S(), o = over(), t = scoreNow();
  for (const p of ["x", "o"]) {
    const P = p.toUpperCase(), i = p === "x" ? 0 : 1;
    const team = p === "x" ? "Kuličky" : "Kostky", title = titleFor(t.sc[i]);
    // na tahu = vykulené oči (dychtivě čeká), kdo čeká na soupeře, je v klidu a ztlumený (CSS)
    const mood = o ? (o.kind === "draw" ? "idle" : o.who === p ? "happy" : "sad") : st.turn === p ? "fall" : "idle";
    for (const [box, big] of [[$("ava" + P), false], [$("big" + P), true]]) {
      if (!box.firstChild) box.innerHTML = teamSVG(p);
      box.dataset.m = big && !o && st.turn === p && sel !== null && me === p ? "fall" : mood;
    }
    $("nm" + P).textContent = nameOf(p); $("sn" + P).textContent = nameOf(p);
    $("tt" + P).textContent = title ? `${team} · ${title}` : team;
    $("st" + P).textContent = title ? `${team} · ${title}` : team;
    tokens($("tok" + P), p); tokens($("stok" + P), p);
    const have = st.rot[p];
    $("sl" + P).textContent = have ? (have === 1 ? "1 otočka" : `${have} otočky`) : "otočka použitá";
    const on = !o && st.turn === p;
    $("pl" + P).classList.toggle("is-turn", on); $("side" + P).classList.toggle("is-turn", on);
  }
  if (room && room.solo) { $("score").textContent = "Trénink"; $("score").style.fontSize = "22px"; $("series").textContent = "proti botovi, nic se nepočítá"; return; }
  $("score").style.fontSize = "";
  $("score").innerHTML = `${t.sw[0]}<i>:</i>${t.sw[1]}`;
  $("score").setAttribute("aria-label", `Série: ${nameOf("x")} ${t.sw[0]}, ${nameOf("o")} ${t.sw[1]}`);
  $("series").textContent = `Partie ${g.n} · série do ${SERIES_TO}`;
}

// ---------- hra: řádek nad deskou a spodek ----------
function renderTurn() {
  const st = S(), o = over(), you = p => me === p;
  let title = "", sub = "";
  if (o) {
    if (o.kind === "draw") { title = "Remíza"; sub = "Deska je plná a nikdo nemá čtyřku."; }
    else {
      title = you(o.who) ? "Vyhráváš!" : me === other(o.who) ? `${nameOf(o.who)} vyhrává` : `${nameOf(o.who)} vyhrává`;
      sub = o.by === "drop" ? "Čtyři v řadě." : o.by === "turn" ? "Otočkou! Deska se převrátila a čtyřka byla na světě." : "Otočka se nepovedla: čtyřku darovala soupeři.";
      const t = scoreNow();
      if (t.seriesWon) sub = `${you(t.seriesWon) ? "Série je tvoje!" : "Sérii bere " + nameOf(t.seriesWon) + "."} Nový titul: ${titleFor(t.sc[t.seriesWon === "x" ? 0 : 1])}.`;
    }
  } else if (me === "watch" || !me) {
    title = `${nameOf(st.turn)} je na tahu`; sub = `Díváš se: ${nameOf("x")} × ${nameOf("o")}`;
  } else if (st.turn === me) {
    title = st.ply === 0 && g.n === 1 ? "Začínáš" : "Tvůj tah";
    // v prvních tazích radí spodní nápověda u ovládání, nahoře by se opakovala
    sub = st.ply < 2 ? "" : st.rot[me] ? "Hoď do sloupce, nebo otoč desku." : "Hoď do sloupce. Otočku už nemáš.";
  } else {
    title = room.so || me === "o" ? `${nameOf(st.turn)} je na tahu` : "Čekáme na soupeře";
    sub = room.so || me === "o" ? "Tah se tu objeví sám." : "Pošli odkaz, ať si přisedne.";
  }
  // na začátku partie: co je dnes jinak
  if (!o && st.ply < 2 && (me === "x" || me === "o") && (g.n > 1 || room.solo)) {
    const c = g.cfg, mod = MODS[c.mod];
    sub = `<b>Partie ${g.n}: ${cfgLabel(c)}${c.mod !== "klid" ? " · " + mod.name : ""}.</b> ${c.mod !== "klid" ? mod.hint : g.n === 1 ? "Klasika na rozehřátí." : mod.hint}`;
    if ((g.n > 1 || room.solo) && st.ply === 0) {
      sub += st.turn === me ? " Začínáš ty." : ` Začíná ${esc(nameOf(st.turn))}.`;
      const extra = ["x", "o"].filter((p, i) => c.rot[i] - 1 - (c.mod === "otocky" ? 1 : 0) > 0);
      for (const p of extra) sub += p === me ? " Za dvě prohry máš otočku navíc." : ` ${esc(nameOf(p))} má za dvě prohry otočku navíc.`;
    }
  }
  $("turnTitle").textContent = title;
  if (/<b>/.test(sub)) $("turnSub").innerHTML = sub; else $("turnSub").textContent = sub;
}
function renderCtrl() {
  const st = S(), o = over(), mine = (me === "x" || me === "o") && !o && st.turn === me;
  for (const d of ["L", "R"]) {
    const b = $("rot" + d);
    const show = mine && st.rot[me] > 0;
    b.classList.toggle("gone", !show);
    b.classList.toggle("armed", armed === d);
    b.disabled = !show || !canAct();
    b.setAttribute("aria-label", armed === d ? `Potvrdit otočení ${d === "L" ? "doleva" : "doprava"}` : `Otočit desku ${d === "L" ? "doleva" : "doprava"}`);
  }
  const h = $("hint");
  if (o) {
    const t = scoreNow();
    if (room && room.solo) {
      h.innerHTML = `<div class="row" style="margin:0"><button class="btn slim" id="soloAgain" type="button" style="width:auto">Znovu</button><button class="btn ghost slim" id="soloChallenge" type="button" style="width:auto">Vyzvat soupeře</button></div>`;
      $("soloAgain").onclick = soloAgain;
      $("soloChallenge").onclick = goHome;
    } else if (me === "x" || me === "o") {
      h.innerHTML = `<button class="btn" id="againBtn" type="button">${t.seriesWon ? "Nová série" : "Odveta"}<span>${nextLine(o)}</span></button>`;
      $("againBtn").disabled = busy || animating;
      $("againBtn").onclick = rematch;
    } else h.textContent = "Partie skončila. Další začne, až někdo z hráčů dá odvetu.";
  } else if (me === "watch" || !me) {
    h.innerHTML = `Díváš se.<div class="row"><button class="chip ghost" data-claim="x" type="button">Jsem ${esc(nameOf("x"))}</button><button class="chip ghost" data-claim="o" type="button">Jsem ${esc(nameOf("o"))}</button></div>`;
  } else if (armed) {
    h.innerHTML = `<b>Klepni znovu</b> a deska se otočí ${armed === "L" ? "doleva" : "doprava"}.<br>Kamkoli jinam = zpět.`;
  } else if (mine) {
    // nápověda jen na začátku partie a při výběru sloupce dotykem, jinak by se opakovala s řádkem nad deskou
    const mouse = matchMedia("(hover: hover) and (pointer: fine)").matches;
    h.innerHTML = sel !== null && !mouse ? "<b>Klepni znovu</b> a kámen padne."
      : st.ply < 2 ? `${mouse ? "Klikni" : "Klepni"} na sloupec.${st.rot[me] ? "<br>Kulatá tlačítka otočí desku." : ""}` : "";
  } else if (me === "x" && !room.so) {
    h.innerHTML = `<button class="chip" id="hintLink" type="button">Poslat odkaz soupeři</button>`;
    $("hintLink").onclick = sendLink;
  } else h.innerHTML = `${esc(nameOf(st.turn))} přemýšlí<span class="wait" style="display:inline-flex;margin-left:8px"><i></i><i></i><i></i></span>`;
  if (net) h.insertAdjacentHTML("beforeend", `<div class="small">${esc(net)}</div>`);
}
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
function nextLine(o) {
  const starter = o.kind === "win" ? other(o.who) : other(g.cfg.s);
  return `Jiná deska, ${starter === me ? "začínáš ty" : "začíná " + nameOf(starter)}`;
}
function renderGame() {
  if (!g) return;
  document.body.classList.toggle("ended", !!over());
  renderHud(); renderTurn(); renderCtrl();
  if (!animating) drawBoard(S());
}

// ---------- deska ----------
function mood(st, i) {
  const o = st.over, v = st.cells[i];
  if (v > 2) return "idle";
  const p = v === X ? "x" : "o";
  if (o) return o.kind === "draw" ? "sad" : o.who === p ? "happy" : "sad";
  if (Date.now() < dizzyUntil) return "dizzy";
  // kdo sedí vedle přišroubované kotvy, ten se bojí
  const r = Math.floor(i / st.w), c = i % st.w;
  for (const [dr, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
    const y = r + dr, x = c + dc;
    if (y >= 0 && y < st.h && x >= 0 && x < st.w && st.cells[y * st.w + x] === ROCK) return "fall";
  }
  return "idle";
}
const pos = (el, r, c) => { el.style.transform = `translate(${c * 100}%, ${r * 100}%)`; };
function stoneEl(id, v) {
  let el = stEl.get(id);
  if (!el) {
    el = document.createElement("div"); el.className = "st"; el.dataset.v = v;
    el.innerHTML = `<div>${stoneSVG(v)}</div>`;
    el.style.setProperty("--bd", (Math.random() * 4).toFixed(2) + "s");
    $("stones").append(el); stEl.set(id, el);
  }
  return el;
}
function setDims(st) {
  const gr = $("grid");
  gr.style.setProperty("--w", st.w); gr.style.setProperty("--h", st.h);
  const key = st.w + "x" + st.h;
  if ($("holes").dataset.k !== key) {
    $("holes").dataset.k = key;
    let h = "";
    for (let r = 0; r < st.h; r++) for (let c = 0; c < st.w; c++) h += `<div class="hole" style="left:calc(${c} * var(--cell));top:calc(${r} * var(--cell))"></div>`;
    $("holes").innerHTML = h;
  }
}
function drawBoard(st, { moods = true } = {}) {
  setDims(st);
  const live = new Set();
  for (let i = 0; i < st.cells.length; i++) {
    const v = st.cells[i]; if (!v) continue;
    const id = st.ids[i]; live.add(id);
    const el = stoneEl(id, v);
    el.classList.remove("ghost", "poof", "out");
    pos(el, Math.floor(i / st.w), i % st.w);
    if (moods) el.dataset.m = mood(st, i);
  }
  for (const [id, el] of stEl) if (!live.has(id)) { el.remove(); stEl.delete(id); }
  drawWin(st);
  drawHand();
}
function drawWin(st) {
  const fx = $("fx"), o = st.over;
  fx.setAttribute("viewBox", `0 0 ${st.w} ${st.h}`);
  fx.setAttribute("width", "100%"); fx.setAttribute("height", "100%");
  stEl.forEach(el => el.classList.remove("win"));
  if (!o || o.kind !== "win") { fx.innerHTML = ""; return; }
  let h = "";
  for (const line of o.lines) {
    const a = line[0], b = line[line.length - 1];
    h += `<path class="winline" stroke-width="1.06" d="M${a % st.w + .5} ${Math.floor(a / st.w) + .5} L${b % st.w + .5} ${Math.floor(b / st.w) + .5}"/>`;
    for (const i of line) { const el = stEl.get(st.ids[i]); if (el) el.classList.add("win"); }
  }
  if (fx.dataset.h !== h) { fx.innerHTML = h; fx.dataset.h = h; }
}
// kámen v ruce nad sloupcem (jen když jsem na tahu)
function drawHand() {
  const hand = $("hand"), st = S();
  const show = canAct() && sel !== null && !armed;
  hand.classList.toggle("off", !show);
  if (!show) return;
  if (hand.dataset.p !== me) { hand.innerHTML = teamSVG(me); hand.dataset.p = me; }
  hand.dataset.m = "fall";
  hand.style.transform = `translate(${sel * 100}%, -112%)`;
  // stín, kam kámen dopadne
  let gh = $("stones").querySelector(".st.ghost");
  const r = landRow(st, sel);
  if (r < 0) { gh && gh.remove(); return; }
  if (!gh) { gh = document.createElement("div"); gh.className = "st ghost"; $("stones").append(gh); }
  if (gh.dataset.p !== me) { gh.innerHTML = `<div>${teamSVG(me)}</div>`; gh.dataset.p = me; gh.dataset.m = "idle"; }
  pos(gh, r, sel);
}
function clearGhost() { const gh = $("stones").querySelector(".st.ghost"); gh && gh.remove(); }

// velikost políčka: deska se vejde do čtverce, aby otočka nezměnila měřítko
function fit() {
  if (view !== "play" || !g) return;
  const st = S(), stage = $("stage"), tl = stage.querySelector(".turnline");
  const n = Math.max(BOARDS[g.cfg.b].w, BOARDS[g.cfg.b].h);
  const desk = matchMedia("(min-width: 900px) and (min-height: 560px)").matches;
  // na desktopu má střední sloupec šířku podle desky, proto se šířka bere z okna, ne ze sloupce
  const availW = desk ? innerWidth * .46 : stage.clientWidth, availH = stage.clientHeight - tl.offsetHeight - 8;
  const cell = Math.max(24, Math.floor(Math.min(availW / (n + .3), availH / (n + .3 + 1.15), desk ? 92 : 84)));
  $("game").style.setProperty("--cell", cell + "px");
  $("boardbox").style.setProperty("--n", n);
  void st;
}
addEventListener("resize", fit);
attempt(() => new ResizeObserver(fit).observe($("stage")));

// ---------- animace ----------
const fallMs = rows => Math.round(150 + 85 * Math.sqrt(Math.max(rows, .3)));
function animateTo(el, r, c, ms, ease = "cubic-bezier(.45,0,.9,.55)") {
  return new Promise(res => {
    if (calm()) { pos(el, r, c); return res(); }
    el.style.transition = `transform ${ms}ms ${ease}`;
    void el.offsetWidth;
    pos(el, r, c);
    setTimeout(() => { el.style.transition = ""; res(); }, ms + 20);
  });
}
function landFx(el) { el.classList.remove("land"); void el.offsetWidth; el.classList.add("land"); setTimeout(() => el.classList.remove("land"), 360); }

async function playDrop(prevSt, ev, st) {
  drawBoard(prevSt);
  clearGhost(); $("hand").classList.add("off");
  const el = stoneEl(ev.id, ev.who === "x" ? X : O);
  el.style.transition = ""; pos(el, -1.12, ev.col); el.dataset.m = "fall";
  void el.offsetWidth;
  await animateTo(el, ev.row, ev.col, fallMs(ev.row + 1));
  sfx.drop(ev.row); buzz(10);
  landFx(el); el.dataset.m = "idle";
  await wait(120);
}
async function playTurn(prevSt, ev, st) {
  drawBoard(ev.before);
  clearGhost(); $("hand").classList.add("off");
  const board = $("board"), deg = ev.dir === "R" ? 90 : -90;
  stEl.forEach(el => el.dataset.m = el.dataset.v > 2 ? "idle" : "fall");
  sfx.turn(); buzz(30);
  if (!calm()) {
    board.classList.remove("tilt-L", "tilt-R", "tilting");
    board.style.transition = "transform .62s cubic-bezier(.6,-0.25,.35,1.25)";
    board.style.transform = `rotate(${deg}deg)`;
    await wait(660);
    board.style.transition = "none"; board.style.transform = "";
    void board.offsetWidth; board.style.transition = "";
  }
  // po otočce: stejné kameny v nové orientaci, pak gravitace kolo po kole
  dizzyUntil = Date.now() + 1800;
  for (const round of ev.rounds) {
    drawBoard(round.pre, { moods: false });
    stEl.forEach(el => { el.dataset.m = el.dataset.v > 2 ? "idle" : "dizzy"; el.style.setProperty("--wr", deg + "deg"); el.classList.add("wob"); setTimeout(() => el.classList.remove("wob"), 520); });
    if (round === ev.rounds[0]) await wait(260);
    const byId = new Map(round.moves.map(m => [m.id, m]));
    const jobs = [];
    let k = 0;
    for (const [id, m] of byId) {
      const el = stEl.get(id); if (!el) continue;
      const c = m.to % round.pre.w, r = Math.floor(m.to / round.pre.w);
      const delay = (k++ % 6) * 25;
      jobs.push(wait(delay).then(() => animateTo(el, r, c, fallMs(m.fall))).then(() => { landFx(el); }));
    }
    if (jobs.length) { await Promise.all(jobs); sfx.drop(2); buzz(14); }
    if (round.cancel) {
      await wait(280);
      for (const id of round.cancel.ids) { const el = stEl.get(id); if (el) { el.dataset.m = "dizzy"; el.classList.add("poof"); } }
      sfx.poof(); toast("Čtyřka pro oba naráz: obě vyletěly z desky!");
      await wait(480);
      for (const id of round.cancel.ids) { const el = stEl.get(id); if (el) { el.remove(); stEl.delete(id); } }
    }
  }
  await wait(160);
}
// přehraje tahy od-do (vlastní i soupeřovy), pak vykreslí konečný stav
async function playMoves(fromPly) {
  animating = true;
  try {
    const { evs, states } = rp;
    for (let i = fromPly; i < evs.length; i++) {
      const ev = evs[i];
      if (ev.kind === "drop") await playDrop(states[i], ev, states[i + 1]);
      else await playTurn(states[i], ev, states[i + 1]);
    }
    if (over()) endFx();
  } finally {
    animating = false;
    sel = null; armed = null;
    render();
    if (Date.now() < dizzyUntil) setTimeout(() => { if (!animating && view === "play") drawBoard(S()); }, dizzyUntil - Date.now() + 30);
  }
}
function endFx() {
  const o = over();
  if (!o) return;
  if (o.kind === "win" && (o.who === me || me === "watch" || !me)) sfx.win();
  else if (o.kind === "win") sfx.lose();
  buzz(o.kind === "win" && o.who === me ? 60 : 20);
}
async function clearBoard() {
  $("fx").innerHTML = ""; $("fx").dataset.h = ""; clearGhost();
  if (!calm() && stEl.size) {
    let k = 0;
    stEl.forEach(el => { const d = (k++ % 7) * 30; el.style.transition = `transform .5s cubic-bezier(.5,0,.9,.5) ${d}ms, opacity .4s ${d + 160}ms`; el.style.transform += " translateY(1100%)"; el.style.opacity = "0"; });
    sfx.turn();
    await wait(720);
  }
  stEl.forEach(el => el.remove()); stEl.clear();
}

// ---------- hraní ----------
function colFromEvent(ev) {
  const r = $("grid").getBoundingClientRect(), st = S();
  const c = Math.floor((ev.clientX - r.left) / (r.width / st.w));
  return c >= 0 && c < st.w ? c : null;
}
$("grid").addEventListener("pointermove", ev => {
  if (ev.pointerType !== "mouse" || !canAct() || armed) return;
  const c = colFromEvent(ev);
  if (c !== sel) { sel = c; drawHand(); renderCtrl(); }
});
$("grid").addEventListener("pointerleave", ev => { if (ev.pointerType === "mouse" && canAct()) { sel = null; drawHand(); renderCtrl(); } });
$("grid").addEventListener("click", ev => {
  if (!canAct()) return;
  if (armed) { disarm(); return; }
  const c = colFromEvent(ev);
  if (c === null) return;
  if (!canDrop(S(), c)) { toast("Tenhle sloupec je plný."); return; }
  const mouse = matchMedia("(hover: hover) and (pointer: fine)").matches;
  if (mouse || sel === c) { play(String(c)); return; }
  sel = c; sfx.tick(); drawHand(); renderCtrl(); renderHud();
});
for (const d of ["L", "R"]) $("rot" + d).addEventListener("click", ev => {
  ev.stopPropagation();
  if (!canAct() || !S().rot[me]) return;
  if (armed === d) { disarm(); play(d); return; }
  armed = d; sel = null; clearGhost();
  const b = $("board"); b.classList.add("tilting"); b.classList.remove("tilt-L", "tilt-R"); b.classList.add("tilt-" + d);
  sfx.tick(); buzz(8); drawHand(); renderCtrl();
});
function disarm() {
  armed = null;
  const b = $("board"); b.classList.remove("tilt-L", "tilt-R");
  setTimeout(() => b.classList.remove("tilting"), 400);
  renderCtrl(); drawHand();
}
document.addEventListener("click", ev => {
  if (armed && !ev.target.closest(".rot") && !ev.target.closest("#grid")) disarm();
  const cl = ev.target.closest("[data-claim]"); if (cl) claim(cl.dataset.claim);
});
document.addEventListener("keydown", ev => {
  if (view !== "play" || ev.target.closest("input") || !$("rules").hidden) return;
  if (!canAct()) return;
  const st = S();
  if (ev.key === "ArrowLeft" || ev.key === "ArrowRight") {
    ev.preventDefault();
    if (armed) disarm();
    const d = ev.key === "ArrowLeft" ? -1 : 1;
    sel = sel === null ? Math.floor(st.w / 2) : (sel + d + st.w) % st.w;
    sfx.tick(); drawHand(); renderCtrl();
  } else if ((ev.key === "Enter" || ev.key === " " || ev.key === "ArrowDown") && !ev.target.closest("button")) {
    ev.preventDefault();
    if (armed) { const d = armed; disarm(); play(d); }
    else if (sel !== null && canDrop(st, sel)) play(String(sel));
  } else if (ev.key === "q" || ev.key === "Q" || ev.key === "e" || ev.key === "E") {
    $(/q/i.test(ev.key) ? "rotL" : "rotR").click();
  } else if (ev.key === "Escape" && armed) disarm();
});

async function play(mv) {
  if (!canAct()) return;
  const base = g, basePly = g.m.length;
  const next = { ...g, m: [...g.m, mv] };
  if (!replay(next.cfg, next.m)) return;
  sel = null; armed = null;
  // animace běží hned, zápis souběžně; když neprojde, deska se srovná podle serveru
  setG(next);
  if (room.solo) { render(); await playMoves(basePly); botTurn(); return; }
  const saving = commit(next, cur => cur.n === base.n && cur.m.length === basePly, "Mezitím se hra změnila, tah se nezapsal.");
  render();
  await playMoves(basePly);
  if (!(await saving)) hardApply(base);
}
async function rematch() {
  const o = over();
  if (!o || busy || animating) return;
  const base = g, next = nextGame(g, o);
  const okd = await commit(next, cur => cur.n === base.n && cur.m.length === base.m.length, "Odvetu už mezitím dal soupeř.");
  if (!okd) { hardApply(base); return; }
  setG(next);
  await newGameFx();
}
async function newGameFx() {
  animating = true;
  try { await clearBoard(); } finally { animating = false; }
  sel = null; armed = null;
  fit(); render();
  // cizí kamínky na nové desce dopadnou jeden po druhém
  if (calm()) return;
  let k = 0;
  stEl.forEach(el => {
    if (el.dataset.v !== "3") return;
    const tr = el.style.transform;
    el.style.transform = tr.replace(/,\s*[^,)]+\)$/, ", -120%)");
    void el.offsetWidth;
    setTimeout(() => {
      el.style.transition = "transform .45s cubic-bezier(.45,0,.9,.55)"; el.style.transform = tr;
      setTimeout(() => { el.style.transition = ""; landFx(el); sfx.drop(1); }, 460);
    }, 250 + k++ * 180);
  });
}

// ---------- zápis do místnosti ----------
// Každý zápis nejdřív znovu načte dokument a porovná počítadlo v; kdo zapisuje nad starým stavem, neprojde.
// Při neúspěchu nechá v lastDoc poslední dokument ze serveru (nebo null) a g nemění.
let lastDoc = null;
async function commit(next, ok, conflictText) {
  busy = true; pollSeq++; lastDoc = null;
  const fail = text => { busy = false; toast(text); return false; };
  let d;
  try { d = await loadDoc(room.id); } catch { return fail("Spojení nevyšlo, zkus to znovu."); }
  lastDoc = d;
  const cur = d && decode(d.g);
  if (!d || !cur || d.v !== room.v || !ok(cur)) return fail(conflictText);
  try { await saveDoc(room.id, { ...d, g: next, v: d.v + 1 }); } catch { return fail("Tah se nepodařilo odeslat, zkus to znovu."); }
  lastDoc = null;
  room.v = d.v + 1; room.sx = d.sx || ""; room.so = d.so || "";
  busy = false; lastChange = Date.now(); remember();
  if (!animating) render();
  return true;
}
// po neúspěšném zápisu: stav ze serveru, jinak zpět na base; deska se překreslí natvrdo
function hardApply(base) {
  const s = lastDoc && decode(lastDoc.g);
  if (s) { room.v = lastDoc.v; room.sx = lastDoc.sx || ""; room.so = lastDoc.so || ""; setG(s); } else setG(base);
  lastDoc = null;
  stEl.forEach(el => el.remove()); stEl.clear();
  sel = null; armed = null; fit(); render();
}

function apply(d, force) {
  if (!room || !d) return;
  const seats = room.sx + "|" + room.so;
  room.sx = d.sx || ""; room.so = d.so || "";
  const s = decode(d.g);
  if (!s) return;
  if (d.v === room.v && !force) { if (seats !== room.sx + "|" + room.so) { if (view === "share") renderShare(); else render(); } return; }
  const prev = g;
  room.v = d.v; lastChange = Date.now();
  setG(s);
  if (view === "intro") { if (!freeSeat()) setView("play"); else render(); return; }
  if (view === "share") { renderShare(); return; }
  if (view !== "play") return;
  remember();
  const sameGame = prev && prev.n === s.n && prev.m.every((m, i) => s.m[i] === m);
  if (sameGame && s.m.length > prev.m.length) { render(); playMoves(prev.m.length); }
  else if (sameGame && s.m.length === prev.m.length) render();
  else if (prev && s.n > prev.n) newGameFx();
  else { stEl.forEach(el => el.remove()); stEl.clear(); fit(); render(); }
}

// ---------- dotazování ----------
let pollT = null, pollSeq = 0, lastChange = Date.now(), fails = 0;
function interval() {
  const idle = Date.now() - lastChange;
  const ms = idle < 5 * 60e3 ? 2500 : idle < 30 * 60e3 ? 10000 : 30000;
  return fails ? Math.min(60000, ms * 2 ** Math.min(fails, 4)) : ms;
}
function schedule(ms) { clearTimeout(pollT); pollT = setTimeout(poll, ms); }
async function poll() {
  clearTimeout(pollT);
  if (!room || room.v < 0 || document.hidden) return;
  if (busy || animating) { schedule(1200); return; }
  const id = room.id, seq = ++pollSeq;
  try {
    const d = await loadDoc(id);
    if (!room || room.id !== id || seq !== pollSeq || busy || animating) return schedule(interval());
    fails = 0;
    if (net) { net = ""; render(); }
    if (d) apply(d);
  } catch {
    fails++;
    if (fails >= 2 && !net) { net = "Spojení vázne, zkouším to znovu…"; render(); }
  }
  schedule(interval());
}
function wake() { if (room && !room.solo && !document.hidden) { lastChange = Date.now(); poll(); } }
document.addEventListener("visibilitychange", wake);
addEventListener("pageshow", e => { if (e.persisted) wake(); });
addEventListener("online", wake);
addEventListener("focus", wake);

// ---------- přisednutí ----------
// Zakladatel je vždy x a jeho zařízení se nikdy neposadí jako soupeř (roleFor). Kdo otevře cizí odkaz, vidí výzvu.
$("introForm").addEventListener("submit", async ev => {
  ev.preventDefault();
  if (busy || !room) return;
  const name = $("introName").value.trim().slice(0, 16);
  if (!name) return;
  busy = true; render();
  let d;
  try { d = await loadDoc(room.id); }
  catch { busy = false; toast("Spojení nevyšlo, zkus to znovu."); render(); return; }
  const cur = d && decode(d.g);
  if (!d || !cur || d.so || d.sx === device) { busy = false; toast("Výzvu už přijal někdo jiný. Můžeš se dívat."); if (d) { me = "watch"; apply(d, true); } setView("play"); return; }
  const nd = { ...d, v: d.v + 1, so: device, g: { ...d.g, o: name } };
  try { await saveDoc(room.id, nd); }
  catch { busy = false; toast("Spojení nevyšlo, zkus to znovu."); render(); return; }
  busy = false; store.set("c4-name", name);
  room.v = nd.v; room.sx = nd.sx || ""; room.so = nd.so;
  setG(decode(nd.g));
  setMe("o"); setView("play");
});
function claim(p) {
  if (!room || !g || !confirm(`Pokračovat v tomhle prohlížeči jako ${nameOf(p)}?`)) return;
  setMe(p); setView("play");
}
$("introMine").addEventListener("click", () => claim("x"));
function setMe(p) { me = p; store.set("c4-r-" + room.id, p); remember(); }

// ---------- odkaz ----------
function toast(text) {
  const t = $("toast");
  t.textContent = text; t.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => t.hidden = true, 3200);
}
async function copy(text, done) {
  try { await navigator.clipboard.writeText(text); toast(done); }
  catch { window.prompt("Zkopíruj si odkaz:", text); }
}
async function sendLink() {
  const text = `${g.x} tě vyzývá na Čtyřku s otočkou. Otevři odkaz a přisedni si:`;
  if (navigator.share) { try { await navigator.share({ title: "Čtyřka s otočkou", text, url: linkFor() }); return; } catch (e) { if (e && e.name === "AbortError") return; } }
  copy(linkFor(), "Odkaz je zkopírovaný, pošli ho soupeři");
}
$("shareSend").addEventListener("click", sendLink);
$("shareCopy").addEventListener("click", () => copy(linkFor(), "Odkaz je zkopírovaný"));
$("shareGo").addEventListener("click", () => setView("play"));
$("linkBtn").addEventListener("click", () => room && !room.so ? sendLink() : copy(linkFor(), "Odkaz na hru je zkopírovaný"));

// ---------- rozehrané hry na tomhle zařízení ----------
function recentRooms() { return attempt(() => JSON.parse(store.get("c4-rooms") || "[]"), []).filter(r => r && /^[0-9a-z]{6,24}$/.test(r.id)); }
function remember() {
  if (!room || room.solo || !g) return;
  const list = recentRooms().filter(r => r.id !== room.id);
  list.unshift({ id: room.id, x: g.x, o: g.o, me });
  store.set("c4-rooms", JSON.stringify(list.slice(0, 5)));
}

// ---------- sólo: trénink proti botovi ----------
// Jen v tomhle prohlížeči: žádná místnost, žádný zápis ani dotazování, nic se nepočítá do série ani titulů.
// Desky a překvapení se losují stejně jako v ostré hře, začínající se střídá.
function startSolo(prevCfg = null) {
  clearTimeout(pollT); bootSeq++;
  room = { id: "solo", v: 0, sx: device, so: "bot", solo: true }; me = "x";
  busy = false; net = ""; sel = null; armed = null;
  stEl.forEach(el => el.remove()); stEl.clear();
  setG({ x: store.get("c4-name") || "Ty", o: "Kostkobot", n: 1, cfg: makeCfg({ start: prevCfg ? other(prevCfg.s) : "x", prev: prevCfg }), m: [], sw: [0, 0], sc: [0, 0], ls: [0, 0] });
  if (location.hash !== "#solo") history.replaceState(null, "", location.pathname + location.search + "#solo");
  setView("play"); fit(); render();
  botTurn();
}
async function soloAgain() {
  if (animating) return;
  animating = true;
  try { await clearBoard(); } finally { animating = false; }
  startSolo(g.cfg);
}
// bot: vyhraje, když může (i otočkou); jinak zablokuje; nehraje tah, po kterém by soupeř hned vyhrál; rád střed, s náhodou
function botMove(st) {
  const me = st.turn, opp = other(me), all = s => [...Array(s.w).keys()].map(String);
  const cols = all(st).filter(m => step(st, m));
  const winsFor = (s, who) => all(s).filter(m => { const r = step({ ...s, turn: who }, m); return r && r.st.over && r.st.over.who === who; });
  const win = cols.find(m => step(st, m).st.over?.who === me);
  if (win) return win;
  const turns = st.rot[me] ? ["L", "R"].filter(d => step(st, d)) : [];
  const turnWin = turns.find(d => step(st, d).st.over?.who === me);
  if (turnWin) return turnWin;
  const block = winsFor(st, opp).find(m => cols.includes(m));
  if (block) return block;
  const safe = cols.filter(m => { const r = step(st, m); return !r.st.over && !winsFor(r.st, opp).length; });
  // občas otočí, ať je vidět, co otočka umí, ale jen když tím nic nedaruje
  if (st.ply > 7 && Math.random() < .18) {
    const ok = turns.filter(d => { const r = step(st, d); return !r.st.over && !winsFor(r.st, opp).length; });
    if (ok.length) return ok[Math.floor(Math.random() * ok.length)];
  }
  const pool = safe.length ? safe : cols, mid = (st.w - 1) / 2;
  return pool.map(m => [m, Math.abs(m - mid) + Math.random() * 2.2]).sort((a, b) => a[1] - b[1])[0][0];
}
async function botTurn() {
  if (!room || !room.solo || !g || over() || S().turn !== "o") return;
  const game = g;
  await wait(650 + Math.random() * 450);
  if (g !== game || !room || !room.solo || animating) return;
  const base = g.m.length;
  setG({ ...g, m: [...g.m, botMove(S())] });
  render();
  await playMoves(base);
}
$("soloBtn").addEventListener("click", () => startSolo());

// ---------- založení ----------
$("setupForm").addEventListener("submit", async ev => {
  ev.preventDefault();
  const x = $("nameX").value.trim().slice(0, 16), o = $("nameO").value.trim().slice(0, 16);
  if (!x || busy) return;
  store.set("c4-name", x);
  busy = true; render();
  const id = randId(12);
  // první partie: klasická deska bez překvapení a začíná zakladatel, ať může hodit hned
  const s = { x, o, n: 1, cfg: makeCfg({ start: "x", board: "klasika", mod: "klid" }), m: [], sw: [0, 0], sc: [0, 0], ls: [0, 0] };
  const d = { app: "ctyrka", g: s, v: 1, sx: device, so: "" };
  try { await saveDoc(id, d); }
  catch { busy = false; toast("Hru se nepodařilo založit. Zkontroluj připojení a zkus to znovu."); render(); return; }
  busy = false; setG(s);
  room = { id, v: 1, sx: device, so: "" };
  bootSeq++;
  history.replaceState(null, "", location.pathname + location.search + "#r." + id);
  setMe("x");
  lastChange = Date.now(); schedule(2500);
  setView("share");
});
function showSetup() {
  if (!$("nameX").value) $("nameX").value = store.get("c4-name") || "";
  setView("setup");
}
function goHome() {
  clearTimeout(pollT); bootSeq++;
  room = null; me = null; g = null; rp = null; busy = false; net = ""; sel = null; armed = null;
  stEl.forEach(el => el.remove()); stEl.clear();
  history.pushState(null, "", location.pathname + location.search);
  showSetup();
}
$("newBtn").addEventListener("click", goHome);
$("brandBtn").addEventListener("click", () => { if (view !== "setup") goHome(); });
$("infoNew").addEventListener("click", goHome);
$("infoRetry").addEventListener("click", boot);

// ---------- pravidla ----------
const openRules = () => { $("rules").hidden = false; $("rulesClose").focus(); };
$("rulesBtn").addEventListener("click", openRules);
document.querySelectorAll("[data-rules]").forEach(b => b.addEventListener("click", openRules));
$("rulesClose").addEventListener("click", () => $("rules").hidden = true);
$("rules").addEventListener("click", ev => { if (ev.target === $("rules")) $("rules").hidden = true; });
document.addEventListener("keydown", ev => { if (ev.key === "Escape") { $("rules").hidden = true; $("fsHint").hidden = true; } });

// ---------- celá obrazovka ----------
// Kde jde Fullscreen API (desktop, Android, iPad), tlačítko přepíná celou obrazovku. iPhone ho pro stránky nemá,
// tam tlačítko ukáže nápovědu „Přidat na plochu“. Z plochy tlačítko mizí.
const FS_ICON = { enter: "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5", exit: "M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" };
const fsRoot = document.documentElement;
const fsRequest = fsRoot.requestFullscreen || fsRoot.webkitRequestFullscreen;
const fsExit = document.exitFullscreen || document.webkitExitFullscreen;
const onPhone = /iPhone|iPod/.test(navigator.userAgent);
const canFs = !!fsRequest && !!fsExit && !onPhone && (document.fullscreenEnabled ?? document.webkitFullscreenEnabled) !== false;
const fsOn = () => !!(document.fullscreenElement || document.webkitFullscreenElement);
const installed = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
function syncFs() {
  const on = fsOn(), b = $("fsBtn"), label = on ? "Ukončit celou obrazovku" : "Celá obrazovka";
  b.hidden = installed();
  b.setAttribute("aria-label", label); b.title = label;
  $("fsIcon").setAttribute("d", on ? FS_ICON.exit : FS_ICON.enter);
  setTimeout(fit, 120);
}
$("fsBtn").addEventListener("click", async () => {
  if (!canFs) { $("fsHint").hidden = false; return; }
  try { await (fsOn() ? fsExit.call(document) : fsRequest.call(fsRoot, { navigationUI: "hide" })); }
  catch { $("fsHint").hidden = false; }
});
$("fsHintClose").addEventListener("click", () => $("fsHint").hidden = true);
["fullscreenchange", "webkitfullscreenchange"].forEach(ev => document.addEventListener(ev, syncFs));
syncFs();

// ---------- start ----------
function info(title, meta, retry) {
  $("infoTitle").textContent = title;
  $("infoMeta").textContent = meta; $("infoMeta").hidden = !meta;
  $("infoRetry").hidden = !retry; $("infoNew").hidden = retry === null;
  setView("info");
}
async function openRoom(id, seq) {
  room = { id, v: -1, sx: "", so: "" };
  info("Otevírám hru…", "", null);
  let d;
  try { d = await loadDoc(id); }
  catch { if (seq === bootSeq) info("Hru se nepodařilo načíst.", "Zkontroluj připojení a zkus to znovu.", true); return; }
  if (seq !== bootSeq) return;
  const s = d && decode(d.g);
  if (!s) { room = null; info("Tahle hra tu není.", "Odkaz je špatně zkopírovaný, nebo hra vypršela (ukládá se 30 dní od posledního tahu).", false); return; }
  setG(s);
  room.v = d.v; room.sx = d.sx || ""; room.so = d.so || "";
  const role = roleFor(d, device, store.get("c4-r-" + id));
  lastChange = Date.now(); schedule(2500);
  if (role === "join") { me = null; setView("intro"); return; }
  me = role;
  remember();
  setView("play");
  if (over()) endFx();
}
function boot() {
  const seq = ++bootSeq;
  clearTimeout(pollT);
  room = null; me = null; busy = false; net = ""; fails = 0; sel = null; armed = null;
  stEl.forEach(el => el.remove()); stEl.clear();
  const h = (location.hash || "").replace(/^#/, "");
  if (h === "solo") { startSolo(); return; }
  const r = /^r\.([0-9a-z]{6,24})$/.exec(h);
  if (r) { openRoom(r[1], seq); return; }
  g = null; rp = null; showSetup();
}
addEventListener("hashchange", boot);
document.fonts && document.fonts.ready.then(() => { document.body.dataset.ready = "1"; fit(); });
boot();
// pro testy: stav bez sahání do DOM
window.__c4 = { get g() { return g; }, get me() { return me; }, get room() { return room; }, get view() { return view; }, get animating() { return animating; }, get busy() { return busy; } };
