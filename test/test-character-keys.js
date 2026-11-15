// The keys that pick a character (player/characterKeys.js): 1-9 and 0 for the 1st
// to the 10th, [ ] (or , .) to step through all of them (up to 16).
import { characterKey, characterIndexForKey, stepForKey, steppedCharacter, CHARACTER_KEYS } from "../src/player/characterKeys.js";
import { assert, assertEqual } from "./assert.js";

const cast = (n) => Array.from({ length: n }, (_, i) => ({ id: `c${i}` }));

export const tests = [
  {
    name: "tasti dei personaggi: 1-9 per i primi nove, 0 per il decimo, nessuno dall'undicesimo",
    fn: () => {
      assertEqual(CHARACTER_KEYS.join(""), "1234567890");
      assertEqual(characterKey(0), "1");
      assertEqual(characterKey(8), "9");
      assertEqual(characterKey(9), "0");
      assertEqual(characterKey(10), null, "l'undicesimo si raggiunge con [ e ]");
      assertEqual(characterKey(15), null);
      assertEqual(characterIndexForKey("1"), 0);
      assertEqual(characterIndexForKey("9"), 8);
      assertEqual(characterIndexForKey("0"), 9);
      assertEqual(characterIndexForKey("a"), null);
      assertEqual(characterIndexForKey("x"), null, "x segna, non sceglie un personaggio");
    },
  },
  {
    name: "tasti dei personaggi: [ e , vanno al precedente, ] e . al successivo, gli altri tasti non fanno niente",
    fn: () => {
      assertEqual(stepForKey("["), -1);
      assertEqual(stepForKey(","), -1);
      assertEqual(stepForKey("]"), 1);
      assertEqual(stepForKey("."), 1);
      for (const key of ["1", "0", "x", "e", "u", "h", "a", "Enter"]) assertEqual(stepForKey(key), 0, key);
    },
  },
  {
    name: "tasti dei personaggi: il passo scorre in cerchio tra tutti i personaggi, fino a 16",
    fn: () => {
      const sixteen = cast(16);
      assertEqual(steppedCharacter(sixteen, "c3", 1).id, "c4");
      assertEqual(steppedCharacter(sixteen, "c3", -1).id, "c2");
      assertEqual(steppedCharacter(sixteen, "c15", 1).id, "c0", "dopo l'ultimo si torna al primo");
      assertEqual(steppedCharacter(sixteen, "c0", -1).id, "c15", "prima del primo si va all'ultimo");
      assertEqual(steppedCharacter(sixteen, null, 1).id, "c0", "senza selezione, ] dà il primo");
      assertEqual(steppedCharacter(sixteen, null, -1).id, "c15", "senza selezione, [ dà l'ultimo");
      assertEqual(steppedCharacter(sixteen, "non-esiste", 1).id, "c0");
      assertEqual(steppedCharacter([], null, 1), null, "nessun personaggio");
      // tutti i 16 si raggiungono a partire dal primo
      let current = sixteen[0];
      const seen = new Set([current.id]);
      for (let i = 0; i < 15; i++) {
        current = steppedCharacter(sixteen, current.id, 1);
        seen.add(current.id);
      }
      assert(seen.size === 16, "con ] si passano tutti e 16");
    },
  },
];
