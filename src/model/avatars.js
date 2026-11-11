// Full-color character illustrations, composed from small parts instead of
// ~50 unrelated hand-drawn SVGs: every avatar is a half-length figure on a
// 32x32 canvas (shoulders, neck, head, face), plus a hairstyle, an optional
// facial-hair, an outfit detail, a hat and a prop. Each profession is just a
// row in PROFESSIONS (colors + which parts), so the roster stays consistent
// and each profession differs in silhouette AND palette — readable even at
// the 16-20px toolbar size.
//
// No `currentColor` anywhere: these carry their own colors. The character's
// identity color lives on the token disc / chip border around the figure.
// No ids/clipPaths either — dozens of these are inlined in one document and
// duplicate ids would collide.

const OUT = "#2b1d12"; // outline
const O = `stroke='${OUT}' stroke-width='.8' stroke-linejoin='round' stroke-linecap='round'`;
const SHOULDERS = "M3 32 C3 25 8 21.5 16 21.5 C24 21.5 29 25 29 32Z";

// --- hair (back layer: behind the head but over the body; front layer: over the head)
function hairBack(style, c) {
  switch (style) {
    case "long":
      return `<path d='M8.2 12 C6.6 23 8.6 27.5 12.4 28.5 L19.6 28.5 C23.4 27.5 25.4 23 23.8 12Z' fill='${c}' ${O}/>`;
    case "bob":
      return `<path d='M8.4 12 C7.4 20 8.6 22 10.6 22 L21.4 22 C23.4 22 24.6 20 23.6 12Z' fill='${c}' ${O}/>`;
    case "veil":
      return `<path d='M7.6 14 C7.6 2.5 24.4 2.5 24.4 14 L26.5 24 L5.5 24Z' fill='${c}' ${O}/>`;
    default:
      return "";
  }
}

function hairFront(style, c, skin) {
  const cap = `<path d='M9.3 12.6 C8.6 5 23.4 5 22.7 12.6 C21 9.2 11 9.2 9.3 12.6Z' fill='${c}' ${O}/>`;
  switch (style) {
    case "short":
    case "long":
    case "bob":
      return cap;
    case "bun":
      return cap + `<circle cx='16' cy='4.4' r='2.8' fill='${c}' ${O}/>`;
    case "ponytail":
      return cap + `<path d='M22.4 9 C27 9 28 15 25 18 C25.5 14 24 12 22.4 12Z' fill='${c}' ${O}/>`;
    case "curly":
      return [10.3, 13.2, 16, 18.8, 21.7].map((x, i) => `<circle cx='${x}' cy='${i % 2 ? 6.2 : 7.4}' r='2.9' fill='${c}' ${O}/>`).join("");
    case "wild":
      return `<path d='M9 12.4 L6.6 5.4 L11 8 L11.6 1.8 L15 6.6 L18.2 1.4 L19 7 L23.4 3 L22.4 9 L25.4 7.2 L23 12.4 C21 9.2 11 9.2 9 12.4Z' fill='${c}' ${O}/>`;
    case "slick":
      return `<path d='M9.3 12.4 C8.8 5.4 23.2 5.4 22.7 12.4 C20 8.4 15 9 11 8.8 C10 9.6 9.6 11 9.3 12.4Z' fill='${c}' ${O}/>`;
    case "sides":
      return `<path d='M9.4 11.6 C8.6 8.6 9.6 7.6 10.6 8.4 L10.8 12Z M22.6 11.6 C23.4 8.6 22.4 7.6 21.4 8.4 L21.2 12Z' fill='${c}' ${O}/>`;
    case "tonsure":
      return cap + `<ellipse cx='16' cy='7.6' rx='4.2' ry='1.9' fill='${skin}'/>`;
    case "veil":
      return `<path d='M9.2 9.6 C12 6.4 20 6.4 22.8 9.6 L22.8 11.4 C20 8.6 12 8.6 9.2 11.4Z' fill='#fff' ${O}/>`;
    default: // bald
      return `<path d='M11 7.6 C12.4 6.6 14 6.3 15.6 6.3' stroke='#fff' stroke-width='1.1' fill='none' opacity='.55' stroke-linecap='round'/>`;
  }
}

function facialHair(style, c) {
  switch (style) {
    case "mustache":
      return `<path d='M11.6 15.7 Q14 13.9 16 15.5 Q18 13.9 20.4 15.7 Q18 17.6 16 16.4 Q14 17.6 11.6 15.7Z' fill='${c}' ${O}/>`;
    case "beard":
      return `<path d='M9.8 14.2 C9.6 22 22.4 22 22.2 14.2 C21 17.6 11 17.6 9.8 14.2Z' fill='${c}' ${O}/>` +
        `<path d='M13 16 Q16 14.6 19 16 Q16 17.4 13 16Z' fill='${c}'/>`;
    case "goatee":
      return `<path d='M14 17.2 C14.4 20.6 17.6 20.6 18 17.2 C17 18.2 15 18.2 14 17.2Z' fill='${c}' ${O}/>`;
    default:
      return "";
  }
}

