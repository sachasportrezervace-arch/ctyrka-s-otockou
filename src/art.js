// Kameny jsou postavičky: kuličky (x) a kostky (o), k tomu cizí kamínek a přišroubovaná kotva.
// Každý kámen má všechny výrazy najednou, CSS ukáže ten podle data-m (idle, fall, happy, sad, dizzy).
// Plochý vektor: jedna barva těla, jeden tmavší odstín jako stín, jeden světlý odlesk, inkoust na obličej.

const ink = "var(--ink)";
const S = (d, w = 4.5) => `fill="none" stroke="${ink}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" d="${d}"`;

const BALL_FACE = {
  idle: `<g class="eyes"><ellipse cx="37" cy="46" rx="5.2" ry="7.2" fill="${ink}"/><ellipse cx="63" cy="46" rx="5.2" ry="7.2" fill="${ink}"/>
    <circle cx="38.6" cy="43" r="1.9" fill="#fff"/><circle cx="64.6" cy="43" r="1.9" fill="#fff"/></g>
    <path ${S("M29 35.5 L41 33.5")}/><path ${S("M59 33.5 L71 36.5")}/>
    <path ${S("M41 63 Q51 70 60 61")}/>`,
  fall: `<circle cx="36" cy="45" r="10" fill="#fff"/><circle cx="64" cy="45" r="10" fill="#fff"/>
    <circle cx="36" cy="43" r="3.6" fill="${ink}"/><circle cx="64" cy="43" r="3.6" fill="${ink}"/>
    <path ${S("M27 27 Q35 22 43 26")}/><path ${S("M57 26 Q65 22 73 27")}/>
    <ellipse cx="50" cy="69" rx="6" ry="8" fill="${ink}"/>`,
  happy: `<path ${S("M30 48 Q37 39 44 48", 5)}/><path ${S("M56 48 Q63 39 70 48", 5)}/>
    <path d="M35 59 Q50 61 65 59 Q63 77 50 77 Q37 77 35 59Z" fill="${ink}"/>
    <path d="M43 71 Q50 66 57 71 Q54 76 50 76 Q46 76 43 71Z" fill="var(--tongue)"/>`,
  sad: `<ellipse cx="37" cy="49" rx="4.6" ry="5.6" fill="${ink}"/><ellipse cx="63" cy="49" rx="4.6" ry="5.6" fill="${ink}"/>
    <path ${S("M29 41 L42 37")}/><path ${S("M58 37 L71 41")}/>
    <path ${S("M41 69 Q50 62 59 69")}/>
    <path d="M78 28 Q83 36 78 40 Q73 36 78 28Z" fill="var(--sweat)"/>`,
  dizzy: `<path ${S("M31 40 L41 50 M41 40 L31 50")}/><path ${S("M59 40 L69 50 M69 40 L59 50")}/>
    <path ${S("M37 66 q4.5 -5 9 0 t9 0 t9 0")}/>`,
};
const CUBE_FACE = {
  idle: `<circle cx="35" cy="44" r="10.5" fill="#fff"/><circle cx="65" cy="44" r="10.5" fill="#fff"/>
    <g class="eyes"><circle cx="37" cy="45" r="5" fill="${ink}"/><circle cx="67" cy="45" r="5" fill="${ink}"/></g>
    <path ${S("M25 28 L44 30", 5.5)}/><path ${S("M56 30 L75 28", 5.5)}/>
    <path ${S("M39 65 L61 65")}/><rect x="45" y="66" width="7" height="6" rx="1.5" fill="#fff"/>`,
  fall: `<circle cx="34" cy="43" r="12.5" fill="#fff"/><circle cx="66" cy="43" r="12.5" fill="#fff"/>
    <circle cx="34" cy="43" r="3.2" fill="${ink}"/><circle cx="66" cy="43" r="3.2" fill="${ink}"/>
    <path ${S("M24 22 L44 24", 5.5)}/><path ${S("M56 24 L76 22", 5.5)}/>
    <rect x="41" y="60" width="18" height="16" rx="8" fill="${ink}"/>`,
  happy: `<path ${S("M27 46 Q35 36 43 46", 5.5)}/><path ${S("M57 46 Q65 36 73 46", 5.5)}/>
    <path d="M32 57 L68 57 Q68 76 50 76 Q32 76 32 57Z" fill="${ink}"/>
    <rect x="38" y="57" width="24" height="5" rx="1.5" fill="#fff"/>`,
  sad: `<circle cx="35" cy="46" r="10" fill="#fff"/><circle cx="65" cy="46" r="10" fill="#fff"/>
    <circle cx="35" cy="50" r="4.6" fill="${ink}"/><circle cx="65" cy="50" r="4.6" fill="${ink}"/>
    <path ${S("M25 36 L43 31", 5.5)}/><path ${S("M57 31 L75 36", 5.5)}/>
    <path ${S("M40 70 Q50 63 60 70")}/>`,
  dizzy: `<circle cx="35" cy="44" r="10.5" fill="#fff"/><circle cx="65" cy="44" r="10.5" fill="#fff"/>
    <path ${S("M35 44 m-5 0 a5 5 0 1 1 5 5 a2.5 2.5 0 1 1 -2.5 -2.5", 3)}/><path ${S("M65 44 m-5 0 a5 5 0 1 1 5 5 a2.5 2.5 0 1 1 -2.5 -2.5", 3)}/>
    <path ${S("M37 67 q4.5 -5 9 0 t9 0 t9 0")}/>`,
};
const faces = set => `<g class="f">${Object.entries(set).map(([m, s]) => `<g class="f-${m}">${s}</g>`).join("")}</g>`;

