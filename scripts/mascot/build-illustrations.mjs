// Builds the Bít mascot illustrations as SVG into src/assets/illustrations/.
//
// Bít is drawn from shared parts (head, face expressions, body, arm poses), so every scene stays
// on-model and a colour or shape change here updates the whole set. Run with:
//   node scripts/mascot/build-illustrations.mjs
// Each <name>.svg is registered automatically by src/components/ui/brand.tsx.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "../../src/assets/illustrations");

const C = {
  ink: "#0F172A",
  blue: "#3A56E4",
  indigo: "#4F46E5",
  violet: "#8B5CF6",
  cyan: "#6EE7F9",
  armL: "#8B7CF4",
  armR: "#7FA6F6",
  lavender: "#EEF2FF",
  lilac: "#E0E7FF",
  amber: "#FBBF24",
  pink: "#F472B6",
  emerald: "#34D399",
  white: "#FFFFFF",
  slate: "#CBD5E1"
};

const DEFS = `
  <defs>
    <linearGradient id="gHead" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${C.blue}"/><stop offset="1" stop-color="${C.violet}"/></linearGradient>
    <linearGradient id="gBody" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${C.violet}"/><stop offset="1" stop-color="${C.cyan}"/></linearGradient>
    <linearGradient id="gSoft" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#E0E7FF"/><stop offset="1" stop-color="#CFFAFE"/></linearGradient>
    <linearGradient id="gCard" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${C.indigo}"/><stop offset="1" stop-color="${C.cyan}"/></linearGradient>
  </defs>`;

/* ------------------------------------------------------------------ Bít parts (character space 300 × 340) */

const FACES = {
  happy: `<rect x="112" y="104" width="20" height="28" rx="10" fill="${C.cyan}"/><rect x="168" y="104" width="20" height="28" rx="10" fill="${C.cyan}"/>
    <path d="M130 146 Q150 160 170 146" stroke="${C.cyan}" stroke-width="5" stroke-linecap="round" fill="none"/>`,
  joy: `<path d="M110 124 Q122 106 134 124" stroke="${C.cyan}" stroke-width="6" stroke-linecap="round" fill="none"/><path d="M166 124 Q178 106 190 124" stroke="${C.cyan}" stroke-width="6" stroke-linecap="round" fill="none"/>
    <path d="M130 138 Q150 164 170 138 Z" fill="${C.cyan}"/>`,
  curious: `<rect x="118" y="99" width="20" height="28" rx="10" fill="${C.cyan}"/><rect x="174" y="99" width="20" height="28" rx="10" fill="${C.cyan}"/>
    <circle cx="154" cy="150" r="5.5" fill="${C.cyan}"/>`,
  focused: `<rect x="112" y="114" width="20" height="18" rx="9" fill="${C.cyan}"/><rect x="168" y="114" width="20" height="18" rx="9" fill="${C.cyan}"/>
    <path d="M140 150 Q150 155 160 150" stroke="${C.cyan}" stroke-width="5" stroke-linecap="round" fill="none"/>`,
  calm: `<path d="M110 116 Q122 128 134 116" stroke="${C.cyan}" stroke-width="6" stroke-linecap="round" fill="none"/><path d="M166 116 Q178 128 190 116" stroke="${C.cyan}" stroke-width="6" stroke-linecap="round" fill="none"/>
    <path d="M136 146 Q150 156 164 146" stroke="${C.cyan}" stroke-width="5" stroke-linecap="round" fill="none"/>`,
  wink: `<rect x="112" y="104" width="20" height="28" rx="10" fill="${C.cyan}"/><path d="M166 122 Q178 108 190 122" stroke="${C.cyan}" stroke-width="6" stroke-linecap="round" fill="none"/>
    <path d="M130 146 Q150 160 170 146" stroke="${C.cyan}" stroke-width="5" stroke-linecap="round" fill="none"/>`,
  peek: `<rect x="112" y="106" width="20" height="26" rx="10" fill="${C.cyan}"/><rect x="164" y="98" width="30" height="40" rx="15" fill="${C.cyan}"/>
    <circle cx="146" cy="152" r="5.5" fill="${C.cyan}"/>`
};