// --- outfit details, drawn over the shoulders (c = outfit color, a = accent)
function outfitDetail(style, c, a, skin) {
  switch (style) {
    case "suit":
      return `<path d='M12.2 21.6 L16 27.6 L19.8 21.6Z' fill='#fff' ${O}/><path d='M16 23.2 L14.9 24.4 L16 30 L17.1 24.4Z' fill='${a}' ${O}/>` +
        `<path d='M12.2 21.6 L14.2 31 M19.8 21.6 L17.8 31' stroke='${OUT}' stroke-width='.7' fill='none'/>`;
    case "tailcoat":
      return `<path d='M12 21.6 L16 31.5 L20 21.6Z' fill='#fff' ${O}/><path d='M11.6 21.6 L14 32 M20.4 21.6 L18 32' stroke='${OUT}' stroke-width='.7' fill='none'/>` +
        `<circle cx='16' cy='26' r='.6' fill='${OUT}'/><circle cx='16' cy='28.6' r='.6' fill='${OUT}'/>`;
    case "coat":
      return `<path d='M12.8 21.6 L16 28 L19.2 21.6Z' fill='${a}' ${O}/><path d='M12.2 21.4 L15 30.5 M19.8 21.4 L17 30.5' stroke='${OUT}' stroke-width='.7' fill='none'/>` +
        `<rect x='19.4' y='26' width='3.4' height='3' rx='.5' fill='none' stroke='${OUT}' stroke-width='.6' opacity='.6'/>`;
    case "apron":
      return `<path d='M11.4 24.2 H20.6 V32 H11.4Z' fill='#fff' ${O}/><path d='M11.4 24.2 L13.2 21.6 M20.6 24.2 L18.8 21.6' stroke='${OUT}' stroke-width='.9' fill='none'/>` +
        `<path d='M13.8 21.7 Q16 24.6 18.2 21.7Z' fill='${skin}'/>`;
    case "uniform":
      return `<path d='M12.6 21.6 L16 26 L19.4 21.6Z' fill='#fff' ${O}/><rect x='5.2' y='23.2' width='5.4' height='2.2' rx='.6' fill='${a}' ${O}/><rect x='21.4' y='23.2' width='5.4' height='2.2' rx='.6' fill='${a}' ${O}/>` +
        `<path d='M16 26 V32' stroke='${OUT}' stroke-width='.7'/><circle cx='16' cy='27.6' r='.75' fill='${a}'/><circle cx='16' cy='30.4' r='.75' fill='${a}'/>`;
    case "doublebreasted":
      return `<path d='M12.8 21.6 L16 25 L19.2 21.6Z' fill='${skin}'/><path d='M12.4 21.4 L16 25.2 L19.6 21.4' stroke='${OUT}' stroke-width='.7' fill='none'/>` +
        [[12.6, 26.6], [12.6, 29.8], [19.4, 26.6], [19.4, 29.8]].map(([x, y]) => `<circle cx='${x}' cy='${y}' r='.85' fill='${a}' ${O}/>`).join("");
    case "robe":
      return `<path d='M12 21.6 L16 29 L20 21.6Z' fill='${a}' ${O}/><rect x='3.4' y='28.6' width='25.2' height='2.2' fill='${a}' opacity='.9'/>` +
        `<circle cx='9' cy='26' r='.8' fill='${a}'/><circle cx='23' cy='25.4' r='.8' fill='${a}'/><circle cx='12' cy='30.6' r='.7' fill='#fff' opacity='.7'/>`;
    case "vest":
      return `<path d='M9 23.4 L13.2 32 M23 23.4 L18.8 32' stroke='${a}' stroke-width='2.8'/><path d='M4.6 29.4 H27.4' stroke='${a}' stroke-width='2'/>` +
        `<path d='M12.8 21.6 Q16 25 19.2 21.6Z' fill='${skin}'/>`;
    case "stripes":
      return [24.2, 27.2, 30.2].map((y, i) => `<path d='M${i === 0 ? 7.4 : i === 1 ? 4.6 : 3.2} ${y} H${i === 0 ? 24.6 : i === 1 ? 27.4 : 28.8}' stroke='${a}' stroke-width='1.6'/>`).join("") +
        `<path d='M12.8 21.6 Q16 24.6 19.2 21.6Z' fill='${skin}'/>`;
    case "plaid":
      return [24, 27, 30].map((y) => `<path d='M4.6 ${y} H27.4' stroke='${a}' stroke-width='.9' opacity='.8'/>`).join("") +
        [9, 13, 17, 21, 25].map((x) => `<path d='M${x} 23.6 V32' stroke='${a}' stroke-width='.9' opacity='.8'/>`).join("") +
        `<path d='M12.8 21.6 Q16 24.6 19.2 21.6Z' fill='${skin}'/>`;
    case "overalls":
      return `<path d='M10.4 32 V25.4 H21.6 V32Z' fill='${a}' ${O}/><path d='M11 25.4 L13.6 21.6 M21 25.4 L18.4 21.6' stroke='${a}' stroke-width='1.9'/>` +
        `<circle cx='11.6' cy='26.4' r='.7' fill='#e4c179'/><circle cx='20.4' cy='26.4' r='.7' fill='#e4c179'/>`;
    case "smock":
      return `<circle cx='9' cy='27' r='1.3' fill='#e4572e'/><circle cx='22.6' cy='25.4' r='1.2' fill='#2e86ab'/><circle cx='20' cy='29.8' r='1.4' fill='#f6c744'/><circle cx='12.4' cy='30.2' r='1' fill='#4aa564'/>` +
        `<path d='M12.8 21.6 Q16 24.6 19.2 21.6Z' fill='${skin}'/>`;
    case "cape":
      return `<path d='M11 22 L16 31 L21 22 L24 24 L16 32.5 L8 24Z' fill='${a}' ${O}/><path d='M9.4 20.4 L7.2 25.4 L12.4 23.2Z M22.6 20.4 L24.8 25.4 L19.6 23.2Z' fill='${c}' ${O}/>`;
    case "royal":
      return `<path d='M7.4 25 Q16 30.4 24.6 25 L24.6 28.4 Q16 33.8 7.4 28.4Z' fill='#fff' ${O}/>` +
        [[10, 27.6], [14, 29.6], [18, 29.6], [22, 27.6], [16, 31.3]].map(([x, y]) => `<circle cx='${x}' cy='${y}' r='.7' fill='${OUT}'/>`).join("");
    case "trench":
      return `<path d='M10 21 L6.8 26.4 L13 25.2Z M22 21 L25.2 26.4 L19 25.2Z' fill='${c}' ${O}/><path d='M12.6 22 L16 27 L19.4 22Z' fill='${skin}'/>` +
        `<rect x='4' y='28.6' width='24' height='1.8' fill='${a}' opacity='.85'/><circle cx='16' cy='26.4' r='.7' fill='${OUT}'/>`;
    case "bomber":
      return `<path d='M11 21.6 Q16 24.8 21 21.6 L21 23.8 Q16 27 11 23.8Z' fill='${a}' ${O}/><path d='M16 25.6 V32' stroke='${OUT}' stroke-width='.8'/>`;
    case "leather":
      return `<path d='M12.2 21.4 L15.6 29 M19.8 21.4 L16.8 27' stroke='${OUT}' stroke-width='.8' fill='none'/>` +
        [8, 10.5, 21.5, 24].map((x) => `<circle cx='${x}' cy='24.2' r='.7' fill='#c9ced6'/>`).join("") + `<path d='M12.8 21.6 Q16 25.4 19.2 21.6Z' fill='#fff'/>`;
    case "flowers":
      return [[9, 26, "#fff"], [22, 25, "#ffd23f"], [14, 29.5, "#ff6f91"], [25, 29.4, "#fff"], [18.4, 27, "#ffd23f"]].map(([x, y, f]) => `<circle cx='${x}' cy='${y}' r='1.5' fill='${f}'/><circle cx='${x}' cy='${y}' r='.5' fill='${OUT}' opacity='.4'/>`).join("") +
        `<path d='M12.8 21.6 Q16 24.6 19.2 21.6Z' fill='${skin}'/>`;
    case "clerical":
      return `<rect x='14.6' y='21.7' width='2.8' height='2.6' fill='#fff' ${O}/>`;
    case "habit":
      return `<path d='M16 23 V32' stroke='${OUT}' stroke-width='.7'/><path d='M12 21.6 Q16 25 20 21.6Z' fill='#fff' ${O}/><path d='M8 27 Q16 31 24 27' stroke='${a}' stroke-width='1.6' fill='none'/>`;
    case "sweater":
      return `<path d='M12.4 21.6 L16 26.4 L19.6 21.6Z' fill='${a}' ${O}/><path d='M9 28 H23' stroke='${a}' stroke-width='.9' opacity='.7'/>`;
    default: // plain
      return `<path d='M12.8 21.6 Q16 25.2 19.2 21.6Z' fill='${skin}'/>`;
  }
}