const BALL_BODY = `<circle cx="50" cy="50" r="46" fill="var(--x-dk)"/><circle cx="47" cy="46" r="41.5" fill="var(--x)"/>
  <ellipse cx="29" cy="25" rx="8.5" ry="4.6" transform="rotate(-38 29 25)" fill="#fff" opacity=".42"/>
  <ellipse cx="24" cy="60" rx="6" ry="3.6" fill="var(--x-dk)" opacity=".55"/><ellipse cx="74" cy="60" rx="6" ry="3.6" fill="var(--x-dk)" opacity=".55"/>`;
const CUBE_BODY = `<rect x="4" y="4" width="92" height="92" rx="24" fill="var(--o-dk)"/><rect x="4" y="3" width="87" height="87" rx="22" fill="var(--o)"/>
  <rect x="14" y="11" width="18" height="6" rx="3" fill="#fff" opacity=".45"/>`;

export const ballSVG = () => `<svg viewBox="0 0 100 100" aria-hidden="true">${BALL_BODY}${faces(BALL_FACE)}</svg>`;
export const cubeSVG = () => `<svg viewBox="0 0 100 100" aria-hidden="true">${CUBE_BODY}${faces(CUBE_FACE)}</svg>`;

// cizí kamínek: menší, šedý, spí
export const pebbleSVG = () => `<svg viewBox="0 0 100 100" aria-hidden="true">
  <path d="M12 62 Q10 30 42 22 Q76 16 88 44 Q96 74 66 84 Q24 92 12 62Z" fill="var(--peb-dk)"/>
  <path d="M12 58 Q11 28 42 21 Q74 15 85 42 Q92 70 64 79 Q26 86 12 58Z" fill="var(--peb)"/>
  <g class="f"><g class="f-idle"><path ${S("M33 52 q6 5 12 0", 4)}/><path ${S("M57 50 q6 5 12 0", 4)}/><ellipse cx="51" cy="64" rx="3.4" ry="2.8" fill="${ink}"/></g>
  <g class="f-fall"><circle cx="39" cy="50" r="7" fill="#fff"/><circle cx="63" cy="48" r="7" fill="#fff"/><circle cx="39" cy="50" r="2.6" fill="${ink}"/><circle cx="63" cy="48" r="2.6" fill="${ink}"/><ellipse cx="51" cy="66" rx="4" ry="5" fill="${ink}"/></g></g>
</svg>`;
// kotva: šutr přišroubovaný čtyřmi šrouby, zamračený
const bolt = (x, y) => `<circle cx="${x}" cy="${y}" r="6.5" fill="var(--bolt)"/><path d="M${x - 3.6} ${y - 3.6} L${x + 3.6} ${y + 3.6}" stroke="${ink}" stroke-width="2.4" stroke-linecap="round"/>`;
export const rockSVG = () => `<svg viewBox="0 0 100 100" aria-hidden="true">
  <path d="M6 30 Q8 6 34 6 L70 5 Q95 7 95 32 L96 70 Q94 95 68 95 L30 96 Q5 94 5 68Z" fill="var(--rock-dk)"/>
  <path d="M6 28 Q8 6 33 6 L69 5 Q91 7 91 30 L92 66 Q90 89 66 90 L30 91 Q6 89 6 64Z" fill="var(--rock)"/>
  ${bolt(18, 18)}${bolt(80, 18)}${bolt(18, 78)}${bolt(80, 78)}
  <g class="f"><g class="f-idle"><path ${S("M27 38 L47 44 L53 44 L73 38", 6)}/><circle cx="39" cy="53" r="4.4" fill="${ink}"/><circle cx="61" cy="53" r="4.4" fill="${ink}"/><path ${S("M41 70 L59 70")}/></g></g>
</svg>`;

