// `node tools/ml-catalog.mjs > catalogo.json` — i tipi di indizio dell'app con i loro parametri, per il menu «crea l'indizio» della pagina di
// correzione (ml/reader/review.py). Li legge dallo stesso elenco che usa l'editor (src/model/clueTypes.js), così non c'è una seconda lista da tenere
// allineata. Ogni tipo porta `scope`: "character" (l'indizio di una scheda) o "generic" (un fatto sulla scena, senza personaggio).
// Sono lasciati fuori i tipi che non si fanno con un menu semplice: i composti (O), quelli dei piani (la bozza non ha piani) e quelli i cui valori
// vengono dal caso (ruoli, luoghi da identificare). Delle proprietà di una persona (accanto a…, uomo, donna, seduto…, un'altra condizione) c'è
// tutto: «un'altra condizione» porta dentro un indizio intero (parametro `customClue`, kind "clueRef"), che il menu compone con lo stesso catalogo.
globalThis.__MURDOKU_LANG__ = "it";
const { CLUE_TYPES, characterClueTypeIds, genericClueTypeIds } = await import("../src/model/clueTypes.js");

const SIMPLE_KINDS = new Set(["character", "characterOrObject", "zone", "enum", "number"]);
// l'unico indizio dentro un altro che il menu sa comporre è la condizione di «un'altra condizione»
const isNestedCondition = (p) => p.kind === "clueRef" && p.name === "customClue";
// i ruoli e i luoghi da identificare dipendono dal caso (la bozza non ha né gli uni né gli altri)
const HIDDEN_PARAMS = new Set(["roleId", "placeName"]);
// dei parametri di una proprietà conta solo quello che la proprietà scelta usa (come nell'editor: clueDraft.js, PROPERTY_PARAM)
const PROPERTY_PARAM = { targetId: "adjacentTo", objectTypeId: "sittingOn", customClue: "custom" };

function describeParam(def, p) {
  const isProperty = (def.params || []).some((q) => q.name === "property");
  let values = p.kind === "enum" ? (p.values || []).filter((v) => !(p.floorValues || []).includes(v)) : null;
  const optional = !!p.optional || (values !== null && values.includes(""));
  if (values) values = values.filter((v) => v !== "");
  return {
    name: p.name,
    kind: p.kind,
    label: p.label || p.name,
    ...(optional ? { optional: true } : {}),
    ...(isProperty && PROPERTY_PARAM[p.name] ? { showIf: { property: PROPERTY_PARAM[p.name] } } : {}),
    ...(values ? { values: values.map((v) => ({ value: v, label: (p.labels && p.labels[v]) || String(v) })) } : {}),
    ...(p.kind === "number" ? { min: p.min ?? null, max: p.max ?? null } : {}),
  };
}

const types = [];
for (const [scope, ids] of [
  ["character", characterClueTypeIds()],
  ["generic", genericClueTypeIds()],
]) {
  for (const id of ids) {
    const def = CLUE_TYPES[id];
    const params = def.params || [];
    if (
      def.combinator ||
      def.internal ||
      def.floors ||
      params.some(
        (p) =>
          (!SIMPLE_KINDS.has(p.kind) && !isNestedCondition(p)) ||
          (p.kind === "enum" && !(p.values || []).length) ||
          HIDDEN_PARAMS.has(p.name)
      )
    )
      continue;
    types.push({ id, scope, label: def.label, params: params.map((p) => describeParam(def, p)) });
  }
}
process.stdout.write(JSON.stringify({ types }));