// --- hats / headgear (drawn last over the head)
const HATS = {
  none: () => "",
  toque: (c) => `<g fill='${c}' ${O}><circle cx='11.4' cy='5' r='3.2'/><circle cx='16' cy='3.4' r='3.9'/><circle cx='20.6' cy='5' r='3.2'/><rect x='10.4' y='6.6' width='11.2' height='3.4' rx='.8'/></g>`,
  top: (c, a) => `<g ${O}><rect x='10.4' y='.8' width='11.2' height='7.8' rx='1' fill='${c}'/><rect x='10.4' y='5.8' width='11.2' height='2' fill='${a}'/><ellipse cx='16' cy='8.8' rx='9' ry='1.8' fill='${c}'/></g>`,
  bowler: (c, a) => `<g ${O}><path d='M9.8 9 C9.4 2.4 22.6 2.4 22.2 9Z' fill='${c}'/><rect x='9.8' y='6.8' width='12.4' height='1.7' fill='${a}'/><ellipse cx='16' cy='9.2' rx='8.6' ry='1.6' fill='${c}'/></g>`,
  cap: (c, a) => `<g ${O}><path d='M9 9.4 C8.6 3 23.4 3 23 9.4Z' fill='${c}'/><path d='M8.6 9.4 H23.4 Q24.6 11.6 16 11.6 Q9 11.6 8.6 9.4Z' fill='${a}'/><circle cx='16' cy='4.3' r='.9' fill='${a}'/></g>`,
  kepi: (c, a) => `<g ${O}><rect x='9.4' y='2.8' width='13.2' height='6.4' rx='1.6' fill='${c}'/><path d='M8.8 9.2 H23.2 Q24 11.4 16 11.4 Q8 11.4 8.8 9.2Z' fill='#222'/><circle cx='16' cy='6' r='1.6' fill='${a}'/></g>`,
  helmet: (c, a) => `<g ${O}><path d='M8.4 9.6 C8.4 1.8 23.6 1.8 23.6 9.6Z' fill='${c}'/><rect x='6.8' y='9' width='18.4' height='2.2' rx='1.1' fill='${c}'/><path d='M16 2.2 V9' stroke='${a}' stroke-width='1.2'/><circle cx='16' cy='6' r='1.5' fill='${a}'/></g>`,
  nurse: () => `<g ${O}><rect x='10.4' y='3.4' width='11.2' height='6.2' rx='1.3' fill='#fff'/><path d='M16 4.5 V8.5 M14 6.5 H18' stroke='#d93a3a' stroke-width='1.5' fill='none'/></g>`,
  wig: (c) => `<g fill='${c}' ${O}><circle cx='8.2' cy='11' r='2.8'/><circle cx='7.8' cy='15.6' r='2.8'/><circle cx='9.4' cy='19.4' r='2.3'/><circle cx='23.8' cy='11' r='2.8'/><circle cx='24.2' cy='15.6' r='2.8'/><circle cx='22.6' cy='19.4' r='2.3'/><circle cx='12' cy='6.2' r='3'/><circle cx='16' cy='5' r='3.2'/><circle cx='20' cy='6.2' r='3'/></g>`,
  mortar: (c, a) => `<g ${O}><path d='M10.6 8.2 V11.6 Q16 13.4 21.4 11.6 V8.2Z' fill='${c}'/><path d='M4 6.6 L16 2 L28 6.6 L16 11.2Z' fill='${c}'/><path d='M16 6.6 L27 7 V12.4' stroke='${a}' stroke-width='1.1' fill='none'/><circle cx='27' cy='13' r='1.1' fill='${a}'/></g>`,
  beret: (c, a) => `<g ${O} transform='rotate(-10 16 6)'><ellipse cx='17' cy='6.2' rx='9.6' ry='3.8' fill='${c}'/><rect x='16.2' y='1.6' width='1.8' height='2.2' fill='${a}'/></g>`,
  turban: (c, a) => `<g ${O}><ellipse cx='16' cy='7.2' rx='9.2' ry='5.2' fill='${c}'/><path d='M7.6 8.4 Q16 2.6 24.4 8.4 M9 11 Q16 5.6 23 11' stroke='${OUT}' stroke-width='.6' fill='none' opacity='.6'/><circle cx='16' cy='5.2' r='1.4' fill='${a}'/></g>`,
  tricorn: (c, a) => `<g ${O}><path d='M2.6 10.4 Q16 -2 29.4 10.4 Q16 6.6 2.6 10.4Z' fill='${c}'/><path d='M2.6 10.4 Q16 6.6 29.4 10.4' stroke='${a}' stroke-width='1.2' fill='none'/><circle cx='16' cy='5.2' r='1.9' fill='#fff'/><path d='M13.6 9 L18.4 6.8 M13.6 6.8 L18.4 9' stroke='#fff' stroke-width='.9'/></g>`,
  cowboy: (c, a) => `<g ${O}><path d='M3.4 9.6 Q16 12.8 28.6 9.6 Q26 6.2 22 8 H10 Q6 6.2 3.4 9.6Z' fill='${c}'/><path d='M10 8.6 C9.6 1.8 22.4 1.8 22 8.6 Q16 6.8 10 8.6Z' fill='${c}'/><rect x='10.1' y='6.6' width='11.8' height='1.6' fill='${a}'/></g>`,
  wizard: (c, a) => `<g ${O}><ellipse cx='16' cy='9.4' rx='10.4' ry='2.2' fill='${c}'/><path d='M9.4 9.2 L17.6 .4 L22.6 9.2Z' fill='${c}'/><rect x='9.6' y='7' width='13' height='1.6' fill='${a}' stroke='none'/><circle cx='16.4' cy='5.4' r='.9' fill='${a}' stroke='none'/><circle cx='19.2' cy='7.6' r='.6' fill='${a}' stroke='none'/></g>`,
  crown: (c, a) => `<g ${O}><path d='M9.4 9.2 L8.8 2.6 L12.8 6 L16 1.4 L19.2 6 L23.2 2.6 L22.6 9.2Z' fill='${c}'/><circle cx='16' cy='6.6' r='1.1' fill='${a}'/><circle cx='11.6' cy='7.6' r='.8' fill='#3a7bd5'/><circle cx='20.4' cy='7.6' r='.8' fill='#3a7bd5'/></g>`,
  tiara: (c, a) => `<g ${O}><path d='M10.6 8.8 L11.6 5 L13.8 7 L16 3.6 L18.2 7 L20.4 5 L21.4 8.8Z' fill='${c}'/><circle cx='16' cy='6.6' r='.9' fill='${a}'/></g>`,
  sailor: (c, a) => `<g ${O}><path d='M8.8 9.4 C8.6 4 23.4 4 23.2 9.4Z' fill='${c}'/><rect x='8.6' y='8.2' width='14.8' height='2.4' rx='1.2' fill='${a}'/><circle cx='16' cy='4.2' r='1' fill='${a}'/></g>`,
  maidcap: () => `<g ${O}><path d='M9.4 8.4 C10 3.8 22 3.8 22.6 8.4 C20 6.8 12 6.8 9.4 8.4Z' fill='#fff'/><path d='M9.6 8.2 Q8 11.4 9.6 12.6 M22.4 8.2 Q24 11.4 22.4 12.6' fill='none'/></g>`,
  straw: (c, a) => `<g ${O}><ellipse cx='16' cy='9.2' rx='12.2' ry='3' fill='${c}'/><path d='M10.4 9 C10.2 2.8 21.8 2.8 21.6 9Z' fill='${c}'/><rect x='10.4' y='6.6' width='11.2' height='1.9' fill='${a}'/></g>`,
  fedora: (c, a) => `<g ${O}><path d='M5 10.4 Q16 13.6 27 10.4 Q23 7.6 16 8.2 Q9 7.6 5 10.4Z' fill='${c}'/><path d='M10.2 8.8 C9.8 2.4 22.2 2.4 21.8 8.8 Q16 6.6 10.2 8.8Z' fill='${c}'/><path d='M10.2 8.4 Q16 6.4 21.8 8.4 L21.8 7 Q16 5 10.2 7Z' fill='${a}' stroke='none'/></g>`,
  pilot: (c, a) => `<g ${O}><path d='M9 10.8 C8.4 2.8 23.6 2.8 23 10.8 Q16 8.2 9 10.8Z' fill='${c}'/><circle cx='13' cy='7' r='2.1' fill='#9ecbe0'/><circle cx='19' cy='7' r='2.1' fill='#9ecbe0'/><path d='M15.1 7 H16.9' stroke='${a}' stroke-width='1.2'/></g>`,
  pith: (c, a) => `<g ${O}><path d='M7.6 10.2 C7.4 1.8 24.6 1.8 24.4 10.2Z' fill='${c}'/><path d='M6.2 10.2 Q16 12.6 25.8 10.2 L24.4 8.6 H7.6Z' fill='${c}'/><rect x='8.2' y='7.4' width='15.6' height='1.5' fill='${a}' stroke='none'/></g>`,
  hardhat: (c, a) => HATS.helmet(c, a),
  astronaut: () => `<g ${O}><circle cx='16' cy='13' r='10.2' fill='rgba(190,225,255,.32)' stroke='#f2f5f8' stroke-width='2.2'/><path d='M9.6 20.6 Q16 24.4 22.4 20.6' stroke='#f2f5f8' stroke-width='2.4' fill='none'/><path d='M10.6 7.6 Q12.6 5.4 15.4 5' stroke='#fff' stroke-width='1.2' fill='none' opacity='.8'/></g>`,
  hood: (c, a, skin) => `<path d='M8.6 13 C8.6 3.6 23.4 3.6 23.4 13 C23.4 19.6 8.6 19.6 8.6 13Z' fill='${c}' ${O}/><rect x='9.6' y='10.8' width='12.8' height='3.8' rx='1.6' fill='${skin}'/><circle cx='13.4' cy='12.7' r='.9' fill='${OUT}'/><circle cx='18.6' cy='12.7' r='.9' fill='${OUT}'/><path d='M8.8 9.4 H23.2' stroke='${a}' stroke-width='1.6'/>`,
  knight: (c, a) => `<path d='M8.8 14 C8.8 2.8 23.2 2.8 23.2 14 L23.2 19.6 H8.8Z' fill='${c}' ${O}/><rect x='10.4' y='10.8' width='11.2' height='2.6' rx='.8' fill='#222'/><path d='M16 4 V10.6' stroke='${OUT}' stroke-width='.7'/><path d='M16 3.2 Q21 -1 25 3.6 Q21 2.6 17.6 5Z' fill='${a}' ${O}/>`,
  clownhat: (c, a) => `<g ${O}><path d='M11.6 7.8 L16.2 .8 L20.4 7.8Z' fill='${c}'/><circle cx='16.2' cy='1.2' r='1.6' fill='${a}'/></g>`,
  headset: () => `<g ${O}><path d='M8.6 13 C8.6 3 23.4 3 23.4 13' fill='none' stroke='#333' stroke-width='1.8'/><rect x='6.8' y='11' width='3.2' height='6' rx='1.4' fill='#444'/><rect x='22' y='11' width='3.2' height='6' rx='1.4' fill='#444'/></g>`,
  mirror: (c, a) => `<g ${O}><path d='M9.2 9 Q16 6.6 22.8 9' stroke='${a}' stroke-width='1.4' fill='none'/><circle cx='16' cy='7.6' r='2.2' fill='${c}'/><circle cx='15.4' cy='7' r='.7' fill='#fff' stroke='none'/></g>`,
  headband: (c) => `<path d='M9.2 9.6 Q16 6.6 22.8 9.6 L22.8 11.4 Q16 8.4 9.2 11.4Z' fill='${c}' ${O}/>`,
};

