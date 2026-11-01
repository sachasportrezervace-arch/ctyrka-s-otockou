PŘEVZATO 1. 11. – kolo vylepšení, session ctyrka-kolo; jiná session sem nepíše.
PŘEVZATO 31. 10. – dodělává session na účtu P, jiná session sem nepíše.

# Deník – Čtyřka s otočkou

## 1. 11. 2026 – kolo vylepšení (session ctyrka-kolo, zadání `react-apps/HRY-KOLO-2026-11-01.md`)
Necommitnuté snímky v `design/shots` a `tests/herna-live.mjs` byly z Herna session 31. 10. 21:37 (běh e2e), uloženy commitem `aee8a02`.
Hotovo (commity `8d030b0`, `5540949`, `411dd62`, nasazeno):
- Otočka jako scéna: nádech (deska se zvedne, couvne, kameny se třesou s vytřeštěnýma očima, okolí ztichne na .18), otočení s přešvihem a otřes,
  napětí (kameny chvilku visí), sesypání sloupec po sloupci s prachem a cvakáním, otřes podle počtu kamenů. Zrušení obou čtyřek: rozsvítí se, pak jiskra (pryč textový toast přes desku).
- Výherní čtyřka: žlutá svatozář za kameny + žlutý pruh. Sousedé nadskočí při dopadu, oči kamenů sledují kámen v ruce.
- Nové: překvapení **Bomba** (když ji otočka shodí, bouchne a vymete 8 sousedů kromě kotvy; rázová vlna + střepy) a deska **Placka 8 × 5**.
- Bot Kostkobot v `engine.js`: dva tahy dopředu včetně otoček obou, hodnocení otevřených trojic, šum + 12 % zaváhání.
- Méně textu nad deskou („X přemýšlí“, bez podtitulků), mobil na šířku má vlastní rozvržení, v sólu na výšku celá jména.
Ověřeno (příkaz → výsledek, exit 0): `node tests/engine.test.mjs` → 46 PASS (nové: bomba, placka, bot vyhraje/zablokuje, proti náhodě 98:0, proti starému botovi 79:16, 0,6 ms/tah);
`node tests/net.test.mjs` → 11 PASS; lokálně i živě na Pages (`411dd62`): `tests/e2e.mjs` 25 PASS, `tests/solo.mjs` 14 PASS, nový `tests/otocka.mjs` 20 PASS (sekvence snímků `design/shots/seq-*`),
`tests/herna.mjs` lokálně 22 PASS (jednou 1 FAIL, opakování 22 PASS, flaky), `tests/herna-live.mjs` živě 15 PASS.
Design-eye: kolo 1 „OK s výhradami“ (6 vad), kolo 2 „OK s výhradami, těsně pod profi“ (4 vady), opravy kola 3 zapracovány a zkontrolovány na renderech; formální verdikt kola 3 NEPADL (šetření kontextu).
NEOVĚŘENO: skutečný iPhone (zvuky, vibrace, plynulost animace), reduced motion, oči sledující ruku jen na desktopu s myší, staré otevřené záložky se starým app.js nepřečtou zadání s bombou/plackou (stačí obnovit stránku).
Dál: design-eye kolo 3 s razítkem commitu; na šířku je deska 8×5 pořád menší (měřítko drží rotaci na výšku 8), případně schovat lištu ikon.

## 31. 10. 2026 večer – sólo režim hotov (zadání `react-apps/HRY-SOLO-2026-10-31.md`)
Příčina chyby „Znovu“: tlačítko se objeví už při dohrávání poslední animace, `soloAgain` při `animating === true` hned skončil a klik se zahodil.
Oprava: klik počká na doběhnutí animace (max ~6 s), `soloBusy` brání dvojitému spuštění, pak se vyčistí deska a `startSolo(g.cfg)` dá jinou desku i překvapení.
Sólo: `#solo` i tlačítko „Zkusit sám“, bot Kostkobot (vyhraje / zablokuje / nedaruje, občas otočí), HUD „Trénink“, na konci „Znovu“ + „Vyzvat soupeře“, žádný sync.
Ověřeno (příkaz → exit): `node tests/solo.mjs` → 14 PASS, exit 0 (Chromium 1440×900 přes tlačítko, WebKit iPhone 13 přes `#solo`, celá partie s botem, Znovu = jiná deska, 0 požadavků na mantledb, bez chyb v konzoli);
`node tests/engine.test.mjs` → 36 PASS, exit 0; `node tests/net.test.mjs` → 11 PASS, exit 0; `node tests/e2e.mjs http://127.0.0.1:8809/` → 25 PASS, exit 0.
Nasazeno (push `f1e77f4`, Pages built). Živý test: `node tests/solo.mjs https://sachasportrezervace-arch.github.io/ctyrka-s-otockou/` → 14 PASS, exit 0 (snímky `design/shots/live-4*`). NEOVĚŘENO: sólo na skutečném iPhonu; po konci partie na dotyku zůstává u desky „duch“ kostky z posledního náhledu (kosmetika, nezkoumáno).

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
