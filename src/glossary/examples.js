// Content of the clue glossary (glossary.html): for every clue type, a plain
// explanation plus a tiny worked example. The examples are NOT hand-drawn
// pictures: each one is a real little puzzle (map, objects, characters) built
// with the game's own model, and the cells shown as "valid" are computed by
// running the clue through the game's own solver predicates — so the glossary
// can never disagree with how the game actually judges a clue.
//
// This module is pure (no DOM): glossaryPage.js draws it, test-glossary.js
// checks it.
import { t } from "../i18n/i18n.js";
import { createGrid, placeObject, addZone, paintCellZone, isOccupiable, setSeal } from "../model/grid.js";
import { createPuzzle, addCharacter } from "../model/puzzle.js";
import { describeClue } from "../model/clueTypes.js";
import { buildPredicate } from "../solver/predicates/index.js";
import { resolveClueHoverCells } from "../solver/hoverTargets.js";
import { objectTypeTargetId } from "../model/icons.js";
import { addRole, setZoneNoble, setEveryoneHasRole, setRoleCount } from "../model/roles.js";
import { withDeclared } from "../model/declared.js";
import { setZoneNameHidden } from "../model/placeNames.js";
import { setZoneTerrain } from "../model/terrain.js";
import { setSectors, lineTracker } from "../model/sectors.js";
import { placeElevator, placeStairs } from "../model/floors.js";

// --- the little worlds ---------------------------------------------------------

// Map letters: a room each ('.' = no room, '#' = blocked cell).
const OPEN = [".....", ".....", ".....", ".....", "....."];
const TWO_ROOMS = ["AAABB", "AAABB", "AAABB", "AAABB", "AAABB"];
const ONE_ROOM = ["AAAAA", "AAAAA", "AAAAA", "AAAAA", "AAAAA"];
const FOUR_ROOMS = ["AAABB", "AAABB", "CCCDD", "CCCDD", "CCCDD"];
export const ROOM_NAMES = () => ({ A: t("Cucina"), B: t("Salotto"), C: t("Studio"), D: t("Bagno") });
// A skyscraper of three floors of two rows each (the highest first); the map is the 6 rows of the three floors one under the other.
const THREE_FLOORS = ["...", "...", "...", "...", "...", "..."];
const FLOOR_NAMES = () => [t("Attico"), t("Primo piano"), t("Terra")];
// A train of two wagons of three columns (the map is 4 rows by 6 columns, the wagons side by side).
const TWO_WAGONS = ["......", "......", "......", "......"];
const WAGON_NAMES = () => [t("Merci"), t("Passeggeri")];
// The map of the sea clues: the Water, a ship, a beach and another ship.
const SEA_NAMES = () => ({ A: t("Acqua"), B: t("Sloop"), C: t("Spiaggia"), D: t("Galeone") });
// Four islands whose names are to be deduced (they show as «???» on the board).
const ISLAND_NAMES = () => ({ A: t("Cocco"), B: t("Deserta"), C: t("Pietà"), D: t("Sussurri") });

// The stock cast: Anna is the one the clue is about ("owner"); the others are
// there to make the board look like a real case.
// The names are Italian source text: they go through t() when a case is built
// (and in castName), so the English page shows English names (see en/tutorial.js
// and en/glossary.js).
const CAST = {
  a: { name: "Anna", icon: "detective" },
  b: { name: "Bruno", icon: "butler" },
  c: { name: "Carla", icon: "chef" },
  d: { name: "Dario", icon: "gardener" },
};

// The name of a stock character in the current language.
export function castName(key) {
  return t(CAST[key].name);
}

export const FAMILIES = [
  { id: "concepts", title: () => t("Per cominciare"), blurb: () => t("Le idee che servono per leggere qualsiasi indizio.") },
  {
    id: "near",
    title: () => t("Accanto, tra, di fronte"),
    blurb: () => t("Dove sta un personaggio rispetto a oggetti e ad altre persone."),
  },
  { id: "direction", title: () => t("Direzioni"), blurb: () => t("Nord, sud, est, ovest: a quale distanza e rispetto a chi.") },
  { id: "lines", title: () => t("Righe e colonne"), blurb: () => t("Indizi che parlano delle righe (R1, R2…) e delle colonne (C1, C2…).") },
  { id: "rooms", title: () => t("Stanze"), blurb: () => t("In quale stanza si trova un personaggio e con chi la condivide.") },
  {
    id: "scene",
    title: () => t("Fatti sulla scena"),
    blurb: () => t("Indizi generali: non riguardano un personaggio solo, ma tutta la scena."),
  },
  {
    id: "roles",
    title: () => t("Ruoli nascosti"),
    blurb: () => t("Nobili, villici, cavalieri, fuorilegge, mansioni: ruoli che nessuno dichiara e che si deducono."),
  },
  {
    id: "sea",
    title: () => t("Mare e navi"),
    blurb: () => t("Pirati: chi è in mare (su una nave o nell'Acqua) e chi è a terra."),
  },
  {
    id: "floors",
    title: () => t("Treno e grattacielo"),
    blurb: () =>
      t(
        "Casi con più mappe in una: vagoni affiancati (treno) o piani impilati (grattacielo). Ogni piano si guarda da solo, e due persone sono vicine fra piani diversi solo per scale e ascensore."
      ),
  },
  { id: "logic", title: () => t("Combinare gli indizi"), blurb: () => t("Come unire due indizi in uno.") },
];

