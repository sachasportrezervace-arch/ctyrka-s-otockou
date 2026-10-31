// node design/shoot.cjs [a b ...] – snímky návrhů: iPhone 13 (WebKit) a desktop 1440×900 (Chromium)
const path = require("path");
const PW = process.env.PW || path.join(process.env.APPDATA || "", "npm/node_modules/playwright");
const { chromium, webkit, devices } = require(PW);
const BASE = process.env.BASE || "http://127.0.0.1:8821/design/navrh.html";
const out = path.join(__dirname, "shots");
(async () => {
  const ds = process.argv.slice(2).length ? process.argv.slice(2) : ["a", "b"];
  const wk = await webkit.launch(), ch = await chromium.launch();
  for (const d of ds) {
    const m = await (await wk.newContext({ ...devices["iPhone 13"] })).newPage();
    await m.goto(BASE + "?d=" + d); await m.waitForFunction(() => document.body.dataset.ready); await m.waitForTimeout(300);
    await m.screenshot({ path: path.join(out, d + "-mobil.png") });
    const p = await (await ch.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
    await p.goto(BASE + "?d=" + d); await p.waitForFunction(() => document.body.dataset.ready); await p.waitForTimeout(300);
    await p.screenshot({ path: path.join(out, d + "-desktop.png") });
  }
  await wk.close(); await ch.close();
  console.log("ok");
})();