// Arm paths start inside the body so the shoulder is hidden; the end point is the hand.
const ARMS = {
  downL: { d: "M104 222 Q80 246 84 276", hand: [84, 276] },
  downR: { d: "M196 222 Q220 246 216 276", hand: [216, 276] },
  waveR: { d: "M196 220 Q232 196 238 156", hand: [238, 156] },
  upL: { d: "M104 218 Q72 190 66 148", hand: [66, 148] },
  upR: { d: "M196 218 Q228 190 234 148", hand: [234, 148] },
  holdL: { d: "M104 226 Q82 252 114 262", hand: [114, 262] },
  holdR: { d: "M196 226 Q218 252 186 262", hand: [186, 262] },
  chestL: { d: "M104 224 Q80 236 108 240", hand: [108, 240] },
  chestR: { d: "M196 224 Q220 236 192 240", hand: [192, 240] },
  pointR: { d: "M196 222 Q232 224 264 206", hand: [264, 206] },
  pointL: { d: "M104 222 Q68 224 36 206", hand: [36, 206] },
  raiseR: { d: "M196 220 Q238 204 232 164", hand: [232, 164] },
  askR: { d: "M196 218 Q224 182 222 128", hand: [222, 128] }
};

function arm(name, side, withHand) {
  const a = ARMS[name];
  const color = side === "L" ? C.armL : C.armR;
  const hand = withHand ? `<circle cx="${a.hand[0]}" cy="${a.hand[1]}" r="11" fill="${color}"/>` : "";
  return `<path d="${a.d}" stroke="${color}" stroke-width="18" stroke-linecap="round" fill="none"/>${hand}`;
}

/**
 * Bít in character space. `left`/`right` pick arm poses; arms listed in `front` are drawn over the body
 * (for holding things), `held` is drawn between the body and those front arms.
 */
function bit({ face = "happy", left = "downL", right = "downR", front = [], held = "", overFace = "" }) {
  const backArms = [left, right].filter(name => !front.includes(name)).map(name => arm(name, name === left ? "L" : "R", false)).join("");
  const frontArms = [left, right].filter(name => front.includes(name)).map(name => arm(name, name === left ? "L" : "R", true)).join("");
  return `
    <ellipse cx="150" cy="322" rx="72" ry="10" fill="${C.ink}" opacity=".08"/>
    <line x1="150" y1="44" x2="150" y2="66" stroke="${C.indigo}" stroke-width="7" stroke-linecap="round"/>
    <circle cx="150" cy="38" r="11" fill="${C.cyan}"/><circle cx="146" cy="34" r="3.5" fill="${C.white}" opacity=".8"/>
    <rect x="54" y="100" width="18" height="44" rx="9" fill="${C.cyan}"/>
    <rect x="228" y="100" width="18" height="44" rx="9" fill="${C.cyan}"/>
    <rect x="68" y="62" width="164" height="124" rx="42" fill="url(#gHead)"/>
    <path d="M92 76 Q110 68 132 68" stroke="${C.white}" stroke-width="7" stroke-linecap="round" opacity=".25" fill="none"/>
    <rect x="88" y="82" width="124" height="84" rx="30" fill="${C.ink}"/>
    ${FACES[face]}
    ${overFace}
    <rect x="134" y="184" width="32" height="14" rx="5" fill="${C.indigo}"/>
    ${backArms}
    <rect x="90" y="194" width="120" height="104" rx="38" fill="url(#gBody)"/>
    <ellipse cx="124" cy="214" rx="18" ry="8" fill="${C.white}" opacity=".2" transform="rotate(-18 124 214)"/>
    <circle cx="150" cy="240" r="16" fill="${C.white}" opacity=".92"/><circle cx="150" cy="240" r="7" fill="${C.violet}"/>
    <rect x="104" y="294" width="36" height="20" rx="10" fill="${C.indigo}"/>
    <rect x="160" y="294" width="36" height="20" rx="10" fill="${C.indigo}"/>
    ${held}
    ${frontArms}`;
}

/** Place Bít in the 320 × 320 scene: `cx` is the horizontal centre, `ground` the y of the shadow. */
const place = (content, { cx = 160, ground = 312, s = 0.84 } = {}) =>
  `<g transform="translate(${(cx - 150 * s).toFixed(1)} ${(ground - 322 * s).toFixed(1)}) scale(${s})">${content}</g>`;

/* ------------------------------------------------------------------ Small props (scene space 320 × 320) */