// Each entry: { id, type, family, owner, params, negate, explain, tip, world, labels, falseCast }
//  - params refer to things in the world by short refs: "@c:b" (character b),
//    "@o:0" (the first object listed), "@z:C" (room C), "@t:plant" (any plant).
//  - `owner: "a"` for a clue about Anna; `owner: null` for a general clue,
//    which is shown twice, as a TRUE and a FALSE arrangement (`world.cast`
//    gives the true one, `falseCast` the changed positions of the false one).
//  - `labels: true` shows the R1…/C1… labels (row/column clues).
export const ENTRIES = [
  // ===================================================================== concepts
  {
    id: "base-rule",
    family: "concepts",
    title: () => t("La regola di base"),
    owner: "a",
    type: null,
    params: {},
    explain: () =>
      t(
        "In ogni caso c'è una sola persona per riga e una sola per colonna. Appena un personaggio è collocato, le altre caselle della sua riga e della sua colonna sono escluse per tutti (le segna la ×). La vittima, inoltre, si trova sempre in una stanza con una sola altra persona: l'assassino."
      ),
    tip: () => t("Gli indizi servono a stringere ulteriormente: qui sotto, ogni esempio mostra in verde le caselle che restano possibili."),
    world: { map: OPEN, cast: { b: { at: [1, 3] }, c: { at: [3, 1] } } },
    sentence: () =>
      t("{a}, {b} e {c}: tre persone, tre righe e tre colonne diverse.", { a: castName("a"), b: castName("b"), c: castName("c") }),
  },
  {
    id: "targets",
    family: "concepts",
    title: () => t("Il bersaglio di un indizio"),
    owner: "a",
    type: "adjacent",
    params: { targetId: "@o:0" },
    explain: () =>
      t(
        "Molti indizi parlano di un «bersaglio»: può essere un personaggio, un singolo oggetto (una pianta precisa), una stanza, oppure «qualsiasi» oggetto di un tipo (una qualunque pianta, una qualunque porta). Con «qualsiasi» basta che l'indizio sia vero per uno qualunque di quegli oggetti."
      ),
    tip: () => t("Una persona collocata e un oggetto contano come bersagli allo stesso modo: l'indizio guarda dove si trovano."),
    world: {
      map: OPEN,
      objects: [
        { type: "plant", at: [1, 1] },
        { type: "plant", at: [3, 3] },
      ],
    },
    paramsOverride: { targetId: "@t:plant" },
  },
  {
    id: "negation",
    family: "concepts",
    title: () => t("Il riquadro «no»"),
    owner: "a",
    type: "adjacent",
    negate: true,
    params: { targetId: "@o:0" },
    explain: () =>
      t(
        "Accanto a ogni indizio c'è una casella «no»: la spunti e l'indizio si legge al contrario. «È accanto a una pianta» diventa «Non è accanto a una pianta». Vale per qualsiasi tipo di indizio, per questo non esiste un tipo separato per ogni negazione."
      ),
    world: { map: TWO_ROOMS, rooms: ROOM_NAMES, objects: [{ type: "plant", at: [2, 2] }] },
  },
  {
    id: "tense",
    family: "concepts",
    title: () => t("Il tempo verbale"),
    owner: "a",
    type: null,
    params: {},
    board: false,
    explain: () =>
      t(
        "Tutti gli indizi di un caso sono scritti nello stesso tempo: al presente, al passato o al futuro. Lo sceglie chi crea il caso con un solo menu nell'editor, e cambia le parole ma non il significato. «Vicino» non si usa mai: si dice sempre «accanto»."
      ),
    sentence: () => t("«È accanto a una pianta» · «Era accanto a una pianta» · «Sarà accanto a una pianta»"),
    world: { map: OPEN },
  },
  {
    id: "room-target",
    family: "concepts",
    title: () => t("Una stanza come bersaglio"),
    owner: "a",
    type: "adjacent",
    params: { targetId: "@z:A" },
    explain: () =>
      t(
        "Se il bersaglio è una stanza, «accanto» vuol dire accanto a un suo muro, ma da fuori: si sta in una casella che tocca la stanza senza farne parte. Chi si trova dentro la stanza non vale."
      ),
    tip: () =>
      t(
        "Qui «accanto alla Cucina» significa le caselle del Salotto e dello Studio che confinano con la Cucina, non quelle della Cucina stessa."
      ),
    world: { map: FOUR_ROOMS, rooms: ROOM_NAMES },
  },

  // ===================================================================== near
  {
    id: "adjacent",
    type: "adjacent",
    family: "near",
    owner: "a",
    params: { targetId: "@o:0" },
    explain: () =>
      t(
        "Il personaggio sta in una casella confinante (sopra, sotto, a destra o a sinistra) con il bersaglio. Le diagonali non contano. Una porta o una finestra è un pezzo di muro tra due caselle: vale chi sta in una di quelle due caselle, anche se sono in stanze diverse."
      ),
    tip: () => t("Conta solo la stanza del bersaglio: la casella a destra della pianta, oltre il muro, è nel Salotto e non vale."),
    world: { map: TWO_ROOMS, rooms: ROOM_NAMES, objects: [{ type: "plant", at: [2, 2] }] },
  },
  {
    id: "diagonal",
    type: "diagonal",
    family: "near",
    owner: "a",
    params: { targetId: "@c:b" },
    explain: () =>
      t(
        "Il personaggio sta in una delle quattro caselle in diagonale rispetto al bersaglio. A differenza di «accanto», le stanze qui non contano."
      ),
    world: { map: TWO_ROOMS, rooms: ROOM_NAMES, cast: { b: { at: [2, 2] } } },
  },
  {
    id: "onObjectType",
    type: "onObjectType",
    family: "near",
    owner: "a",
    params: { objectTypeId: "carpet" },
    explain: () =>
      t(
        "Il personaggio sta proprio sopra un oggetto di quel tipo. Si può stare solo su ciò che è basso e piatto: tappeti, sedie, sgabelli, letti, panche, troni, pozze di fango e cavalli (di un cavallo si dice «in sella a»). Non su uno scaffale o un tavolo."
      ),
    world: {
      map: OPEN,
      objects: [
        { type: "carpet", at: [1, 1] },
        { type: "carpet", at: [3, 3] },
        { type: "chair", at: [2, 4] },
        { type: "table", at: [0, 3] },
      ],
    },
  },
  {
    id: "nextToWall",
    type: "nextToWall",
    family: "rooms",
    owner: "a",
    params: {},
    explain: () =>
      t(
        "Il personaggio sta in una casella con un muro su almeno un lato: la parete fra due stanze, quella fra una stanza e l'esterno (o una casella vuota) o il bordo della mappa. Le caselle in mezzo a una stanza o a un'area aperta non lo sono."
      ),
    world: { map: ONE_ROOM, rooms: ROOM_NAMES, cast: { b: { at: [0, 3] }, c: { at: [4, 1] } } },
  },
  {
    id: "onSeal",
    type: "onSeal",
    family: "near",
    owner: "a",
    params: { sealKind: "anubis" },
    explain: () =>
      t(
        "Il personaggio sta su una casella con un sigillo. Il sigillo di Anubi vuole chi ci sta da solo nella sua stanza, quello di Ra vuole chi ci sta in compagnia: l'indizio dice solo su quale dei due sta (o su uno qualsiasi)."
      ),
    world: {
      map: TWO_ROOMS,
      rooms: ROOM_NAMES,
      seals: [
        { kind: "anubis", at: [0, 1] },
        { kind: "anubis", at: [3, 2] },
        { kind: "ra", at: [1, 0] },
      ],
      cast: { b: { at: [2, 3] }, c: { at: [4, 4] } },
    },
  },
  {
    id: "onlyOneWithProperty",
    type: "onlyOneWithProperty",
    family: "near",
    owner: "a",
    params: { property: "sittingOn", objectTypeId: "chair" },
    explain: () =>
      t(
        "Il personaggio ha una certa caratteristica (è seduto su una sedia, è un uomo, è accanto a un oggetto…) e nessun altro, in tutta la mappa, ce l'ha. Se anche una sola altra persona è su una sedia, l'indizio è falso."
      ),
    tip: () =>
      t("Con «no» diventa «non è l'unica persona…»: o il personaggio non ha quella caratteristica, o ce l'ha anche qualcun altro."),
    world: {
      map: OPEN,
      objects: [
        { type: "chair", at: [1, 1] },
        { type: "chair", at: [3, 3] },
      ],
      cast: { b: { at: [2, 2] }, c: { at: [0, 3] } },
    },
  },
  {
    id: "seated",
    type: "seated",
    family: "near",
    owner: "a",
    params: {},
    explain: () =>
      t(
        "Il personaggio è seduto: su una sedia, uno sgabello, o su qualunque altra seduta. A differenza di «si trova su un oggetto di un certo tipo», non serve dire quale. Un tappeto non è una seduta: ci si sta sopra in piedi, non ci si siede."
      ),
    world: {
      map: OPEN,
      objects: [
        { type: "chair", at: [0, 1] },
        { type: "stool", at: [2, 3] },
        { type: "carpet", at: [4, 0] },
        { type: "table", at: [1, 3] },
      ],
    },
  },
  {
    id: "inFrontOfWindow",
    type: "inFrontOfWindow",
    family: "near",
    owner: "a",
    params: {},
    explain: () =>
      t(
        "Una finestra è un pezzo di muro e separa due caselle: il personaggio è in una delle due, anche se sono in stanze diverse. Se è sul bordo della mappa (o dall'altra parte c'è una casella bloccata), vale solo la casella utilizzabile."
      ),
    tip: () =>
      t(
        "La finestra nel muro tra Cucina e Salotto vale per le due caselle ai suoi lati; quella sul bordo in alto vale solo per la sua casella."
      ),
    world: {
      map: TWO_ROOMS,
      rooms: ROOM_NAMES,
      objects: [
        { type: "window", at: [2, 2], side: "E" },
        { type: "window", at: [0, 0], side: "N" },
      ],
    },
  },
  {
    id: "between",
    type: "between",
    family: "near",
    owner: "a",
    params: { targetAId: "@o:0", targetBId: "@o:1" },
    explain: () =>
      t(
        "Il personaggio sta sulla stessa riga (o colonna) dei due bersagli, in una casella strettamente compresa tra loro. Non basta essere «da qualche parte in mezzo»: serve la linea retta. Se un bersaglio è una stanza, il personaggio sta tra quella stanza e l'altro bersaglio, mai dentro la stanza."
      ),
    world: {
      map: OPEN,
      objects: [
        { type: "lamp", at: [2, 0] },
        { type: "plant", at: [2, 4] },
      ],
    },
  },
  {
    id: "closerTo",
    type: "closerTo",
    family: "near",
    owner: "a",
    params: { targetAId: "@o:0", targetBId: "@o:1" },
    explain: () =>
      t(
        "Il personaggio è più vicino al primo bersaglio che al secondo. La distanza si conta in passi orizzontali e verticali (niente diagonali). A pari distanza l'indizio è falso."
      ),
    tip: () => t("La linea di confine passa nel mezzo: le caselle equidistanti non valgono."),
    world: {
      map: OPEN,
      objects: [
        { type: "lamp", at: [0, 0] },
        { type: "plant", at: [4, 4] },
      ],
    },
  },
  {
    id: "facing",
    type: "facing",
    family: "near",
    owner: "a",
    params: { targetId: "@o:0" },
    explain: () =>
      t("Il personaggio sta sulla stessa riga o sulla stessa colonna del bersaglio, a qualunque distanza: si «guardano» in linea retta."),
    tip: () =>
      t(
        "Con un altro personaggio come bersaglio non può mai valere: due persone non possono condividere riga o colonna. Si usa con gli oggetti."
      ),
    world: { map: OPEN, objects: [{ type: "window", at: [0, 3] }] },
  },
  {
    id: "onlyPersonNear",
    type: "onlyPersonNear",
    family: "near",
    owner: "a",
    params: { targetId: "@o:0" },
    explain: () =>
      t(
        "Il personaggio è accanto al bersaglio e nessun altro lo è: se un'altra persona fosse accanto alla lampada, l'indizio sarebbe falso."
      ),
    world: { map: OPEN, objects: [{ type: "lamp", at: [2, 2] }], cast: { b: { at: [3, 3] } } },
  },

  // ===================================================================== direction
  {
    id: "directionDistance",
    type: "directionDistance",
    family: "direction",
    owner: "a",
    params: { direction: "east", distance: 2, targetId: "@o:0" },
    explain: () =>
      t(
        "Il personaggio sta a una certa direzione rispetto al bersaglio. Con una distanza («2 colonne a est») conta solo quella colonna (o riga), qualunque sia l'altra coordinata. Senza distanza, basta stare da quella parte, a qualunque distanza."
      ),
    world: { map: OPEN, labels: true, objects: [{ type: "lamp", at: [1, 1] }] },
  },
  {
    id: "someoneAtDirectionDistance",
    type: "someoneAtDirectionDistance",
    family: "direction",
    owner: "a",
    params: { direction: "north", distance: 1 },
    explain: () =>
      t(
        "Non dice chi: dice che c'è qualcuno, a quella direzione e distanza dal personaggio. Si può restringere a chi ha una certa caratteristica (un uomo, una donna, chi è accanto a un oggetto…)."
      ),
    world: { map: OPEN, labels: true, cast: { b: { at: [1, 3] } } },
  },
  {
    id: "extremeInDirection",
    type: "extremeInDirection",
    family: "direction",
    owner: "a",
    params: { direction: "north", scope: "map" },
    explain: () =>
      t(
        "Il personaggio è quello più a nord (o sud, est, ovest) di tutti, oppure della sua stanza. Può valere solo tra chi ha una certa caratteristica. Una persona a pari altezza con lui lo rende falso."
      ),
    world: { map: OPEN, labels: true, cast: { b: { at: [2, 1] }, c: { at: [3, 3] }, d: { at: [4, 0] } } },
  },

  // ===================================================================== lines
  {
    id: "inRowOrCol",
    type: "inRowOrCol",
    family: "lines",
    owner: "a",
    params: { axis: "row", index: 3 },
    explain: () => t("Il personaggio sta nella riga o nella colonna indicata. Si conta da 1, come le etichette ai bordi della griglia."),
    world: { map: OPEN, labels: true },
  },
  {
    id: "rowOrColParity",
    type: "rowOrColParity",
    family: "lines",
    owner: "a",
    params: { axis: "col", parity: "even" },
    explain: () =>
      t("La riga o la colonna del personaggio ha un numero pari (o dispari), contando da 1 come le etichette R1, R2… e C1, C2…"),
    world: { map: OPEN, labels: true },
  },
  {
    id: "rowOrColWith",
    type: "rowOrColWith",
    family: "lines",
    owner: "a",
    params: { axis: "col", targetId: "@o:0" },
    explain: () =>
      t(
        "Il personaggio sta nella stessa riga (o colonna) del bersaglio. Con un oggetto come bersaglio è utile; con un altro personaggio non può mai valere, perché due persone non condividono riga o colonna."
      ),
    world: { map: OPEN, labels: true, objects: [{ type: "plant", at: [1, 3] }] },
  },
  {
    id: "inRowOrColWithAny",
    type: "inRowOrColWithAny",
    family: "lines",
    owner: "a",
    params: { axis: "row", targetIds: ["@o:0", "@o:1"] },
    explain: () => t("Come «condivide riga/colonna con», ma con più bersagli: basta condividerla con uno qualsiasi."),
    world: {
      map: OPEN,
      labels: true,
      objects: [
        { type: "lamp", at: [1, 0] },
        { type: "plant", at: [3, 2] },
      ],
    },
  },
  {
    id: "rowOrColAdjacentTo",
    type: "rowOrColAdjacentTo",
    family: "lines",
    owner: "a",
    params: { axis: "row", targetId: "@o:0" },
    explain: () => t("Il personaggio sta nella riga (o colonna) subito accanto a quella del bersaglio: né la stessa, né più lontana."),
    world: { map: OPEN, labels: true, objects: [{ type: "table", at: [2, 2] }] },
  },
  {
    id: "inCorner",
    type: "inCorner",
    family: "lines",
    owner: "a",
    params: {},
    explain: () => t("Il personaggio sta in uno dei quattro angoli della mappa."),
    world: { map: OPEN },
  },

  // ===================================================================== rooms
  {
    id: "inRoom",
    type: "inRoom",
    family: "rooms",
    owner: "a",
    params: { zoneId: "@z:C" },
    explain: () => t("Il personaggio si trova nella stanza indicata, in una qualsiasi delle sue caselle."),
    world: { map: FOUR_ROOMS, rooms: ROOM_NAMES },
  },
  {
    id: "sameRoomAs",
    type: "sameRoomAs",
    family: "rooms",
    owner: "a",
    params: { targetId: "@c:b" },
    explain: () =>
      t("Il personaggio è nella stessa stanza di un altro. Non importa dove, né se ci sono altre persone: conta solo la stanza."),
    world: { map: FOUR_ROOMS, rooms: ROOM_NAMES, cast: { b: { at: [1, 1] } } },
  },
  {
    id: "zoneAdjacentTo",
    type: "zoneAdjacentTo",
    family: "rooms",
    owner: "a",
    params: { zoneId: "@z:A" },
    explain: () =>
      t(
        "La stanza del personaggio confina (condivide un lato) con quella indicata. Il personaggio non può trovarsi nella stanza stessa, né in una stanza che la tocca solo di punta."
      ),
    world: { map: FOUR_ROOMS, rooms: ROOM_NAMES },
  },
  {
    id: "inRoomCorner",
    type: "inRoomCorner",
    family: "rooms",
    owner: "a",
    params: {},
    explain: () =>
      t(
        "Il personaggio sta in un angolo della sua stanza: una casella dove il perimetro della stanza gira ad angolo retto. Diverso da «in un angolo» della mappa, che riguarda solo le quattro caselle d'angolo della griglia."
      ),
    world: { map: ["AAABB", "AAABB", "AAABB", "CCCBB", "CCCBB"], rooms: () => ({ A: t("Cucina"), B: t("Salotto"), C: t("Studio") }) },
  },
  {
    id: "aloneInRoom",
    type: "aloneInRoom",
    family: "rooms",
    owner: "a",
    params: {},
    explain: () => t("Il personaggio è solo nella sua stanza: nessun altro la occupa. Si può indicare anche una stanza precisa."),
    world: { map: FOUR_ROOMS, rooms: ROOM_NAMES, cast: { b: { at: [0, 3] }, c: { at: [3, 0] } } },
  },
  {
    id: "aloneWithPerson",
    type: "aloneWithPerson",
    family: "rooms",
    owner: "a",
    params: { targetId: "@c:b" },
    explain: () => t("Il personaggio è nella stessa stanza di quella persona e con nessun altro: stanno in due, soli."),
    tip: () => t("Se anche {name} fosse in Cucina, l'indizio sarebbe falso.", { name: castName("c") }),
    world: { map: FOUR_ROOMS, rooms: ROOM_NAMES, cast: { b: { at: [1, 1] }, c: { at: [3, 4] } } },
  },
  {
    id: "aloneWithPersonProperty",
    type: "aloneWithPersonProperty",
    family: "rooms",
    owner: "a",
    params: { property: "male" },
    explain: () =>
      t(
        "Il personaggio è nella stanza con una sola altra persona, e quella persona ha una certa caratteristica (è un uomo, una donna, è seduta, accanto a un oggetto…), senza dire chi sia."
      ),
    world: { map: FOUR_ROOMS, rooms: ROOM_NAMES, cast: { b: { at: [1, 1], gender: "male" }, c: { at: [3, 4], gender: "female" } } },
  },
  {
    id: "someoneInRoomWithProperty",
    type: "someoneInRoomWithProperty",
    family: "rooms",
    owner: "a",
    params: { property: "male" },
    explain: () =>
      t(
        "Nella stanza del personaggio c'è almeno un'altra persona con quella caratteristica. A differenza di «sola con…», può esserci anche altra gente."
      ),
    world: {
      map: FOUR_ROOMS,
      rooms: ROOM_NAMES,
      cast: { b: { at: [1, 1], gender: "male" }, c: { at: [3, 3], gender: "female" }, d: { at: [4, 0], gender: "male" } },
    },
  },

  // ===================================================================== hidden roles
  {
    id: "hasRole",
    type: "hasRole",
    family: "roles",
    owner: "a",
    params: { roleId: "@r:noble" },
    board: false,
    explain: () =>
      t(
        "Il personaggio ha un certo ruolo (nobile, villico, cavaliere, fuorilegge, una mansione…). Nessuno dice i ruoli apertamente: si deducono dagli indizi, e un ruolo decide dove si può stare (le aree nobili ♛, le caselle riservate). Si può anche dire solo «ha un ruolo»."
      ),
    world: {
      map: TWO_ROOMS,
      rooms: ROOM_NAMES,
      roles: {
        defs: { noble: ["Nobile", "inNoble"], villager: ["Villico", "notInNoble"], knight: ["Cavaliere", "none"] },
        noble: ["A"],
        everyone: true,
        who: { a: "noble", b: "villager", c: "knight" },
      },
      cast: { b: { at: [1, 3] }, c: { at: [3, 2] } },
    },
  },
  {
    id: "roleDirection",
    type: "roleDirection",
    family: "roles",
    owner: "a",
    params: { direction: "north", roleId: "@r:knight" },
    explain: () =>
      t(
        "Il personaggio sta da quella parte (a nord, a sud, a est o a ovest) di tutte le altre persone con un certo ruolo: ognuna, senza eccezioni, e ce ne dev'essere almeno una."
      ),
    world: {
      map: OPEN,
      labels: true,
      roles: {
        defs: { knight: ["Cavaliere", "none"] },
        who: { a: null, b: "knight", c: "knight", d: null },
      },
      cast: { b: { at: [3, 1] }, c: { at: [4, 3] }, d: { at: [0, 4] } },
    },
  },

  {
    id: "roleOnObjectType",
    type: "roleOnObjectType",
    family: "roles",
    owner: null,
    params: { roleId: "@r:knight", objectTypeId: "carpet", quantifier: "some" },
    explain: () => t("Almeno una persona con quel ruolo sta sopra un oggetto di quel tipo (o, con «tutte», lo fanno tutte)."),
    world: {
      map: FOUR_ROOMS,
      rooms: ROOM_NAMES,
      roles: { defs: { knight: ["Cavaliere", "none"] }, who: { a: null, b: "knight", c: "knight" } },
      objects: [{ type: "carpet", at: [2, 0] }],
      cast: { a: { at: [0, 1] }, b: { at: [2, 0] }, c: { at: [3, 2] } },
    },
    falseCast: { b: [2, 3] },
  },

  {
    id: "roleAllInRoom",
    type: "roleAllInRoom",
    family: "roles",
    owner: null,
    params: { roleId: "@r:knight", zoneId: "@z:C" },
    explain: () => t("Tutte le persone con un certo ruolo, senza eccezioni, si trovano in quella stanza."),
    world: {
      map: FOUR_ROOMS,
      rooms: ROOM_NAMES,
      roles: { defs: { knight: ["Cavaliere", "none"] }, who: { a: null, b: "knight", c: "knight" } },
      cast: { a: { at: [0, 1] }, b: { at: [2, 0] }, c: { at: [3, 2] } },
    },
    falseCast: { c: [1, 4] },
  },

  // ===================================================================== sea and land
  {
    id: "inSea",
    type: "inSea",
    family: "sea",
    owner: "a",
    params: {},
    explain: () =>
      t(
        "Il personaggio è in mare: su una nave oppure nell'Acqua. Ogni nave è una stanza a sé e l'Acqua è una stanza sola, anche quando le navi la interrompono. «A terra» è il contrario: qualsiasi altro posto."
      ),
    world: {
      map: FOUR_ROOMS,
      rooms: SEA_NAMES,
      terrain: { A: "water", B: "ship", D: "ship" },
      objects: [
        { type: "shark", at: [0, 1] },
        { type: "rock", at: [3, 3] },
      ],
      cast: { b: { at: [3, 1] }, c: { at: [4, 4] } },
    },
  },
  {
    id: "onShip",
    type: "onShip",
    family: "sea",
    owner: "a",
    params: {},
    negate: true,
    explain: () =>
      t(
        "Il personaggio non sta su una nave: può essere nell'Acqua o a terra. Detto in positivo, «è su una nave» vale per qualsiasi nave, senza dire quale."
      ),
    world: {
      map: FOUR_ROOMS,
      rooms: SEA_NAMES,
      terrain: { A: "water", B: "ship", D: "ship" },
      objects: [
        { type: "raft", at: [1, 1] },
        { type: "crate", at: [4, 3] },
      ],
      cast: { b: { at: [1, 4] }, c: { at: [4, 0] } },
    },
  },

  {
    id: "inPlaceNamed",
    type: "inPlaceNamed",
    family: "sea",
    owner: "a",
    params: { placeName: "@n:A" },
    explain: () =>
      t(
        "Il personaggio sta nel luogo che ha quel nome. Sulla mappa quel luogo compare come «???»: il suo nome si deduce, e il caso si risolve con tutte le assegnazioni dei nomi che gli indizi permettono. Il personaggio sta sempre in un solo luogo: per nominarne un altro serve un altro indizio."
      ),
    world: {
      map: FOUR_ROOMS,
      rooms: ISLAND_NAMES,
      hiddenNames: ["A", "B", "C", "D"],
      cast: { b: { at: [3, 4] }, c: { at: [4, 1] } },
    },
  },

  // ===================================================================== scene (general clues)
  {
    id: "noOneInRoom",
    type: "noOneInRoom",
    family: "scene",
    owner: null,
    params: { zoneId: "@z:D" },
    explain: () => t("Nessuno, tra tutti i personaggi, si trova in quella stanza."),
    world: { map: FOUR_ROOMS, rooms: ROOM_NAMES, cast: { a: { at: [0, 1] }, b: { at: [2, 0] }, c: { at: [1, 4] } } },
    falseCast: { c: [3, 3] },
  },
  {
    id: "exactlyOneInRoom",
    type: "exactlyOneInRoom",
    family: "scene",
    owner: null,
    params: { zoneId: "@z:C" },
    explain: () => t("In quella stanza c'è una persona sola: né nessuna, né due o più."),
    world: { map: FOUR_ROOMS, rooms: ROOM_NAMES, cast: { a: { at: [0, 1] }, b: { at: [2, 0] }, c: { at: [1, 4] } } },
    falseCast: { c: [3, 2] },
  },
  {
    id: "noOneInRowOrCol",
    type: "noOneInRowOrCol",
    family: "scene",
    owner: null,
    params: { axis: "col", index: 3 },
    explain: () => t("Nessun personaggio sta nella riga o nella colonna indicata: quella linea resta vuota."),
    world: { map: OPEN, labels: true, cast: { a: { at: [0, 1] }, b: { at: [2, 0] }, c: { at: [1, 4] } } },
    falseCast: { c: [1, 2] },
  },
  {
    id: "noOneNear",
    type: "noOneNear",
    family: "scene",
    owner: null,
    params: { targetId: "@o:0" },
    explain: () => t("Nessuno sta accanto al bersaglio. Come sempre, «accanto» non include le diagonali."),
    world: { map: OPEN, objects: [{ type: "lamp", at: [2, 2] }], cast: { a: { at: [0, 0] }, b: { at: [1, 3] }, c: { at: [3, 1] } } },
    falseCast: { c: [3, 2] },
  },
  {
    id: "exactlyOneNear",
    type: "exactlyOneNear",
    family: "scene",
    owner: null,
    params: { targetId: "@o:0" },
    explain: () => t("Una sola persona sta accanto al bersaglio: né nessuna, né due o più."),
    world: { map: OPEN, objects: [{ type: "plant", at: [2, 2] }], cast: { a: { at: [1, 2] }, b: { at: [0, 0] }, c: { at: [4, 4] } } },
    falseCast: { b: [2, 1] },
  },
  {
    id: "peopleNear",
    type: "peopleNear",
    family: "scene",
    owner: null,
    params: { count: 2, targetId: "@o:0", together: "any" },
    explain: () =>
      t(
        "Esattamente due persone stanno accanto al bersaglio: né una sola, né di più. Se il bersaglio è un tipo di oggetto (un tavolo) vale uno qualsiasi, oppure lo stesso per tutte se lo scegli."
      ),
    world: {
      map: OPEN,
      objects: [{ type: "table", at: [2, 2] }],
      cast: { a: { at: [1, 2] }, b: { at: [2, 3] }, c: { at: [4, 4] } },
    },
    falseCast: { b: [0, 0] },
  },
  {
    id: "everyObjectTypeNear",
    type: "everyObjectTypeNear",
    family: "scene",
    owner: null,
    params: {},
    explain: () =>
      t(
        "Per ogni tipo di oggetto che c'è sulla mappa (un tavolo, una pianta, un animale…) almeno una persona sta accanto a uno di quel tipo. Porte e finestre non contano."
      ),
    world: {
      map: OPEN,
      objects: [
        { type: "table", at: [2, 2] },
        { type: "plant", at: [0, 4] },
      ],
      cast: { a: { at: [2, 3] }, b: { at: [1, 4] }, c: { at: [4, 0] } },
    },
    falseCast: { b: [0, 1] },
  },
  {
    id: "sameRoomTogether",
    type: "sameRoomTogether",
    family: "scene",
    owner: null,
    params: { targetAId: "@c:a", targetBId: "@c:b" },
    explain: () => t("Due persone precise si trovano nella stessa stanza (il resto della scena non importa)."),
    world: { map: FOUR_ROOMS, rooms: ROOM_NAMES, cast: { a: { at: [0, 1] }, b: { at: [1, 0] }, c: { at: [3, 3] } } },
    falseCast: { b: [2, 2] },
  },
  {
    id: "roomsWithStateCount",
    type: "roomsWithStateCount",
    family: "scene",
    owner: null,
    params: { count: 1, state: "empty" },
    explain: () => t("Un certo numero di stanze sono vuote (oppure occupate): si contano le stanze, non le persone."),
    world: { map: FOUR_ROOMS, rooms: ROOM_NAMES, cast: { a: { at: [0, 1] }, b: { at: [2, 0] }, c: { at: [1, 4] } } },
    falseCast: { b: [1, 0], c: [3, 3] },
  },
  {
    id: "emptyRoomsSameSize",
    type: "emptyRoomsSameSize",
    family: "scene",
    owner: null,
    params: { count: 2 },
    explain: () => t("Le stanze vuote sono esattamente quel numero, e hanno tutte lo stesso numero di caselle."),
    tip: () => t("Qui Cucina e Bagno hanno 6 caselle ciascuna; Salotto ne ha 4 e Studio 9."),
    world: { map: FOUR_ROOMS, rooms: ROOM_NAMES, cast: { a: { at: [0, 3] }, b: { at: [2, 1] }, c: { at: [3, 0] } } },
    falseCast: { a: [0, 1], b: [3, 3], c: [4, 4] },
  },
  {
    id: "sameRoomSizeAs",
    type: "sameRoomSizeAs",
    family: "scene",
    owner: null,
    params: { targetAId: "@c:a", targetBId: "@c:b" },
    explain: () => t("Le stanze in cui si trovano due persone hanno lo stesso numero di caselle (possono anche essere la stessa stanza)."),
    tip: () => t("Cucina e Bagno hanno 6 caselle; Salotto ne ha 4."),
    world: { map: FOUR_ROOMS, rooms: ROOM_NAMES, cast: { a: { at: [0, 1] }, b: { at: [3, 3] }, c: { at: [2, 0] } } },
    falseCast: { b: [1, 4] },
  },
  {
    id: "noOneWithProperty",
    type: "noOneWithProperty",
    family: "scene",
    owner: null,
    params: { property: "sittingOn", objectTypeId: "chair", onlyGender: "female", zoneId: "@z:A" },
    explain: () =>
      t(
        "Nessuno, in tutta la mappa o in una stanza precisa, ha quella caratteristica (seduto, accanto a un oggetto…). Si può restringere a uomini o a donne."
      ),
    world: {
      map: FOUR_ROOMS,
      rooms: ROOM_NAMES,
      objects: [{ type: "chair", at: [0, 1] }],
      cast: { a: { at: [2, 0], gender: "female" }, b: { at: [0, 1], gender: "male" }, c: { at: [1, 4], gender: "female" } },
    },
    falseCast: { a: [0, 1], b: [2, 0] },
  },

  // ===================================================================== trains and skyscrapers
  {
    id: "wagons-rule",
    family: "floors",
    title: () => t("Il treno: vagoni affiancati"),
    owner: "a",
    type: null,
    params: {},
    explain: () =>
      t(
        "In un caso a treno la mappa è divisa in vagoni, uno accanto all'altro. Le colonne sono numerate da un vagone all'altro (C1…C6) e ognuna ha una sola persona; le righe si ripetono in ogni vagone (R1…R4) e in ciascun vagone c'è al massimo una persona per riga."
      ),
    tip: () =>
      t(
        "La riga R3 del primo vagone resta libera anche se un'altra persona sta nella R3 del secondo: sono due righe diverse. Un ruolo può valere «uno solo per vagone o piano»."
      ),
    world: { map: TWO_WAGONS, labels: true, wagons: { names: WAGON_NAMES, sizes: [3, 3] }, cast: { b: { at: [0, 1] }, c: { at: [2, 4] } } },
  },
  {
    id: "floors-rule",
    family: "floors",
    title: () => t("Il grattacielo: piani impilati"),
    owner: "a",
    type: null,
    params: {},
    explain: () =>
      t(
        "Ogni piano è una mappa con le sue righe e colonne (R1, R2… e C1, C2… in ciascun piano). Le persone si dispongono come in un cubo: al massimo una per riga, una per colonna di ogni piano e una per «pilastro», cioè la stessa casella (stessa riga e colonna) su tutti i piani."
      ),
    tip: () => t("Le caselle sopra e sotto una persona, nella stessa posizione degli altri piani, sono escluse per tutti."),
    world: { map: THREE_FLOORS, floors: { names: FLOOR_NAMES, sizes: [2, 2, 2] }, cast: { b: { at: [0, 1] }, c: { at: [3, 2] } } },
  },
  {
    id: "sameFloor",
    type: "sameFloor",
    family: "floors",
    owner: "a",
    params: { targetId: "@c:b" },
    explain: () =>
      t(
        "Il caso è un grattacielo: più piani impilati. Questo indizio dice che le due persone sono sullo stesso piano (dove, in quel piano, non importa)."
      ),
    tip: () =>
      t("In un grattacielo c'è al massimo una persona per riga, per colonna e anche in verticale: stessa casella di piani diversi."),
    world: { map: THREE_FLOORS, floors: { names: FLOOR_NAMES, sizes: [2, 2, 2] }, cast: { b: { at: [0, 1] } } },
  },
  {
    id: "floorOrder",
    type: "floorOrder",
    family: "floors",
    owner: "a",
    params: { relation: "higher", targetId: "@c:b" },
    explain: () =>
      t(
        "Confronta il piano di due persone: più in alto, più in basso, oppure subito sopra o subito sotto (il piano vicino). Il piano più in alto è il primo della lista."
      ),
    world: { map: THREE_FLOORS, floors: { names: FLOOR_NAMES, sizes: [2, 2, 2] }, cast: { b: { at: [2, 1] } } },
  },
  {
    id: "onFloor",
    type: "onFloor",
    family: "floors",
    owner: "a",
    params: { floorId: "@f:2" },
    explain: () => t("La persona è in un piano preciso, scelto per nome."),
    world: { map: THREE_FLOORS, floors: { names: FLOOR_NAMES, sizes: [2, 2, 2] }, cast: { b: { at: [0, 0] }, c: { at: [3, 2] } } },
  },
  {
    id: "floors-lift",
    type: "adjacent",
    family: "floors",
    title: () => t("Accanto all'ascensore"),
    owner: "a",
    params: { targetId: "@t:elevator" },
    explain: () =>
      t(
        "L'ascensore è un pozzo che attraversa tutti i piani, sempre nella stessa casella (stessa riga e stessa colonna di ciascun piano). Chi sta sull'ascensore di un piano è accanto all'ascensore di tutti gli altri piani; su ogni piano è accanto all'ascensore anche chi sta in una casella vicina."
      ),
    tip: () => t("In un pozzo c'è al massimo una persona, e fra piani diversi non si è mai vicini senza ascensore o scale."),
    world: { map: THREE_FLOORS, floors: { names: FLOOR_NAMES, sizes: [2, 2, 2] }, ways: { lift: [1, 2] }, cast: { b: { at: [0, 0] } } },
  },
  {
    id: "floors-stairs",
    type: "adjacent",
    family: "floors",
    title: () => t("Accanto alle scale"),
    owner: "a",
    params: { targetId: "@t:stairs" },
    explain: () =>
      t(
        "Le scale collegano una casella di un piano a una casella del piano sopra o sotto. Chi sta su un'estremità è accanto all'altra estremità; in ogni piano è accanto alle scale anche chi sta in una casella vicina."
      ),
    world: {
      map: THREE_FLOORS,
      floors: { names: FLOOR_NAMES, sizes: [2, 2, 2] },
      ways: {
        stairs: [
          [1, 0],
          [2, 2],
        ],
      },
      cast: { b: { at: [4, 1] } },
    },
  },
  {
    id: "floors-extreme-all",
    type: "extremeInDirection",
    family: "floors",
    title: () => t("Il più a nord di tutti i piani"),
    owner: "a",
    params: { direction: "north", scope: "map" },
    explain: () =>
      t(
        "Con «su tutta la mappa» si confrontano tutti i piani: la riga di ciascun piano (la prima è la più a nord) e le colonne. Chi ha la stessa riga in un altro piano è pari: l'indizio è falso. Lo stesso confronto vale per «a nord di tutti i…» di un ruolo."
      ),
    world: {
      map: THREE_FLOORS,
      labels: true,
      floors: { names: FLOOR_NAMES, sizes: [2, 2, 2] },
      cast: { b: { at: [3, 1] }, c: { at: [5, 0] } },
    },
  },
  {
    id: "floors-extreme-own",
    type: "extremeInDirection",
    family: "floors",
    title: () => t("Il più a nord del suo piano"),
    owner: "a",
    params: { direction: "north", scope: "floor" },
    explain: () => t("Con «nel suo piano» si guardano solo le persone dello stesso piano: negli altri piani nessuno conta."),
    world: {
      map: THREE_FLOORS,
      labels: true,
      floors: { names: FLOOR_NAMES, sizes: [2, 2, 2] },
      cast: { b: { at: [3, 1] }, c: { at: [4, 0] } },
    },
  },
  {
    id: "floors-row",
    type: "inRowOrCol",
    family: "floors",
    title: () => t("Riga e colonna in ogni piano"),
    owner: "a",
    params: { axis: "row", index: 2 },
    explain: () =>
      t(
        "In un grattacielo ogni piano ha le sue righe e colonne: «riga 2» è la seconda riga di ciascun piano, «colonna 3» la terza colonna di ciascun piano. Lo stesso vale per pari e dispari."
      ),
    world: { map: THREE_FLOORS, labels: true, floors: { names: FLOOR_NAMES, sizes: [2, 2, 2] }, cast: { b: { at: [0, 0] } } },
  },

  // ===================================================================== logic
  {
    id: "orClue",
    type: "orClue",
    family: "logic",
    owner: "a",
    params: { a: { type: "adjacent", params: { targetId: "@o:0" } }, b: { type: "inRoom", params: { zoneId: "@z:C" } } },
    explain: () =>
      t(
        "Due indizi qualsiasi uniti da un «oppure»: basta che sia vero uno dei due (o entrambi). Si sceglie il tipo e i parametri di ciascuno, come per un indizio normale."
      ),
    world: { map: FOUR_ROOMS, rooms: ROOM_NAMES, objects: [{ type: "plant", at: [0, 1] }] },
  },
];

