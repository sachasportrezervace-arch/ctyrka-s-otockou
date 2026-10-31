// node tools/icons.mjs – ikony aplikace z kreseb v src/art.js (kulička proti kostce na slunečnicové ploše)
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { ballSVG, cubeSVG } from "../src/art.js";

const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW || path.join(process.env.APPDATA || "", "npm/node_modules/playwright"));
const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const css = `:root{--ink:#1C1F4A;--x:#F2492F;--x-dk:#C9321D;--o:#FFF6E6;--o-dk:#D9CCB4;--tongue:#FF8A7A;--sweat:#8FD6FF}
  html,body{margin:0}.f>g{display:none}[data-m=happy] .f-happy,[data-m=idle] .f-idle{display:inline}
  .i{width:512px;height:512px;background:#FFC93E;position:relative;overflow:hidden}
  .i::before{content:"";position:absolute;left:-30%;right:-30%;top:62%;height:90%;border-radius:50%;background:#F5B526}
  .b,.c{position:absolute;width:250px;height:250px}.b{left:44px;top:150px;transform:rotate(-8deg)}.c{right:40px;top:120px;transform:rotate(8deg)}
  svg{width:100%;height:100%;display:block;overflow:visible}`;
const html = `<style>${css}</style><div class="i"><div class="c" data-m="idle">${cubeSVG()}</div><div class="b" data-m="happy">${ballSVG()}</div></div>`;
const b = await chromium.launch();
for (const [file, size] of [["icon-512.png", 512], ["icon-192.png", 192], ["apple-touch-icon.png", 180]]) {
  const p = await b.newPage({ viewport: { width: 512, height: 512 }, deviceScaleFactor: size / 512 });
  await p.setContent(html);
  await p.locator(".i").screenshot({ path: path.join(root, file) });
}
await b.close();
console.log("ikony hotové");