const sparkle = (x, y, r, color) =>
  `<path d="M${x} ${y - r} Q${x + r * 0.18} ${y - r * 0.18} ${x + r} ${y} Q${x + r * 0.18} ${y + r * 0.18} ${x} ${y + r} Q${x - r * 0.18} ${y + r * 0.18} ${x - r} ${y} Q${x - r * 0.18} ${y - r * 0.18} ${x} ${y - r} Z" fill="${color}"/>`;

const confetti = pieces => pieces.map(([x, y, kind, color, rot]) =>
  kind === "dot"
    ? `<circle cx="${x}" cy="${y}" r="5" fill="${color}"/>`
    : `<rect x="${x - 4}" y="${y - 8}" width="8" height="16" rx="3" fill="${color}" transform="rotate(${rot} ${x} ${y})"/>`
).join("");

const courseCard = (x, y, rot) => `
  <g transform="rotate(${rot} ${x + 42} ${y + 30})">
    <rect x="${x}" y="${y}" width="84" height="62" rx="12" fill="${C.white}" stroke="${C.lilac}" stroke-width="2"/>
    <rect x="${x}" y="${y}" width="84" height="26" rx="12" fill="url(#gCard)"/>
    <rect x="${x}" y="${y + 14}" width="84" height="12" fill="url(#gCard)"/>
    <rect x="${x + 10}" y="${y + 35}" width="50" height="6" rx="3" fill="${C.slate}"/>
    <rect x="${x + 10}" y="${y + 47}" width="34" height="6" rx="3" fill="${C.lilac}"/>
  </g>`;

const svg = (body, title) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 320" role="img" aria-label="${title}">${DEFS}${body}</svg>\n`;

/* ------------------------------------------------------------------ Scenes */

