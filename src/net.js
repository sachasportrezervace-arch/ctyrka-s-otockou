// Sdílená hra na mantledb.sh (bez účtu, CORS), jeden dokument na místnost: ctyrka-<id>/hra.
// Dokument: { app, g, v, sx, so, u }  g = stav série (níže), v = počítadlo zápisů (každý zápis nejdřív
// znovu načte a porovná v), sx / so = token zařízení, které drží místo ("" = volné), u = čas zápisu.
// g = { x, o, n, cfg, m, sw, sc, ls }: jména, číslo partie, zadání partie, tahy, výhry v sérii, vyhrané série, prohry v řadě.
import { validCfg, replay } from "./engine.js";

const API = "https://mantledb.sh/v2/";
export const docUrl = id => `${API}ctyrka-${id}/hra`;

async function req(url, opt = {}) {
  const ac = new AbortController(), timer = setTimeout(() => ac.abort(), 10000);
  try { return await fetch(url, { ...opt, cache: "no-store", signal: ac.signal }); } finally { clearTimeout(timer); }
}
export async function loadDoc(id) {
  const r = await req(docUrl(id));
  if (r.status === 404) return null;
  if (!r.ok) throw new Error("load " + r.status);
  return r.json();
}
export async function saveDoc(id, d) {
  const r = await req(docUrl(id), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...d, u: Date.now() }) });
  if (!r.ok) throw new Error("save " + r.status);
}

const attempt = (f, fallback) => { try { return f(); } catch { return fallback; } };
export const store = { get: k => attempt(() => localStorage.getItem(k), null), set: (k, v) => attempt(() => localStorage.setItem(k, v)) };
export const randId = n => [...crypto.getRandomValues(new Uint8Array(n))].map(b => (b % 36).toString(36)).join("");
export function deviceToken() {
  const t = store.get("c4-dev") || randId(16);
  store.set("c4-dev", t);
  return t;
}

const str = (v, n) => typeof v === "string" ? v.trim().slice(0, n) : "";
const pair = (a, max) => Array.isArray(a) && a.length === 2 ? a.map(n => Number.isInteger(n) && n >= 0 ? Math.min(n, max) : 0) : [0, 0];
// kontrola všeho, co přijde ze sítě; neplatný stav = null
export function decode(g) {
  if (!g || typeof g !== "object") return null;
  const x = str(g.x, 16);
  if (!x || !validCfg(g.cfg) || !Array.isArray(g.m) || g.m.length > 200) return null;
  const m = g.m.map(v => String(v));
  if (!m.every(v => /^(\d|L|R)$/.test(v)) || !replay(g.cfg, m)) return null;
  return { x, o: str(g.o, 16), n: Number.isInteger(g.n) && g.n > 0 ? g.n : 1, cfg: g.cfg, m, sw: pair(g.sw, 9), sc: pair(g.sc, 999), ls: pair(g.ls, 99) };
}

// Kdo jsem v téhle místnosti? Zakladatel je vždy x a jeho zařízení nikdy nepřisedne jako soupeř.
// saved = role uložená v tomhle prohlížeči ("x" / "o"), jinak rozhodne token zařízení.
// Výsledek: "x" | "o" | "join" (volné místo, nabídni přisednutí) | "watch" (obě místa obsazená = divák)
export function roleFor(doc, device, saved) {
  if (saved === "x" || saved === "o") return saved;
  if (doc.sx && doc.sx === device) return "x";
  if (doc.so && doc.so === device) return "o";
  if (!doc.so) return "join";
  return "watch";
}
