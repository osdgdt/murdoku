import {
  createCampaign,
  addCase,
  removeCase,
  reorderCases,
  validateCampaignShape,
  setClueUnlock,
  clueUnlockOf,
  lockedClueIds,
  applyClueLocks,
  unlocksProvidedBy,
  setCaseStory,
  caseStoryOf,
  setFinale,
  finaleOf,
  isCampaignComplete,
  splitParagraphs,
  STORY_TEXT_MAX,
  STORY_LABEL_MAX,
} from "../src/campaign/campaignModel.js";
import { buildTutorialCase } from "../src/tutorial/tutorialCase.js";
import { checkUniqueness } from "../src/solver/validator.js";
import { assert, assertEqual } from "./assert.js";

function buildCampaignWithCases(n) {
  const campaign = createCampaign("Test", "Una campagna di prova");
  for (let i = 0; i < n; i++) {
    addCase(campaign, { puzzleId: `puzzle_${i}`, puzzleUrl: `caso-${i}.murdoku.json`, label: `Caso ${i}` });
  }
  return campaign;
}

export const tests = [
  {
    name: "createCampaign inizializza id, titolo, descrizione e un elenco casi vuoto",
    fn: () => {
      const campaign = createCampaign("La mia campagna", "Descrizione");
      assert(!!campaign.id, "deve avere un id");
      assertEqual(campaign.title, "La mia campagna");
      assertEqual(campaign.description, "Descrizione");
      assertEqual(campaign.cases.length, 0);
      assertEqual(campaign.schemaVersion, 1);
    },
  },
  {
    name: "addCase aggiunge un caso in coda con un id proprio",
    fn: () => {
      const campaign = createCampaign();
      const c1 = addCase(campaign, { puzzleId: "p1", puzzleUrl: "a.murdoku.json", label: "Primo" });
      const c2 = addCase(campaign, { puzzleId: "p2", puzzleUrl: "b.murdoku.json", label: "Secondo" });
      assertEqual(campaign.cases.length, 2);
      assertEqual(campaign.cases[0].id, c1.id);
      assertEqual(campaign.cases[1].id, c2.id);
      assert(c1.id !== c2.id, "i due casi devono avere id distinti");
    },
  },
  {
    name: "removeCase rimuove solo il caso indicato, lasciando invariato l'ordine degli altri",
    fn: () => {
      const campaign = buildCampaignWithCases(3);
      const middleId = campaign.cases[1].id;
      removeCase(campaign, middleId);
      assertEqual(campaign.cases.length, 2);
      assert(!campaign.cases.some((c) => c.id === middleId), "il caso rimosso non deve più esserci");
      assertEqual(campaign.cases[0].label, "Caso 0");
      assertEqual(campaign.cases[1].label, "Caso 2");
    },
  },
  {
    name: "reorderCases sposta un caso da un indice all'altro",
    fn: () => {
      const campaign = buildCampaignWithCases(3);
      reorderCases(campaign, 0, 2);
      assertEqual(campaign.cases.map((c) => c.label).join(","), "Caso 1,Caso 2,Caso 0");
    },
  },
  {
    name: "reorderCases con un indice fuori range non tocca l'elenco",
    fn: () => {
      const campaign = buildCampaignWithCases(2);
      const before = campaign.cases.map((c) => c.label).join(",");
      reorderCases(campaign, 0, 5);
      reorderCases(campaign, -1, 1);
      assertEqual(campaign.cases.map((c) => c.label).join(","), before);
    },
  },
  {
    name: "validateCampaignShape: una campagna valida passa",
    fn: () => {
      const campaign = buildCampaignWithCases(2);
      const { valid, errors } = validateCampaignShape(campaign);
      assert(valid, "atteso valido: " + errors.join(", "));
    },
  },
  {
    name: "validateCampaignShape: rifiuta una campagna senza titolo",
    fn: () => {
      const campaign = buildCampaignWithCases(1);
      campaign.title = "";
      const { valid, errors } = validateCampaignShape(campaign);
      assert(!valid, "atteso non valido");
      assert(
        errors.some((e) => e.includes("titolo")),
        "errore atteso sul titolo mancante"
      );
    },
  },
  {
    name: "validateCampaignShape: rifiuta un caso senza puzzleUrl",
    fn: () => {
      const campaign = createCampaign("Test");
      campaign.cases.push({ id: "case_1", puzzleId: "p1", puzzleUrl: "", label: "Rotto" });
      const { valid, errors } = validateCampaignShape(campaign);
      assert(!valid, "atteso non valido");
      assert(
        errors.some((e) => e.includes("URL")),
        "errore atteso sull'URL mancante"
      );
    },
  },
  {
    name: "validateCampaignShape: rifiuta id caso duplicati",
    fn: () => {
      const campaign = buildCampaignWithCases(1);
      campaign.cases.push({ ...campaign.cases[0] });
      const { valid, errors } = validateCampaignShape(campaign);
      assert(!valid, "atteso non valido");
      assert(
        errors.some((e) => e.includes("duplicato")),
        "errore atteso sull'id duplicato"
      );
    },
  },
  {
    name: "validateCampaignShape: rifiuta un valore che non è un oggetto",
    fn: () => {
      let result = validateCampaignShape(null);
      assert(!result.valid);
      assert(result.errors.some((e) => e.includes("oggetto valido")));
      result = validateCampaignShape("non una campagna");
      assert(!result.valid);
    },
  },
  {
    name: "validateCampaignShape: rifiuta una campagna il cui campo cases non è un array",
    fn: () => {
      const campaign = createCampaign("Test");
      campaign.cases = "non un array";
      const { valid, errors } = validateCampaignShape(campaign);
      assert(!valid);
      assert(errors.some((e) => e.includes("elenco dei casi")));
    },
  },
  {
    name: "addCase, removeCase e reorderCases aggiornano updatedAt tramite touch()",
    fn: () => {
      const campaign = buildCampaignWithCases(2);
      campaign.updatedAt = 0;
      addCase(campaign, { puzzleId: "p3", puzzleUrl: "c.murdoku.json", label: "Terzo" });
      assert(campaign.updatedAt > 0);
      campaign.updatedAt = 0;
      removeCase(campaign, campaign.cases[0].id);
      assert(campaign.updatedAt > 0);
      campaign.updatedAt = 0;
      reorderCases(campaign, 0, 1);
      assert(campaign.updatedAt > 0);
    },
  },
  {
    name: "indizi nascosti: setClueUnlock imposta e toglie la regola, senza lasciare campi vuoti (Firestore rifiuta undefined)",
    fn: () => {
      const campaign = buildCampaignWithCases(3);
      const [a, , c] = campaign.cases;
      setClueUnlock(campaign, c.id, "clue_x", a.id);
      assertEqual(c.clueUnlocks.clue_x, a.id);
      setClueUnlock(campaign, c.id, "clue_x", null);
      assert(!("clueUnlocks" in c), "la mappa vuota sparisce del tutto");
      assert(!JSON.stringify(c).includes("undefined"));
    },
  },
  {
    name: "indizi nascosti: restano nascosti finché non si completa il caso che li rivela",
    fn: () => {
      const campaign = buildCampaignWithCases(3);
      const [a, b, c] = campaign.cases;
      setClueUnlock(campaign, c.id, "k1", a.id);
      setClueUnlock(campaign, c.id, "k2", b.id);
      assertEqual([...lockedClueIds(campaign, c.id, [])].sort().join(","), "k1,k2");
      assertEqual([...lockedClueIds(campaign, c.id, [a.id])].join(","), "k2");
      assertEqual(lockedClueIds(campaign, c.id, [a.id, b.id]).size, 0);
      assertEqual(lockedClueIds(campaign, a.id, []).size, 0, "un caso senza regole non nasconde nulla");
    },
  },
  {
    name: "indizi nascosti: una regola che non può mai avverarsi (caso dopo, o inesistente) viene ignorata, mai un caso irrisolvibile",
    fn: () => {
      const campaign = buildCampaignWithCases(3);
      const [a, b, c] = campaign.cases;
      setClueUnlock(campaign, a.id, "k1", c.id); // reveals from a LATER case
      setClueUnlock(campaign, b.id, "k2", "case_that_does_not_exist");
      setClueUnlock(campaign, c.id, "k3", c.id); // from itself
      assertEqual(lockedClueIds(campaign, a.id, []).size, 0);
      assertEqual(lockedClueIds(campaign, b.id, []).size, 0);
      assertEqual(lockedClueIds(campaign, c.id, []).size, 0);
      assertEqual(clueUnlockOf(campaign, a.id, "k1").valid, false, "l'editor può segnalarla");
      // reordering can break a good rule: the clue is then shown
      setClueUnlock(campaign, c.id, "k4", a.id);
      assertEqual(lockedClueIds(campaign, c.id, []).has("k4"), true);
      reorderCases(campaign, 0, 2); // a is now last
      assertEqual(lockedClueIds(campaign, c.id, []).has("k4"), false);
    },
  },
  {
    name: "indizi nascosti: eliminando il caso che li rivela gli indizi tornano visibili",
    fn: () => {
      const campaign = buildCampaignWithCases(3);
      const [a, , c] = campaign.cases;
      setClueUnlock(campaign, c.id, "k1", a.id);
      removeCase(campaign, a.id);
      assert(!campaign.cases.some((x) => x.clueUnlocks), "nessuna regola orfana");
    },
  },
  {
    name: "indizi nascosti: applyClueLocks toglie gli indizi dal caso visibile, lascia un segnaposto senza testo e tiene il caso completo per la verifica",
    fn: () => {
      const built = buildTutorialCase();
      const campaign = buildCampaignWithCases(2);
      const [first, second] = campaign.cases;
      const hidden = built.puzzle.clues.find((cl) => cl.characterId === built.suspects[0].id);
      setClueUnlock(campaign, second.id, hidden.id, first.id);

      const before = applyClueLocks(built.puzzle, campaign, second.id, []);
      assertEqual(before.puzzle.clues.length, built.puzzle.clues.length - 1);
      assert(!before.puzzle.clues.some((cl) => cl.id === hidden.id), "l'indizio nascosto non è tra quelli visibili");
      assertEqual(before.puzzle.lockedClues.length, 1);
      assertEqual(before.puzzle.lockedClues[0].characterId, built.suspects[0].id);
      assertEqual(before.puzzle.lockedClues[0].byLabel, first.label);
      assert(!JSON.stringify(before.puzzle.lockedClues).includes(hidden.type), "il segnaposto non rivela l'indizio");
      assertEqual(before.answerPuzzle.clues.length, built.puzzle.clues.length, "la verifica usa il caso completo");
      assert(!("lockedClues" in before.answerPuzzle));

      // Why the answer key needs the complete case: without the hidden clue the solution is no longer unique.
      assertEqual(checkUniqueness(before.answerPuzzle, { maxSolutions: 3, forwardCheck: true }).solutionCount, 1);
      assert(
        checkUniqueness(before.puzzle, { maxSolutions: 3, forwardCheck: true }).solutionCount > 1,
        "senza l'indizio le soluzioni sono più di una"
      );

      const after = applyClueLocks(built.puzzle, campaign, second.id, [first.id]);
      assertEqual(after.puzzle.clues.length, built.puzzle.clues.length, "dopo aver risolto il caso, l'indizio c'è");
      assert(!after.puzzle.lockedClues, "nessun segnaposto");
    },
  },
  {
    name: "indizi nascosti: unlocksProvidedBy conta gli indizi che un caso rivela negli altri",
    fn: () => {
      const campaign = buildCampaignWithCases(4);
      const [a, b, c, d] = campaign.cases;
      setClueUnlock(campaign, d.id, "k1", a.id);
      setClueUnlock(campaign, d.id, "k2", a.id);
      setClueUnlock(campaign, c.id, "k3", a.id);
      setClueUnlock(campaign, d.id, "k4", b.id);
      const fromA = unlocksProvidedBy(campaign, a.id);
      assertEqual(fromA.map((x) => `${x.caseEntry.id === c.id ? "c" : "d"}${x.count}`).join(","), "c1,d2");
      assertEqual(unlocksProvidedBy(campaign, d.id).length, 0);
    },
  },
  {
    name: "indizi nascosti: validateCampaignShape rifiuta una mappa degli indizi malformata",
    fn: () => {
      const campaign = buildCampaignWithCases(2);
      campaign.cases[1].clueUnlocks = ["k1"];
      assert(!validateCampaignShape(campaign).valid, "un array non è una mappa");
      campaign.cases[1].clueUnlocks = { k1: 5 };
      assert(!validateCampaignShape(campaign).valid, "i valori devono essere id di caso");
      campaign.cases[1].clueUnlocks = { k1: campaign.cases[0].id };
      assert(validateCampaignShape(campaign).valid);
    },
  },
  {
    name: "storia: setCaseStory salva introduzione ed epilogo ripuliti, e un testo vuoto toglie il campo (Firestore non ammette undefined)",
    fn: () => {
      const campaign = buildCampaignWithCases(2);
      const [a, b] = campaign.cases;
      assertEqual(caseStoryOf(a).intro, "", "un caso vecchio non ha testi");
      setCaseStory(campaign, a.id, { intro: "  Era una notte buia.  ", outro: "Fine." });
      assertEqual(a.intro, "Era una notte buia.");
      assertEqual(caseStoryOf(a).outro, "Fine.");
      assert(!("intro" in b) && !("outro" in b), "gli altri casi non cambiano");
      setCaseStory(campaign, a.id, { intro: "   " });
      assert(!("intro" in a), "un testo vuoto toglie il campo");
      assertEqual(a.outro, "Fine.", "l'epilogo non cambia se non viene passato");
      setCaseStory(campaign, a.id, { outro: "" });
      assert(!JSON.stringify(campaign).includes("undefined"));
      assert(!("outro" in a));
      setCaseStory(campaign, "non-esiste", { intro: "x" }); // nessun errore
      setCaseStory(campaign, b.id, { intro: "x".repeat(STORY_TEXT_MAX + 50) });
      assertEqual(b.intro.length, STORY_TEXT_MAX, "un testo troppo lungo viene tagliato");
    },
  },
  {
    name: "storia: il finale si salva anche a metà ma si mostra solo quando entrambi i finali hanno pulsante e testo",
    fn: () => {
      const campaign = buildCampaignWithCases(1);
      assertEqual(finaleOf(campaign), null, "nessun finale");
      setFinale(campaign, {
        endings: [
          { label: "Arresto", text: "" },
          { label: "", text: "" },
        ],
      });
      assert(campaign.finale, "a metà viene conservato");
      assertEqual(finaleOf(campaign), null, "ma non è pronto");
      setFinale(campaign, {
        prompt: "  Che fai?  ",
        endings: [
          { label: " Denuncio ", text: "Adela confessa." },
          { label: "Taccio", text: "Il segreto resta." },
        ],
      });
      const ready = finaleOf(campaign);
      assertEqual(ready.prompt, "Che fai?");
      assertEqual(ready.endings[0].label, "Denuncio");
      assertEqual(ready.endings[1].text, "Il segreto resta.");
      setFinale(campaign, {
        endings: [
          { label: "A", text: "a" },
          { label: "B", text: "b" },
        ],
      });
      assert(!("prompt" in campaign.finale), "senza domanda il campo non c'è");
      assertEqual(finaleOf(campaign).prompt, "");
      setFinale(campaign, {
        prompt: "",
        endings: [
          { label: "", text: "" },
          { label: " ", text: "" },
        ],
      });
      assert(!("finale" in campaign), "tutto vuoto: il finale sparisce");
      assert(!JSON.stringify(campaign).includes("undefined"));
      setFinale(campaign, {
        endings: [
          { label: "x".repeat(STORY_LABEL_MAX + 10), text: "t" },
          { label: "y", text: "t" },
        ],
      });
      assertEqual(campaign.finale.endings[0].label.length, STORY_LABEL_MAX, "etichetta troppo lunga: tagliata");
    },
  },
  {
    name: "storia: isCampaignComplete vuole almeno un caso e tutti i casi completati",
    fn: () => {
      const campaign = buildCampaignWithCases(3);
      const [a, b, c] = campaign.cases;
      assert(!isCampaignComplete(createCampaign("Vuota"), []), "una campagna senza casi non è completa");
      assert(!isCampaignComplete(campaign, []));
      assert(!isCampaignComplete(campaign, [a.id, b.id]));
      assert(isCampaignComplete(campaign, [c.id, a.id, b.id]), "l'ordine non conta");
      assert(isCampaignComplete(campaign, [a.id, b.id, c.id, "altro"]));
    },
  },
  {
    name: "storia: splitParagraphs divide sulle righe vuote, tiene gli a capo singoli e scarta i vuoti",
    fn: () => {
      assertEqual(JSON.stringify(splitParagraphs("uno\n\ndue\r\n \r\ntre\nquattro")), JSON.stringify(["uno", "due", "tre\nquattro"]));
      assertEqual(splitParagraphs("").length, 0);
      assertEqual(splitParagraphs("  \n\n  ").length, 0);
      assertEqual(splitParagraphs(undefined).length, 0);
      assertEqual(splitParagraphs("<b>x</b>")[0], "<b>x</b>", "nessuna interpretazione del testo");
    },
  },
  {
    name: "storia: validateCampaignShape controlla i tipi e le lunghezze dei testi e del finale",
    fn: () => {
      const campaign = buildCampaignWithCases(2);
      assert(validateCampaignShape(campaign).valid, "una campagna senza testi è valida (campagne vecchie)");
      campaign.cases[0].intro = 5;
      assert(!validateCampaignShape(campaign).valid, "l'introduzione deve essere una stringa");
      campaign.cases[0].intro = "x".repeat(STORY_TEXT_MAX + 1);
      assert(!validateCampaignShape(campaign).valid, "troppo lunga");
      campaign.cases[0].intro = "Ok";
      campaign.cases[1].outro = { a: 1 };
      assert(!validateCampaignShape(campaign).valid, "l'epilogo deve essere una stringa");
      campaign.cases[1].outro = "Ok";
      assert(validateCampaignShape(campaign).valid);
      campaign.finale = "x";
      assert(!validateCampaignShape(campaign).valid, "il finale deve essere un oggetto");
      campaign.finale = { endings: [{ label: "a", text: "b" }] };
      assert(!validateCampaignShape(campaign).valid, "servono due finali");
      campaign.finale = {
        endings: [
          { label: "a", text: "b" },
          { label: 1, text: "b" },
        ],
      };
      assert(!validateCampaignShape(campaign).valid, "l'etichetta è una stringa");
      campaign.finale = {
        prompt: 3,
        endings: [
          { label: "a", text: "b" },
          { label: "c", text: "d" },
        ],
      };
      assert(!validateCampaignShape(campaign).valid, "la domanda è una stringa");
      campaign.finale = {
        prompt: "Che fai?",
        endings: [
          { label: "a", text: "b" },
          { label: "c", text: "" },
        ],
      };
      assert(validateCampaignShape(campaign).valid, "un finale a metà si può salvare");
    },
  },
];