const SCENES = {
  welcome: svg(`
    ${sparkle(60, 92, 12, C.cyan)}${sparkle(268, 64, 9, C.violet)}${sparkle(282, 132, 6, C.amber)}
    ${place(bit({ face: "happy", right: "waveR" }), { s: 0.88 })}`, "Bít vẫy tay chào"),

  explore: svg(`
    ${courseCard(206, 44, 8)}${courseCard(224, 130, -6)}${courseCard(196, 214, 5)}
    ${place(bit({ face: "curious", right: "pointR" }), { cx: 118, s: 0.74 })}`, "Bít khám phá các khóa học"),

  "live-class": svg(`
    <g>
      <rect x="170" y="56" width="136" height="104" rx="18" fill="${C.white}" stroke="${C.lilac}" stroke-width="3"/>
      <rect x="182" y="70" width="112" height="64" rx="10" fill="${C.lavender}"/>
      <circle cx="238" cy="92" r="12" fill="${C.indigo}"/>
      <path d="M216 128 Q238 104 260 128 Z" fill="${C.indigo}"/>
      <circle cx="194" cy="146" r="5" fill="#F43F5E"/>
      <rect x="206" y="142" width="40" height="8" rx="4" fill="${C.slate}"/>
      <circle cx="282" cy="146" r="6" fill="${C.cyan}"/>
    </g>
    ${place(bit({ face: "happy", right: "waveR" }), { cx: 106, s: 0.72 })}`, "Bít tham gia lớp học trực tuyến"),

  progress: svg(`
    <rect x="28" y="262" width="88" height="44" rx="10" fill="${C.lilac}"/>
    <rect x="116" y="220" width="88" height="86" rx="10" fill="#C7D2FE"/>
    <rect x="204" y="176" width="88" height="130" rx="10" fill="url(#gSoft)"/>
    <line x1="262" y1="176" x2="262" y2="86" stroke="${C.indigo}" stroke-width="6" stroke-linecap="round"/>
    <path d="M262 88 L306 104 L262 120 Z" fill="${C.cyan}"/>
    ${sparkle(212, 110, 8, C.amber)}
    ${place(bit({ face: "joy", left: "upL", right: "upR" }), { cx: 160, ground: 222, s: 0.52 })}`, "Bít leo lên từng bậc tiến bộ"),

  celebrate: svg(`
    ${confetti([[48, 70, "bar", C.violet, -20], [84, 40, "dot", C.cyan], [262, 50, "bar", C.amber, 30], [290, 104, "dot", C.pink], [36, 150, "dot", C.amber], [276, 170, "bar", C.cyan, -35], [120, 24, "bar", C.pink, 15], [214, 26, "dot", C.emerald], [58, 222, "bar", C.emerald, 40], [270, 232, "dot", C.violet]])}
    ${place(bit({ face: "joy", left: "upL", right: "upR" }), { s: 0.86 })}`, "Bít ăn mừng"),

  mail: svg(`
    ${sparkle(266, 78, 10, C.cyan)}${sparkle(52, 120, 7, C.violet)}
    ${place(bit({
      face: "happy", left: "holdL", right: "holdR", front: ["holdL", "holdR"],
      held: `<g><rect x="86" y="218" width="128" height="86" rx="12" fill="${C.white}" stroke="${C.indigo}" stroke-width="5"/>
        <path d="M90 224 L150 266 L210 224" stroke="${C.indigo}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round" fill="none"/>
        <circle cx="150" cy="276" r="9" fill="${C.cyan}"/></g>`
    }), { s: 0.86 })}`, "Bít mang thư đến"),

  lock: svg(`
    <g>
      <path d="M254 196 V172 a24 24 0 0 1 48 0 V196" stroke="${C.slate}" stroke-width="11" fill="none"/>
      <rect x="240" y="190" width="76" height="70" rx="18" fill="url(#gHead)"/>
      <circle cx="278" cy="218" r="9" fill="${C.white}"/><rect x="274" y="221" width="8" height="20" rx="4" fill="${C.white}"/>
    </g>
    ${sparkle(236, 132, 9, C.cyan)}
    ${place(bit({
      face: "wink", right: "pointR", front: ["pointR"],
      held: `<g><circle cx="276" cy="206" r="20" fill="none" stroke="${C.amber}" stroke-width="10"/><circle cx="276" cy="206" r="6" fill="${C.amber}"/>
        <rect x="294" y="201" width="44" height="10" rx="5" fill="${C.amber}"/><rect x="322" y="209" width="8" height="14" rx="3" fill="${C.amber}"/></g>`
    }), { cx: 104, s: 0.72 })}`, "Bít giữ chìa khóa bảo mật"),

  study: svg(`
    <g>
      <rect x="236" y="266" width="66" height="16" rx="5" fill="${C.indigo}"/>
      <rect x="242" y="250" width="58" height="16" rx="5" fill="${C.cyan}"/>
      <rect x="238" y="234" width="62" height="16" rx="5" fill="${C.violet}"/>
    </g>
    ${place(bit({
      face: "focused", left: "chestL", right: "chestR", front: ["chestL", "chestR"],
      held: `<g><path d="M150 214 L92 204 L92 262 L150 272 Z" fill="${C.white}" stroke="${C.indigo}" stroke-width="5" stroke-linejoin="round"/>
        <path d="M150 214 L208 204 L208 262 L150 272 Z" fill="${C.white}" stroke="${C.indigo}" stroke-width="5" stroke-linejoin="round"/>
        <path d="M104 222 L138 228 M104 236 L138 242 M162 228 L196 222 M162 242 L196 236" stroke="${C.slate}" stroke-width="4" stroke-linecap="round"/></g>`
    }), { cx: 146, s: 0.86 })}`, "Bít đang đọc sách"),

  waiting: svg(`
    <circle cx="238" cy="70" r="7" fill="${C.slate}"/><circle cx="262" cy="70" r="7" fill="${C.violet}" opacity=".6"/><circle cx="286" cy="70" r="7" fill="${C.cyan}"/>
    ${place(bit({
      face: "calm", left: "chestL", right: "chestR", front: ["chestL", "chestR"],
      held: `<g><rect x="112" y="200" width="76" height="10" rx="5" fill="${C.indigo}"/><rect x="112" y="282" width="76" height="10" rx="5" fill="${C.indigo}"/>
        <path d="M122 210 L178 210 L150 246 L178 282 L122 282 L150 246 Z" fill="${C.lavender}" stroke="${C.indigo}" stroke-width="4" stroke-linejoin="round"/>
        <path d="M134 220 L166 220 L150 240 Z" fill="${C.amber}"/><path d="M134 280 L166 280 L150 262 Z" fill="${C.amber}"/></g>`
    }), { s: 0.86 })}`, "Bít kiên nhẫn chờ"),

  search: svg(`
    ${sparkle(58, 86, 9, C.cyan)}${sparkle(274, 214, 7, C.violet)}
    ${place(bit({
      face: "peek", right: "raiseR", front: ["raiseR"],
      overFace: "",
      held: `<g><line x1="214" y1="150" x2="232" y2="166" stroke="${C.indigo}" stroke-width="12" stroke-linecap="round"/>
        <circle cx="180" cy="118" r="42" fill="${C.cyan}" fill-opacity=".22" stroke="${C.indigo}" stroke-width="10"/>
        <path d="M156 100 Q164 86 180 84" stroke="${C.white}" stroke-width="5" stroke-linecap="round" fill="none" opacity=".8"/></g>`
    }), { cx: 150, s: 0.84 })}`, "Bít tìm kiếm"),

  chat: svg(`
    <g>
      <rect x="176" y="34" width="112" height="62" rx="24" fill="${C.white}" stroke="${C.lilac}" stroke-width="3"/>
      <path d="M204 94 L196 112 L222 96" fill="${C.white}" stroke="${C.lilac}" stroke-width="3" stroke-linejoin="round"/>
      <rect x="199" y="92" width="26" height="6" fill="${C.white}"/>
      <circle cx="208" cy="65" r="7" fill="${C.indigo}"/><circle cx="232" cy="65" r="7" fill="${C.violet}"/><circle cx="256" cy="65" r="7" fill="${C.cyan}"/>
      <rect x="228" y="114" width="80" height="48" rx="20" fill="url(#gCard)"/>
      <path d="M284 160 L296 176 L270 162 Z" fill="${C.cyan}"/>
      <rect x="244" y="130" width="48" height="6" rx="3" fill="${C.white}" opacity=".9"/><rect x="244" y="142" width="30" height="6" rx="3" fill="${C.white}" opacity=".7"/>
    </g>
    ${place(bit({ face: "happy", right: "askR" }), { cx: 112, s: 0.76 })}`, "Bít đặt câu hỏi"),

  inbox: svg(`
    <g>
      <path d="M244 60 a24 24 0 0 1 24 24 v16 l8 12 h-64 l8 -12 v-16 a24 24 0 0 1 24 -24 Z" fill="${C.amber}"/>
      <circle cx="244" cy="120" r="7" fill="${C.amber}"/>
      <circle cx="270" cy="62" r="13" fill="${C.emerald}"/>
      <path d="M263 62 L268 67 L277 57" stroke="${C.white}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    </g>
    ${place(bit({
      face: "calm", left: "holdL", right: "holdR", front: ["holdL", "holdR"],
      held: `<g><path d="M82 252 L218 252 L206 280 L94 280 Z" fill="url(#gSoft)" stroke="${C.indigo}" stroke-width="5" stroke-linejoin="round"/></g>`
    }), { cx: 146, s: 0.86 })}`, "Bít báo đã đọc hết thông báo"),

  teach: svg(`
    <g>
      <line x1="58" y1="200" x2="44" y2="304" stroke="${C.slate}" stroke-width="7" stroke-linecap="round"/>
      <line x1="150" y1="200" x2="164" y2="304" stroke="${C.slate}" stroke-width="7" stroke-linecap="round"/>
      <rect x="18" y="52" width="170" height="150" rx="16" fill="${C.white}" stroke="${C.lilac}" stroke-width="4"/>
      <circle cx="62" cy="100" r="20" fill="${C.cyan}"/>
      <path d="M112 118 L136 78 L160 118 Z" fill="${C.violet}"/>
      <path d="M44 170 L78 150 L108 160 L156 134" stroke="${C.indigo}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
    </g>
    ${place(bit({
      face: "happy", left: "pointL", front: ["pointL"],
      held: `<line x1="36" y1="206" x2="-10" y2="170" stroke="${C.amber}" stroke-width="7" stroke-linecap="round"/>`
    }), { cx: 238, s: 0.72 })}`, "Bít giảng bài")
};

mkdirSync(OUT, { recursive: true });
for (const [name, content] of Object.entries(SCENES)) {
  writeFileSync(join(OUT, `${name}.svg`), content.replace(/\n\s+/g, "\n"));
  console.log(`wrote ${name}.svg`);
}