// bomba: kulatá, s doutnákem a jiskrou; v klidu se šibalsky culí, při pádu vytřeští oči
export const bombSVG = () => `<svg viewBox="0 0 100 100" aria-hidden="true">
  <path ${S("M62 22 Q70 8 82 12", 5)} stroke="var(--fuse)"/>
  <g class="spark"><path d="M84 -2 L88 7 L98 8 L90 14 L93 24 L84 18 L75 24 L78 14 L70 8 L80 7Z" fill="var(--x)"/><circle cx="84" cy="12" r="4.4" fill="#FFF3C4"/></g>
  <rect x="50" y="16" width="20" height="13" rx="3" transform="rotate(28 60 22)" fill="var(--bomb-dk)" stroke="#FFF6E6" stroke-opacity=".55" stroke-width="2.5"/>
  <circle cx="48" cy="58" r="39.5" fill="#FFF6E6" opacity=".55"/><circle cx="48" cy="58" r="37.5" fill="var(--bomb-dk)"/><circle cx="45" cy="55" r="33.5" fill="var(--bomb)"/>
  <ellipse cx="30" cy="38" rx="8" ry="4.4" transform="rotate(-40 30 38)" fill="#fff" opacity=".28"/>
  <g class="f"><g class="f-idle"><path ${S("M28 52 q6 -6 12 0", 4.5)} stroke="#FFF6E6"/><path ${S("M52 50 q6 -6 12 0", 4.5)} stroke="#FFF6E6"/>
    <path ${S("M33 66 Q46 76 60 64", 4.5)} stroke="#FFF6E6"/></g>
  <g class="f-fall"><circle cx="34" cy="54" r="8" fill="#FFF6E6"/><circle cx="58" cy="52" r="8" fill="#FFF6E6"/><circle cx="34" cy="55" r="3" fill="${ink}"/><circle cx="58" cy="53" r="3" fill="${ink}"/>
    <ellipse cx="46" cy="72" rx="5" ry="6" fill="#FFF6E6"/></g></g>
</svg>`;

export const stoneSVG = kind => kind === 1 ? ballSVG() : kind === 2 ? cubeSVG() : kind === 3 ? pebbleSVG() : kind === 5 ? bombSVG() : rockSVG();
export const teamSVG = p => p === "x" ? ballSVG() : cubeSVG();

// šipka otočky: oblouk ve směru otáčení
export const turnIcon = dir => dir === "L"
  ? `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M14 30 A13 13 0 1 0 17 13.5" fill="none" stroke="currentColor" stroke-width="5.5" stroke-linecap="round"/><path d="M8 9 L19 9 L17 21Z" fill="currentColor" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/></svg>`
  : `<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M34 30 A13 13 0 1 1 31 13.5" fill="none" stroke="currentColor" stroke-width="5.5" stroke-linecap="round"/><path d="M40 9 L29 9 L31 21Z" fill="currentColor" stroke="currentColor" stroke-width="2.5" stroke-linejoin="round"/></svg>`;
