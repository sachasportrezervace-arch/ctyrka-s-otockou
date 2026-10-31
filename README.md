# Čtyřka s otočkou

Čtyři v řadě pro dva na jednom odkazu. Jednou za partii smíš místo tahu otočit celou desku o 90° a všechno, co není přišroubované, se sesype na novou podlahu.

Hra: https://sachasportrezervace-arch.github.io/ctyrka-s-otockou/

## Pravidla v kostce
- Hoď kámen do sloupce, padá co nejníž. Čtyři své v řadě (vodorovně, svisle, šikmo) vyhrávají.
- Otočka (1× za partii) místo hodu: deska se otočí doleva nebo doprava a kameny se sesypou.
- Čtyřka po otočce jen jednomu = ten vyhrál (otočkou se dá i darovat). Čtyřka oběma naráz = obě vyletí z desky, zbytek se sesype znovu a hraje se dál.
- Každá partie je jiná: deska 7 × 6, 6 × 6 nebo 5 × 7 a překvapení (čistá deska, přišroubovaná kotva, dva cizí kamínky, dvě otočky). Další partie má vždy jinou desku i jiné překvapení. První partie je klasika 7 × 6.
- Poražený začíná další partii, kdo prohrál dvakrát za sebou, má otočku navíc. Série do 3 výher, za série tituly Oblázek → Hora.

## Jak to funguje
- Čistý statický web bez buildu: `index.html`, `src/engine.js` (pravidla, deterministické přehrání z tahů), `src/net.js` (mantledb.sh, kontrola dat), `src/art.js` (postavičky), `src/app.js` (obrazovky, animace).
- Sdílená hra: jeden JSON dokument `https://mantledb.sh/v2/ctyrka-<id>/hra`, odkaz `#r.<id>`. Ukládá se zadání partie a seznam tahů, stav se vždy přehraje. Zápis nejdřív znovu načte dokument a porovná počítadlo `v`.
- Zakladatel je vždy x; jeho zařízení (token v localStorage) nikdy nepřisedne jako soupeř. Třetí zařízení je divák.

## Vývoj a testy
```
node tools/serve.cjs 8809              # http://127.0.0.1:8809/
node tests/engine.test.mjs             # pravidla, 3000 náhodných partií
node tests/net.test.mjs                # role v místnosti, kontrola dat
node tests/e2e.mjs http://127.0.0.1:8809/   # 2 prohlížeče + divák, 3 partie (Playwright, globálně)
node tools/icons.mjs                   # ikony z kreseb
```