// --- building a world and judging a clue -------------------------------------------

export function resolveRefs(value, ctx) {
  if (Array.isArray(value)) return value.map((v) => resolveRefs(v, ctx));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolveRefs(v, ctx)]));
  if (typeof value !== "string" || value[0] !== "@") return value;
  const [kind, id] = value.slice(1).split(":");
  if (kind === "c") return ctx.characters[id].id;
  if (kind === "o") return ctx.objects[Number(id)].id;
  if (kind === "z") return ctx.zones[id].id;
  if (kind === "t") return objectTypeTargetId(id);
  if (kind === "r") return ctx.roles[id].id;
  if (kind === "f") return ctx.grid.sectors[Number(id)].id; // a floor of a skyscraper, by its place in the list (the highest first)
  if (kind === "n") return ctx.zones[id].name; // the real name of a room whose name is hidden
  throw new Error(`riferimento sconosciuto ${value}`);
}

// A world ({ map, rooms, objects, cast }) as a real little puzzle: the grid with its rooms and objects, and the characters of
// the cast (the owner first, if any). Pure: no DOM. Used by the clue examples (buildExample) and by the reasoning examples
// (reasoning.js).
export function buildWorld(world, ownerKey = null) {
  const rows = world.map.length;
  const cols = world.map[0].length;
  const puzzle = createPuzzle("Glossario");
  puzzle.grid = createGrid(rows, cols);
  const grid = puzzle.grid;

  const zones = {};
  const names = world.rooms ? world.rooms() : {};
  for (const letter of new Set(world.map.join("").replace(/[.#]/g, ""))) {
    zones[letter] = addZone(grid, names[letter] || letter, "#f4c2c2");
  }
  world.map.forEach((line, r) => {
    [...line].forEach((ch, c) => {
      if (ch === "#") grid.cells[r][c].blocked = true;
      else if (zones[ch]) paintCellZone(grid, r, c, zones[ch].id);
    });
  });
  // Distinct, readable room colors (the board paints them as sheets of paper).
  const palette = ["#f4c2c2", "#c2e0f4", "#c9f4c2", "#f4ecc2", "#e0c2f4", "#f4d3c2"];
  Object.values(zones).forEach((z, i) => {
    z.color = palette[i % palette.length];
  });

  // A skyscraper: { sizes: [2, 2, 2], names: () => [...] } cuts the grid into floors (see model/sectors.js).
  if (world.floors) setSectors(grid, world.floors.sizes, world.floors.names(), "row");
  // A train: { sizes: [3, 3], names } cuts the grid into wagons side by side.
  if (world.wagons) setSectors(grid, world.wagons.sizes, world.wagons.names(), "col");
  // The ways of a skyscraper: { lift: [row, col] } (a shaft through every floor), { stairs: [[row, col], [row, col]] }.
  if (world.ways?.lift) placeElevator(grid, ...world.ways.lift);
  if (world.ways?.stairs) {
    const [from, to] = world.ways.stairs;
    placeStairs(grid, { row: from[0], col: from[1] }, { row: to[0], col: to[1] });
  }

  const objects = (world.objects || []).map((o) => placeObject(grid, o.type, o.at[0], o.at[1], o.side));
  for (const seal of world.seals || []) setSeal(grid, seal.at[0], seal.at[1], seal.kind);

  // Characters: the owner first (if any), then the rest of the cast in key order.
  const characters = {};
  const cast = world.cast || {};
  const keys = [...(ownerKey ? [ownerKey] : []), ...Object.keys(cast).filter((k) => k !== ownerKey)];
  for (const key of keys) {
    const base = CAST[key];
    const character = addCharacter(puzzle, t(base.name), base.icon, !!cast[key]?.victim);
    if (cast[key]?.gender) character.gender = cast[key].gender;
    characters[key] = character;
  }
  // Places whose name is to be deduced: ["A", "D"] by room letter.
  for (const letter of world.hiddenNames || []) setZoneNameHidden(grid, zones[letter].id, true);
  // Sea and land: { A: "water", B: "ship" } by room letter.
  for (const [letter, kind] of Object.entries(world.terrain || {})) setZoneTerrain(grid, zones[letter].id, kind);
  // Hidden roles: { defs: { key: [name, rule] }, noble: ["A"] (rooms), who: { a: "key" } (the cast's roles), everyone, counts: { key: n } }
  const roles = {};
  if (world.roles) {
    for (const [key, [name, rule]] of Object.entries(world.roles.defs)) roles[key] = addRole(puzzle, t(name), rule);
    for (const letter of world.roles.noble || []) setZoneNoble(grid, zones[letter].id, true);
    if (world.roles.everyone) setEveryoneHasRole(puzzle, true);
    for (const [key, n] of Object.entries(world.roles.counts || {})) setRoleCount(puzzle, roles[key].id, n);
    puzzle.solution.roles = {};
    for (const [castKey, roleKey] of Object.entries(world.roles.who || {})) {
      if (characters[castKey]) puzzle.solution.roles[characters[castKey].id] = roleKey ? roles[roleKey].id : null;
    }
  }
  return { puzzle, grid, zones, objects, characters, cast, roles };
}

// Turns an entry into { puzzle, clue, owner, fixed, layouts… }. Pure: no DOM.
export function buildExample(entry) {
  const built0 = buildWorld(entry.world, entry.owner);
  const { puzzle, grid, zones, objects, characters, cast } = built0;

  const ctx = { characters, objects, zones, roles: built0.roles, grid };
  const params = resolveRefs(entry.paramsOverride ? { ...entry.params, ...entry.paramsOverride } : entry.params, ctx);
  const clue = entry.type
    ? { id: "glossary", characterId: entry.owner ? characters[entry.owner].id : null, type: entry.type, params, negate: !!entry.negate }
    : null;

  const positions = (castSpec) => {
    const map = new Map();
    for (const [key, spec] of Object.entries(castSpec)) {
      const at = Array.isArray(spec) ? spec : spec?.at;
      if (at && characters[key]) map.set(characters[key].id, { row: at[0], col: at[1] });
    }
    return map;
  };
  const trueFixed = positions(cast);
  const falseSpec = { ...cast };
  for (const [key, at] of Object.entries(entry.falseCast || {})) falseSpec[key] = { ...(cast[key] || {}), at };
  const falseFixed = positions(falseSpec);

  return {
    entry,
    puzzle,
    grid,
    clue,
    characters,
    objects,
    zones,
    trueFixed,
    falseFixed,
    ownerId: entry.owner ? characters[entry.owner].id : null,
  };
}

// For a clue about Anna: every cell classified as "ok" (the clue holds if she
// stands there), "rule" (ruled out by the one-per-row/column rule because of
// the people already placed), or "no" (the clue fails there).
export function evaluateCells(built) {
  const { puzzle, grid, clue, ownerId, trueFixed } = built;
  const predicate = clue ? buildPredicate(clue, withDeclared(puzzle)) : () => true;
  const taken = lineTracker(grid, [...trueFixed.values()]);
  const out = [];
  for (let r = 0; r < grid.size.rows; r++) {
    for (let c = 0; c < grid.size.cols; c++) {
      if (!isOccupiable(grid, r, c)) {
        out.push({ row: r, col: c, status: "none" });
        continue;
      }
      if (taken.has(r, c)) {
        out.push({ row: r, col: c, status: "rule" });
        continue;
      }
      const pm = new Map(trueFixed);
      pm.set(ownerId, { row: r, col: c });
      out.push({ row: r, col: c, status: predicate(pm, true) === true ? "ok" : "no" });
    }
  }
  return out;
}

// For a general clue: does it hold in the true arrangement, and in the false one?
export function evaluateGeneral(built) {
  const predicate = buildPredicate(built.clue, withDeclared(built.puzzle));
  return { trueHolds: predicate(built.trueFixed, true), falseHolds: predicate(built.falseFixed, true) };
}

// The cells a clue "points at" (its bersagli), for the dashed marker.
export function targetCells(built, placements = built.trueFixed) {
  if (!built.clue) return [];
  try {
    return resolveClueHoverCells(built.clue, built.puzzle, placements);
  } catch {
    return [];
  }
}

// «Anna: È accanto a una pianta.»
export function exampleSentence(built) {
  if (!built.clue) return null;
  const text = describeClue(built.clue, built.puzzle);
  const owner = built.ownerId ? built.puzzle.characters.find((c) => c.id === built.ownerId) : null;
  return owner ? `${owner.name}: ${text}` : text;
}
