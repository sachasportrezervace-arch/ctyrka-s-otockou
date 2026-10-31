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
- Design-eye herní kola: kolo 2 „profi“ (5 vad: zdvojené nápovědy, kdo je na tahu, výška desktopu, logo nad avatarem, zalomení titulku),
  kolo 3 „profi“ (zbylo: drobné písmo hlavičky na desktopu, prázdný pás nad deskou, nápověda nahoře i dole). Vše opraveno a zkontrolováno
  na renderech ze `node tests/e2e.mjs` (25 PASS, exit 0). Formální verdikt „profi indie hra“ NEPADL – limit 3 kol vyčerpán, nasazeno s opravami kola 3.
- Nasazeno: repo https://github.com/sachasportrezervace-arch/ctyrka-s-otockou (veřejné, Pages z main), hra https://sachasportrezervace-arch.github.io/ctyrka-s-otockou/
- Živý test: `node tests/e2e.mjs https://sachasportrezervace-arch.github.io/ctyrka-s-otockou/` → 25 PASS, exit 0 (snímky `design/shots/live-*`).
NEOVĚŘENO: „Přidat na plochu“ na skutečném iPhonu, zvuky na skutečném zařízení, ležatý mobil, ovládání klávesnicí, reduced motion.
Další krok, kdyby Mark chtěl víc: čtvrté kolo design-eye jen na rozvržení mobilu (místo nad deskou) a samostatný snímek animace otočky.
