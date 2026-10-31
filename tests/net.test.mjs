// node tests/net.test.mjs – kdo je kdo v místnosti a kontrola dat ze sítě (bez sítě)
import { roleFor, decode } from "../src/net.js";
import { makeCfg } from "../src/engine.js";

let pass = 0, fail = 0;
const check = (name, ok) => { ok ? pass++ : fail++; console.log(`${ok ? "PASS" : "FAIL"}  ${name}`); };

const doc = (sx, so) => ({ sx, so });
// regrese: zakladatel nikdy nepřisedne sám k sobě, ani když místo soupeře je volné a nic nemá uložené
check("zakladatel na vlastním odkazu je x, ne výzva", roleFor(doc("A", ""), "A", null) === "x");
check("zakladatel s uloženou rolí zůstane x", roleFor(doc("A", ""), "A", "x") === "x");
check("cizí zařízení u volného místa dostane výzvu", roleFor(doc("A", ""), "B", null) === "join");
check("soupeř po přisednutí je o", roleFor(doc("A", "B"), "B", null) === "o");
check("třetí zařízení je divák", roleFor(doc("A", "B"), "C", null) === "watch");
check("uložená role vyhrává (stejný prohlížeč)", roleFor(doc("A", "B"), "Z", "o") === "o");

const g = { x: "Mark", o: "", n: 1, cfg: makeCfg({ start: "x", board: "klasika", mod: "klid" }), m: [], sw: [0, 0], sc: [0, 0], ls: [0, 0] };
check("platná hra projde", !!decode(g));
check("hra bez jména zakladatele neprojde", decode({ ...g, x: "" }) === null);
check("nelegální tah neprojde", decode({ ...g, m: ["9"] }) === null);
check("cizí deska neprojde", decode({ ...g, cfg: { ...g.cfg, w: 9 } }) === null);
check("jméno se zkrátí na 16 znaků", decode({ ...g, x: "x".repeat(40) }).x.length === 16);

console.log(`\n${pass} PASS, ${fail} FAIL`);
process.exit(fail ? 1 : 0);
