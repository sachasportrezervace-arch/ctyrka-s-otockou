PŘEVZATO 31. 10. – dodělává session na účtu P, jiná session sem nepíše.

# Deník – Čtyřka s otočkou

## 31. 10. 2026 (session účet P, převzato po přerušení 17:43)
Hotovo:
- WIP commit stavu po přerušení (`ba32810`).
- Design: oprava desktopu návrhu (ovládání bylo absolutně v gridu), design-eye vybral směr A „Plakát“ + 8 oprav; vše zapracováno do hry
  (Rammetto One kvůli češtině – Bagel Fat One nemá ů/ě/š…, HUD „Kuličky/Kostky · titul“, otočka jako žeton, kulatá tlačítka otočky u rohů,
  hráči na desktopu u desky, výrazy: strach u kotvy, závrať po otočce, radost/smutek na konci, světlý pruh pod výherní řadou).
- Hra: `index.html` + `src/app.js` (výzva, čekárna s odkazem/sdílením, výzva pro soupeře s pojistkou „Tohle je moje hra“, partie, konec, odveta,
  divák, tituly, zvuky WebAudio s vypínačem, celá obrazovka / návod Přidat na plochu, manifest + ikony `tools/icons.mjs`).
- Otočka: dvoukrokové potvrzení (deska se nakloní jako náhled), animace otočení desky, sesypání kolo po kole, vyrušení čtyřek „poof“.
- Pestrost: 1. partie klasika 7×6 bez překvapení, každá další má jinou desku i překvapení než dvě předchozí (`cfg.pb/pm`),
  poražený začíná, dvě prohry v řadě = otočka navíc.
Ověřeno (příkaz → exit):
- `node tests/engine.test.mjs` → 36 PASS, exit 0
- `node tests/net.test.mjs` → 11 PASS, exit 0 (regrese: zakladatel nikdy nepřisedne sám k sobě)
- `node tests/e2e.mjs http://127.0.0.1:8809/` → 25 PASS, exit 0 (Chromium 1440×900 zakladatel, WebKit iPhone 13 soupeř dotykem, divák;
  3 partie za sebou přes mantledb, tři různé desky i překvapení, otočka v partii 1 a 2, žádné chyby v konzoli). Snímky `design/shots/`.
Zbývá: finální verdikt design-eye (běží), repo `sachasportrezervace-arch/ctyrka-s-otockou` + Pages, živý test `node tests/e2e.mjs https://sachasportrezervace-arch.github.io/ctyrka-s-otockou/`.