// --- props (drawn over the chest / beside the shoulder)
const PROPS = {
  none: () => "",
  glasses: () => `<g fill='rgba(255,255,255,.3)' ${O}><circle cx='13.2' cy='13.2' r='2.4'/><circle cx='18.8' cy='13.2' r='2.4'/><path d='M15.6 13 H16.4' fill='none'/></g>`,
  sunglasses: () => `<g fill='#1c1c22' ${O}><rect x='10.4' y='11.6' width='5' height='3.2' rx='1.2'/><rect x='16.6' y='11.6' width='5' height='3.2' rx='1.2'/><path d='M15.4 12.6 H16.6' fill='none'/></g>`,
  monocle: () => `<circle cx='18.8' cy='13.2' r='2.4' fill='rgba(255,255,255,.3)' ${O}/><path d='M20.4 15 Q22 20 20 24' stroke='#c9a64a' stroke-width='.8' fill='none'/>`,
  eyepatch: () => `<path d='M8.6 9.6 L22 15' stroke='${OUT}' stroke-width='.9'/><ellipse cx='13.2' cy='13.3' rx='2.5' ry='2.1' fill='#161616' ${O}/>`,
  stethoscope: () => `<path d='M11 21.8 C9.6 28.4 17 31.6 17.4 27' stroke='#444' stroke-width='1.2' fill='none' stroke-linecap='round'/><circle cx='17.4' cy='26.2' r='1.6' fill='#c9ced6' ${O}/><path d='M21 21.8 C22.4 25 20 26 19 26' stroke='#444' stroke-width='1.2' fill='none'/>`,
  badge: (a) => `<path d='M10.4 25.6 l1 -2.4 l1 2.4 l2.5 .2 l-1.9 1.7 l.6 2.5 l-2.2 -1.4 l-2.2 1.4 l.6 -2.5 l-1.9 -1.7z' fill='${a}' ${O}/>`,
  scarf: (a) => `<path d='M9.4 21.8 Q16 25.6 22.6 21.8 L22.6 24.6 Q16 28.2 9.4 24.6Z' fill='${a}' ${O}/><rect x='19.6' y='23.6' width='3.4' height='7.6' rx='.8' fill='${a}' ${O}/>`,
  bowtie: (a) => `<path d='M16 23.4 L12 21.4 V25.4Z M16 23.4 L20 21.4 V25.4Z' fill='${a}' ${O}/><circle cx='16' cy='23.4' r='1.1' fill='${a}' ${O}/>`,
  magnifier: () => `<circle cx='25.6' cy='24' r='3.2' fill='rgba(180,220,240,.55)' ${O}/><path d='M27.9 26.4 L30.6 29.8' stroke='#6b4423' stroke-width='1.8' stroke-linecap='round'/>`,
  brush: (a) => `<path d='M26.6 21 L23.6 31' stroke='#8a5a2b' stroke-width='1.6' stroke-linecap='round'/><path d='M27.2 19.2 L25.8 22.8 L28.6 22.2Z' fill='${a}' ${O}/>`,
  book: (a) => `<rect x='18.6' y='25.4' width='9' height='6' rx='.6' fill='${a}' ${O}/><path d='M23.1 25.4 V31.4' stroke='${OUT}' stroke-width='.7'/><path d='M19.8 27.2 H21.8 M24.4 27.2 H26.4' stroke='#fff' stroke-width='.6' opacity='.7'/>`,
  camera: () => `<rect x='18.6' y='25' width='9.6' height='6.4' rx='1.2' fill='#3a3a40' ${O}/><circle cx='23.4' cy='28.2' r='2.1' fill='#9ecbe0' stroke='#c9ced6' stroke-width='.8'/><rect x='20' y='23.8' width='3' height='1.4' fill='#3a3a40'/>`,
  wrench: () => `<path d='M25.6 19.8 L23.4 30.6' stroke='#9aa3ad' stroke-width='2' stroke-linecap='round'/><path d='M24 17.6 Q27.6 17.4 27.2 20.6 L25.8 20.2 L25.2 19 L24 19.4Z' fill='#9aa3ad' ${O}/>`,
  flask: () => `<path d='M22 24 H25.6 V27 L28 31 H19.6 L22 27Z' fill='#6fd08c' ${O}/><rect x='21.6' y='23' width='4.4' height='1.4' fill='#c9ced6' ${O}/>`,
  briefcase: () => `<rect x='18.8' y='26' width='10' height='6' rx='1' fill='#7b4a2a' ${O}/><path d='M22 26 V24.8 H25.6 V26' stroke='${OUT}' stroke-width='.8' fill='none'/><rect x='22.8' y='27.8' width='2' height='1.4' fill='#e4c179'/>`,
  gavel: () => `<path d='M26.6 22 L22.6 31' stroke='#8a5a2b' stroke-width='1.8' stroke-linecap='round'/><rect x='23.6' y='19' width='6' height='3.2' rx='.8' fill='#6b4423' ${O} transform='rotate(-24 26.6 20.6)'/>`,
  wand: () => `<path d='M24 30.6 L29.4 22.6' stroke='#222' stroke-width='1.4' stroke-linecap='round'/><circle cx='29.6' cy='22.2' r='1.4' fill='#ffd23f' ${O}/>`,
  staff: (a) => `<path d='M26.6 19 V32' stroke='#6b4423' stroke-width='1.8' stroke-linecap='round'/><circle cx='26.6' cy='17.6' r='2.2' fill='${a}' ${O}/>`,
  binoculars: () => `<circle cx='13' cy='27.4' r='2.5' fill='#3a3a40' ${O}/><circle cx='19' cy='27.4' r='2.5' fill='#3a3a40' ${O}/><rect x='14.4' y='26.4' width='3.2' height='2' fill='#3a3a40'/><path d='M10.6 25.4 Q16 22.8 21.4 25.4' stroke='#3a3a40' stroke-width='1' fill='none'/>`,
  cross: (a) => `<path d='M16 24.6 V31 M13.6 26.6 H18.4' stroke='${a}' stroke-width='1.6' stroke-linecap='round'/>`,
  pearls: () => [[10.6, 23.2], [12, 25], [14, 26.2], [16, 26.6], [18, 26.2], [20, 25], [21.4, 23.2]].map(([x, y]) => `<circle cx='${x}' cy='${y}' r='1.05' fill='#f7f3ea' stroke='#b9b2a0' stroke-width='.4'/>`).join(""),
  pitchfork: () => `<path d='M26.6 21 V32' stroke='#8a5a2b' stroke-width='1.5' stroke-linecap='round'/><path d='M23.8 17.4 V21 H29.4 V17.4 M26.6 17 V21' stroke='#9aa3ad' stroke-width='1.1' fill='none' stroke-linecap='round'/>`,
  cleaver: () => `<rect x='20.4' y='24.4' width='8' height='4.6' rx='.8' fill='#c9ced6' ${O}/><rect x='18.4' y='25.6' width='3' height='1.8' rx='.6' fill='#6b4423' ${O}/>`,
  duster: (a) => `<path d='M26.4 22.6 L23.6 31.6' stroke='#8a5a2b' stroke-width='1.4' stroke-linecap='round'/><path d='M26.6 22 C23.4 17.6 29.8 16.4 28.8 21.6 C30.4 19.8 31 23.6 26.6 22Z' fill='${a}' ${O}/>`,
  flower: (a) => `<path d='M25.6 31.8 V25.6' stroke='#3c6b3f' stroke-width='1.4'/><circle cx='25.6' cy='23.6' r='2.6' fill='${a}' ${O}/><circle cx='25.6' cy='23.6' r='1' fill='#ffd23f'/>`,
  axe: () => `<path d='M25.4 20 L22.6 31.6' stroke='#8a5a2b' stroke-width='1.6' stroke-linecap='round'/><path d='M23.4 18.6 L29.4 21.4 L27.4 25.4 L24.8 22.6Z' fill='#c9ced6' ${O}/>`,
  loaf: () => `<ellipse cx='23.4' cy='28.4' rx='5.4' ry='2.8' fill='#d9a05b' ${O}/><path d='M20.4 27.4 L21.4 29.6 M23 26.8 L24 29.2 M25.6 27.4 L26.4 29.6' stroke='#a9702e' stroke-width='.8' fill='none'/>`,
  cocktail: () => `<path d='M21 24 H28.4 L24.7 28.6Z' fill='#ff7f6b' ${O}/><path d='M24.7 28.6 V31.6 M22.6 31.8 H26.8' stroke='${OUT}' stroke-width='.9'/><circle cx='26.8' cy='23.6' r='1' fill='#6fae3f' ${O}/>`,
  ladle: () => `<path d='M26.4 20.6 L23.4 30.2' stroke='#9aa3ad' stroke-width='1.4' stroke-linecap='round'/><circle cx='27.2' cy='19.2' r='2.3' fill='#9aa3ad' ${O}/>`,
  guitar: (a) => `<path d='M22.4 24 L28.4 18.4' stroke='#6b4423' stroke-width='1.8' stroke-linecap='round'/><ellipse cx='21' cy='28.2' rx='4.2' ry='3.6' fill='${a}' ${O} transform='rotate(-35 21 28.2)'/><circle cx='21' cy='28.2' r='1.1' fill='#222'/>`,
  mask: (a) => `<circle cx='23.6' cy='27.6' r='3.6' fill='${a}' ${O}/><path d='M21.8 26.6 Q22.8 25.6 23.8 26.6 M24 26.6 Q25 25.6 26 26.6' stroke='${OUT}' stroke-width='.8' fill='none'/><path d='M21.8 29.4 Q23.6 31 25.6 29.4' stroke='${OUT}' stroke-width='.8' fill='none'/>`,
  wheel: () => `<circle cx='16' cy='29.4' r='4' fill='none' stroke='#333' stroke-width='1.6'/><path d='M12 29.4 H20 M16 29.4 V33' stroke='#333' stroke-width='1.2'/>`,
  nose: () => `<circle cx='16' cy='15.2' r='1.9' fill='#e63946' ${O}/>`,
  fangs: () => `<path d='M14.4 16.7 L14.9 18.7 L15.5 16.7 M16.5 16.7 L17.1 18.7 L17.6 16.7' fill='#fff' ${O}/>`,
  smudge: () => `<circle cx='19.4' cy='15.4' r='1.1' fill='#3a3a3a' opacity='.5'/><path d='M11 14.6 L12.6 14.2' stroke='#3a3a3a' stroke-width='1' opacity='.4'/>`,
  pencil: (a) => `<path d='M21.2 10.6 L23.6 7' stroke='${a}' stroke-width='1.5' stroke-linecap='round'/><path d='M23.6 7 l.6 -.9' stroke='${OUT}' stroke-width='1.1'/>`,
  press: () => `<rect x='19.6' y='5.4' width='5' height='3.2' rx='.4' fill='#fff' ${O} transform='rotate(8 22 7)'/><path d='M20.6 6.6 H23.6 M20.6 7.6 H22.6' stroke='${OUT}' stroke-width='.6'/>`,
  tray: () => `<ellipse cx='23.6' cy='29.6' rx='6.2' ry='1.4' fill='#c9ced6' ${O}/><path d='M19.6 29 C19.8 24.6 27.4 24.6 27.6 29Z' fill='#e3e7ec' ${O}/>`,
  star: () => `<path d='M23 24.2 l1.2 -2.8 l1.2 2.8 l3 .3 l-2.3 2 l.7 3 l-2.6 -1.6 l-2.6 1.6 l.7 -3 l-2.3 -2z' fill='#ffd23f' ${O}/>`,
};

