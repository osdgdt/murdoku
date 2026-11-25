// `node tools/ml-catalog.mjs > catalogo.json` — i tipi di indizio dell'app con i loro parametri, per il menu «crea l'indizio» della pagina di
// correzione (ml/reader/review.py). Li legge dallo stesso elenco che usa l'editor (src/model/clueTypes.js), così non c'è una seconda lista da tenere
// allineata. Sono lasciati fuori i tipi che si scrivono altrove: i generali (non di un personaggio), i composti (O / ruolo) e quelli che chiedono un
// altro indizio o l'elenco dei bersagli (non si fanno con un menu semplice), e quelli i cui valori vengono dal caso (ruoli, luoghi da identificare).
globalThis.__MURDOKU_LANG__ = "it";
const { CLUE_TYPES, characterClueTypeIds } = await import("../src/model/clueTypes.js");

const SIMPLE_KINDS = new Set(["character", "characterOrObject", "zone", "enum", "number"]);
// i ruoli e i luoghi da identificare dipendono dal caso (la bozza non ha né gli uni né gli altri)
const HIDDEN_PARAMS = new Set(["roleId", "placeName"]);

const types = [];
for (const id of characterClueTypeIds()) {
  const def = CLUE_TYPES[id];
  const params = def.params || [];
  if (
    def.combinator ||
    def.internal ||
    def.floors ||
    params.some((p) => !SIMPLE_KINDS.has(p.kind) || (p.kind === "enum" && !(p.values || []).length) || HIDDEN_PARAMS.has(p.name))
  )
    continue;
  types.push({
    id,
    label: def.label,
    params: params.map((p) => ({
      name: p.name,
      kind: p.kind,
      label: p.label || p.name,
      ...(p.kind === "enum" ? { values: (p.values || []).map((v) => ({ value: v, label: (p.labels && p.labels[v]) || String(v) })) } : {}),
      ...(p.kind === "number" ? { min: p.min ?? null, max: p.max ?? null } : {}),
    })),
  });
}
process.stdout.write(JSON.stringify({ types }));