const FACES = {
  normal: (skin) =>
    `<circle cx='13.4' cy='13.1' r='.95' fill='${OUT}'/><circle cx='18.6' cy='13.1' r='.95' fill='${OUT}'/>` +
    `<path d='M14.2 16.5 Q16 18.1 17.8 16.5' stroke='${OUT}' stroke-width='.8' fill='none' stroke-linecap='round'/>` +
    `<circle cx='11.4' cy='15.2' r='1.2' fill='#e8766b' opacity='.28'/><circle cx='20.6' cy='15.2' r='1.2' fill='#e8766b' opacity='.28'/>`,
  dead: () =>
    `<path d='M12.2 11.9 L14.6 14.3 M14.6 11.9 L12.2 14.3 M17.4 11.9 L19.8 14.3 M19.8 11.9 L17.4 14.3' stroke='${OUT}' stroke-width='1' stroke-linecap='round'/>` +
    `<path d='M14.2 17.2 Q16 16 17.8 17.2' stroke='${OUT}' stroke-width='.8' fill='none' stroke-linecap='round'/>`,
  smile: (skin) =>
    `<circle cx='13.4' cy='13.1' r='.95' fill='${OUT}'/><circle cx='18.6' cy='13.1' r='.95' fill='${OUT}'/>` +
    `<path d='M13.4 16 Q16 19 18.6 16Z' fill='#fff' ${O}/>`,
};

export function avatar({
  skin = "#f2c9a0", hair = "#5a3a22", hairStyle = "short", facial = "none", facialColor = null,
  outfit = "#3f6fb5", accent = "#e4b455", outfitStyle = "plain",
  hat = "none", hatColor = "#444", hatAccent = "#e4b455",
  prop = "none", propColor = null, face = "normal", glasses = false,
} = {}) {
  const parts = [];
  parts.push(`<path d='${SHOULDERS}' fill='${outfit}'/>`);
  parts.push(hairBack(hairStyle, hair));
  parts.push(`<rect x='13.2' y='17' width='5.6' height='5.6' fill='${skin}' ${O}/>`);
  parts.push(`<ellipse cx='16' cy='20.2' rx='3.6' ry='1.3' fill='rgba(0,0,0,.14)'/>`);
  parts.push(outfitDetail(outfitStyle, outfit, accent, skin));
  parts.push(`<path d='${SHOULDERS}' fill='none' ${O}/>`);
  parts.push(`<circle cx='9.3' cy='13.8' r='1.5' fill='${skin}' ${O}/><circle cx='22.7' cy='13.8' r='1.5' fill='${skin}' ${O}/>`);
  parts.push(`<ellipse cx='16' cy='13' rx='6.7' ry='7.1' fill='${skin}' ${O}/>`);
  parts.push(FACES[face] ? FACES[face](skin) : FACES.normal(skin));
  parts.push(facialHair(facial, facialColor || hair));
  parts.push(hairFront(hairStyle, hair, skin));
  if (glasses) parts.push(PROPS.glasses());
  const hatFn = HATS[hat] || HATS.none;
  parts.push(hatFn(hatColor, hatAccent, skin));
  const propFn = PROPS[prop] || PROPS.none;
  parts.push(propFn(propColor || accent));
  return `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">${parts.join("")}</svg>`;
}

const SK = { light: "#f6d5b8", fair: "#f2c9a0", tan: "#dfa877", brown: "#b97a47", dark: "#7d4a2a", pale: "#ece4d8" };

// Ids are persisted in saved puzzles (character.iconId): never rename or
// remove one (an unknown id falls back to person1). The first block keeps the
// historical ids, redrawn in the new style; order is the round-robin order
// new characters get icons in.
export const PROFESSIONS = [
  { id: "person1", label: "Persona 1", skin: SK.fair, hair: "#6b4a2b", hairStyle: "short", outfit: "#3f78c9", outfitStyle: "plain" },
  { id: "person2", label: "Persona 2", skin: SK.tan, hair: "#2a1d14", hairStyle: "ponytail", outfit: "#2f9c8a", accent: "#fff", outfitStyle: "sweater" },
  { id: "hat", label: "Cronista", skin: SK.fair, hair: "#4a3322", hairStyle: "short", outfit: "#8a6b45", accent: "#c9a46a", outfitStyle: "trench", hat: "fedora", hatColor: "#7a5a3a", hatAccent: "#d9a441", prop: "press", propColor: "#fff" },
  { id: "glasses", label: "Studioso/a", skin: SK.light, hair: "#8a5a2b", hairStyle: "wild", outfit: "#7a4a8a", accent: "#d8b4e0", outfitStyle: "sweater", glasses: true, prop: "book", propColor: "#2e6b4a" },
  { id: "detective", label: "Detective", skin: SK.fair, hair: "#3a2a1c", hairStyle: "short", facial: "mustache", outfit: "#8a7358", accent: "#6a5640", outfitStyle: "trench", hat: "fedora", hatColor: "#6a5a48", hatAccent: "#2b2b2b", prop: "magnifier" },
  { id: "butler", label: "Maggiordomo", skin: SK.light, hair: "#c9ccd2", hairStyle: "sides", facial: "mustache", facialColor: "#c9ccd2", outfit: "#26262b", accent: "#d93a3a", outfitStyle: "tailcoat", prop: "bowtie", propColor: "#d93a3a" },
  { id: "chef", label: "Cuoco/a", skin: SK.tan, hair: "#2a1d14", hairStyle: "short", facial: "mustache", outfit: "#f4f4f0", accent: "#d9d9d2", outfitStyle: "doublebreasted", hat: "toque", hatColor: "#ffffff", prop: "ladle" },
  { id: "maid", label: "Cameriera/e", skin: SK.fair, hair: "#4a2f1d", hairStyle: "bun", outfit: "#2d2d33", accent: "#fff", outfitStyle: "apron", hat: "maidcap", prop: "duster", propColor: "#e8a5c0" },
  { id: "gardener", label: "Giardiniere/a", skin: SK.tan, hair: "#7a5a2f", hairStyle: "short", outfit: "#e8dfc8", accent: "#3f8a4c", outfitStyle: "overalls", hat: "straw", hatColor: "#e6c973", hatAccent: "#3f8a4c", prop: "flower", propColor: "#e8567a" },
  { id: "driver", label: "Autista", skin: SK.fair, hair: "#2b2b2f", hairStyle: "short", outfit: "#4b5563", accent: "#e4b455", outfitStyle: "uniform", hat: "cap", hatColor: "#2f3a4a", hatAccent: "#1c232d", prop: "wheel" },
  { id: "professor", label: "Professore/essa", skin: SK.light, hair: "#b9bcc4", hairStyle: "sides", facial: "beard", facialColor: "#c9ccd2", outfit: "#2a2a33", accent: "#e4b455", outfitStyle: "suit", hat: "mortar", hatColor: "#1f1f26", hatAccent: "#e4b455", glasses: true },
  { id: "artist", label: "Artista", skin: SK.tan, hair: "#3a2a1c", hairStyle: "curly", facial: "goatee", outfit: "#e9e4d4", accent: "#e4572e", outfitStyle: "smock", hat: "beret", hatColor: "#c0392b", hatAccent: "#7a1f17", prop: "brush", propColor: "#2e86ab" },
  // --- new professions
  { id: "doctor", label: "Medico", skin: SK.fair, hair: "#4a3322", hairStyle: "short", outfit: "#f6f8fa", accent: "#4ba3c7", outfitStyle: "coat", hat: "mirror", hatColor: "#dfe6ee", hatAccent: "#9aa3ad", prop: "stethoscope" },
  { id: "nurse", label: "Infermiere/a", skin: SK.tan, hair: "#2a1d14", hairStyle: "bun", outfit: "#7fcfd0", accent: "#fff", outfitStyle: "uniform", hat: "nurse", prop: "stethoscope" },
  { id: "police", label: "Poliziotto/a", skin: SK.fair, hair: "#3a2a1c", hairStyle: "short", outfit: "#26365a", accent: "#e4c179", outfitStyle: "uniform", hat: "kepi", hatColor: "#26365a", hatAccent: "#e4c179", prop: "badge", propColor: "#e4c179" },
  { id: "judge", label: "Giudice", skin: SK.light, hair: "#c9ccd2", hairStyle: "bald", outfit: "#1d1d22", accent: "#fff", outfitStyle: "habit", hat: "wig", hatColor: "#f1f1ec", prop: "gavel" },
  { id: "lawyer", label: "Avvocato", skin: SK.tan, hair: "#1f1b17", hairStyle: "slick", outfit: "#3a3f4b", accent: "#8a1f2d", outfitStyle: "suit", glasses: true, prop: "briefcase" },
  { id: "pilot", label: "Pilota", skin: SK.fair, hair: "#5a3a22", hairStyle: "short", outfit: "#7a5a3a", accent: "#e8e0cf", outfitStyle: "bomber", hat: "pilot", hatColor: "#6b4a2a", hatAccent: "#c9a64a", prop: "scarf", propColor: "#f1f1ec" },
  { id: "sailor", label: "Marinaio", skin: SK.tan, hair: "#6b4a2b", hairStyle: "short", facial: "beard", outfit: "#f4f4f0", accent: "#2b4c8c", outfitStyle: "stripes", hat: "sailor", hatColor: "#ffffff", hatAccent: "#2b4c8c" },
  { id: "firefighter", label: "Pompiere", skin: SK.fair, hair: "#3a2a1c", hairStyle: "short", facial: "mustache", outfit: "#2d2d33", accent: "#f2c94c", outfitStyle: "vest", hat: "helmet", hatColor: "#d93a3a", hatAccent: "#f2c94c", prop: "axe" },
  { id: "pharmacist", label: "Farmacista", skin: SK.light, hair: "#7a5a3a", hairStyle: "bob", outfit: "#f4f6f4", accent: "#3fae6a", outfitStyle: "coat", glasses: true, prop: "cross", propColor: "#3fae6a" },
  { id: "bartender", label: "Barista", skin: SK.tan, hair: "#1f1b17", hairStyle: "slick", facial: "mustache", outfit: "#3b2a2a", accent: "#d9a441", outfitStyle: "suit", prop: "cocktail" },
  { id: "baker", label: "Fornaio", skin: SK.fair, hair: "#8a5a2b", hairStyle: "short", facial: "mustache", outfit: "#f6f1e6", accent: "#d9a441", outfitStyle: "apron", hat: "toque", hatColor: "#fdfdfb", prop: "loaf" },
  { id: "butcher", label: "Macellaio", skin: SK.tan, hair: "#2a1d14", hairStyle: "short", facial: "beard", outfit: "#f6f1f1", accent: "#d93a3a", outfitStyle: "stripes", hat: "cap", hatColor: "#ffffff", hatAccent: "#e6e6e6", prop: "cleaver" },
  { id: "mechanic", label: "Meccanico", skin: SK.tan, hair: "#2a1d14", hairStyle: "short", outfit: "#2f5fa8", accent: "#f2c94c", outfitStyle: "overalls", hat: "cap", hatColor: "#c0392b", hatAccent: "#7a1f17", prop: "wrench" },
  { id: "musician", label: "Musicista", skin: SK.brown, hair: "#1f1b17", hairStyle: "curly", outfit: "#8a3f9a", accent: "#e4b455", outfitStyle: "sweater", hat: "headset", prop: "guitar", propColor: "#d9a441" },
  { id: "scientist", label: "Scienziato/a", skin: SK.light, hair: "#e8e8ee", hairStyle: "wild", outfit: "#f6f8fa", accent: "#6fd08c", outfitStyle: "coat", glasses: true, prop: "flask" },
  { id: "explorer", label: "Esploratore", skin: SK.tan, hair: "#6b4a2b", hairStyle: "short", facial: "mustache", outfit: "#b9a06a", accent: "#7a5a2b", outfitStyle: "trench", hat: "pith", hatColor: "#d6c08a", hatAccent: "#7a5a2b", prop: "binoculars" },
  { id: "priest", label: "Sacerdote", skin: SK.light, hair: "#b9bcc4", hairStyle: "sides", outfit: "#1d1d22", accent: "#e4c179", outfitStyle: "clerical", prop: "cross", propColor: "#e4c179" },
  { id: "farmer", label: "Contadino/a", skin: SK.fair, hair: "#8a5a2b", hairStyle: "short", facial: "beard", outfit: "#c0392b", accent: "#7a1f17", outfitStyle: "plaid", hat: "straw", hatColor: "#e0c36b", hatAccent: "#7a5a2b", prop: "pitchfork" },
  { id: "librarian", label: "Bibliotecario/a", skin: SK.light, hair: "#6b4a2b", hairStyle: "bun", outfit: "#7a8a5a", accent: "#e8e0cf", outfitStyle: "sweater", glasses: true, prop: "book", propColor: "#8a1f2d" },
  { id: "photographer", label: "Fotografo/a", skin: SK.tan, hair: "#2a1d14", hairStyle: "short", facial: "goatee", outfit: "#5a6b4a", accent: "#3a4430", outfitStyle: "vest", prop: "camera" },
  { id: "countess", label: "Contessa", skin: SK.light, hair: "#8a2f2f", hairStyle: "long", outfit: "#6a2a7a", accent: "#e4c179", outfitStyle: "plain", hat: "tiara", hatColor: "#dfe3ea", hatAccent: "#6ab0e0", prop: "pearls" },
  { id: "pirate", label: "Pirata", skin: SK.tan, hair: "#1f1b17", hairStyle: "short", facial: "beard", outfit: "#a8372c", accent: "#e8dfc8", outfitStyle: "stripes", hat: "tricorn", hatColor: "#1f1f24", hatAccent: "#e4c179", prop: "eyepatch" },
  { id: "spy", label: "Spia", skin: SK.fair, hair: "#1f1b17", hairStyle: "slick", outfit: "#2a2d36", accent: "#555b69", outfitStyle: "trench", hat: "fedora", hatColor: "#2b2d35", hatAccent: "#8a1f2d", prop: "sunglasses" },
  { id: "wizard", label: "Mago", skin: SK.light, hair: "#e8e8ee", hairStyle: "long", facial: "beard", facialColor: "#e8e8ee", outfit: "#4a3a9a", accent: "#ffd23f", outfitStyle: "robe", hat: "wizard", hatColor: "#4a3a9a", hatAccent: "#ffd23f", prop: "staff", propColor: "#8be0ff" },
  { id: "cowboy", label: "Cowboy", skin: SK.tan, hair: "#6b4a2b", hairStyle: "short", facial: "mustache", outfit: "#a0643a", accent: "#e4c179", outfitStyle: "plain", hat: "cowboy", hatColor: "#8a5a35", hatAccent: "#e4c179", prop: "badge", propColor: "#e4c179" },
  { id: "king", label: "Re", skin: SK.light, hair: "#c9ccd2", hairStyle: "long", facial: "beard", facialColor: "#c9ccd2", outfit: "#a81f2d", accent: "#e4c179", outfitStyle: "royal", hat: "crown", hatColor: "#e4b455", hatAccent: "#d93a3a" },
  { id: "queen", label: "Regina", skin: SK.fair, hair: "#3a2a1c", hairStyle: "long", outfit: "#2a5fa8", accent: "#e4c179", outfitStyle: "royal", hat: "crown", hatColor: "#e4b455", hatAccent: "#8a3fb0", prop: "pearls" },
  { id: "knight", label: "Cavaliere", skin: SK.fair, hair: "#3a2a1c", hairStyle: "bald", outfit: "#8d96a3", accent: "#c9ced6", outfitStyle: "uniform", hat: "knight", hatColor: "#b9bfc7", hatAccent: "#d93a3a" },
  { id: "monk", label: "Monaco", skin: SK.fair, hair: "#6b4a2b", hairStyle: "tonsure", outfit: "#7a5a3a", accent: "#4a3422", outfitStyle: "habit", prop: "cross", propColor: "#e4c179" },
  { id: "astronaut", label: "Astronauta", skin: SK.tan, hair: "#2a1d14", hairStyle: "short", outfit: "#f1f4f8", accent: "#d93a3a", outfitStyle: "uniform", hat: "astronaut", prop: "star" },
  { id: "ninja", label: "Ninja", skin: SK.fair, hair: "#222", hairStyle: "bald", outfit: "#26262b", accent: "#d93a3a", outfitStyle: "plain", hat: "hood", hatColor: "#26262b", hatAccent: "#d93a3a" },
  { id: "clown", label: "Clown", skin: "#fbf3ea", hair: "#ff6b3d", hairStyle: "curly", outfit: "#2f7de1", accent: "#f2c94c", outfitStyle: "flowers", hat: "clownhat", hatColor: "#e63946", hatAccent: "#f2c94c", prop: "nose", face: "smile" },
  { id: "magician", label: "Illusionista", skin: SK.light, hair: "#1f1b17", hairStyle: "slick", facial: "mustache", outfit: "#1d1d22", accent: "#c0392b", outfitStyle: "cape", hat: "top", hatColor: "#17171b", hatAccent: "#c0392b", prop: "wand" },
  { id: "soldier", label: "Soldato", skin: SK.tan, hair: "#2a1d14", hairStyle: "short", outfit: "#5b6b3a", accent: "#3e4a26", outfitStyle: "uniform", hat: "helmet", hatColor: "#5b6b3a", hatAccent: "#3e4a26", prop: "badge", propColor: "#e4c179" },
  { id: "banker", label: "Banchiere", skin: SK.light, hair: "#8a8d95", hairStyle: "sides", facial: "mustache", outfit: "#2a2f3a", accent: "#2e6b4a", outfitStyle: "suit", hat: "bowler", hatColor: "#202026", hatAccent: "#c9a64a", prop: "monocle" },
  { id: "actor", label: "Attore/Attrice", skin: SK.fair, hair: "#6a2f1d", hairStyle: "bob", outfit: "#8a1f4a", accent: "#e4c179", outfitStyle: "suit", prop: "mask", propColor: "#e4c179", face: "smile" },
  { id: "construction", label: "Operaio", skin: SK.brown, hair: "#1f1b17", hairStyle: "short", facial: "mustache", outfit: "#f2742e", accent: "#f6f1d0", outfitStyle: "vest", hat: "hardhat", hatColor: "#f2c94c", hatAccent: "#8a6d00", prop: "smudge" },
  { id: "tourist", label: "Turista", skin: SK.light, hair: "#c9a64a", hairStyle: "short", outfit: "#22a6b3", accent: "#fff", outfitStyle: "flowers", hat: "straw", hatColor: "#f1e3a8", hatAccent: "#e8567a", prop: "camera", propColor: "#333", glasses: false },
  { id: "rockstar", label: "Rockstar", skin: SK.fair, hair: "#1f1b17", hairStyle: "wild", outfit: "#17171b", accent: "#c9ced6", outfitStyle: "leather", prop: "sunglasses" },
  { id: "vampire", label: "Vampiro/a", skin: SK.pale, hair: "#17171b", hairStyle: "slick", outfit: "#17171b", accent: "#a81f2d", outfitStyle: "cape", prop: "fangs", face: "smile" },
  { id: "nun", label: "Suora", skin: SK.light, hair: "#1d1d22", hairStyle: "veil", outfit: "#1d1d22", accent: "#fff", outfitStyle: "habit", prop: "cross", propColor: "#e4c179" },
  { id: "gangster", label: "Gangster", skin: SK.tan, hair: "#17171b", hairStyle: "slick", outfit: "#33363f", accent: "#d93a3a", outfitStyle: "suit", hat: "fedora", hatColor: "#17171b", hatAccent: "#e8e8e8", prop: "sunglasses" },
  { id: "waiter", label: "Cameriere", skin: SK.light, hair: "#3a2a1c", hairStyle: "slick", facial: "mustache", outfit: "#f4f4f0", accent: "#1d1d22", outfitStyle: "tailcoat", prop: "tray" },
  // Not selectable for a regular character (see SELECTABLE_CHARACTER_ICON_IDS).
  { id: "victim", label: "Vittima", skin: SK.pale, hair: "#6b6b70", hairStyle: "short", outfit: "#7c3a3a", accent: "#a81f2d", outfitStyle: "plain", face: "dead" },
];

export function buildCharacterIcons() {
  const icons = {};
  for (const p of PROFESSIONS) {
    const { id, label, ...opts } = p;
    icons[id] = { label, icon: avatar(opts) };
  }
  return icons;
}
