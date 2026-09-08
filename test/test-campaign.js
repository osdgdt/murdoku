import { createCampaign, addCase, removeCase, reorderCases, validateCampaignShape } from "../src/campaign/campaignModel.js";
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
      assert(errors.some((e) => e.includes("titolo")), "errore atteso sul titolo mancante");
    },
  },
  {
    name: "validateCampaignShape: rifiuta un caso senza puzzleUrl",
    fn: () => {
      const campaign = createCampaign("Test");
      campaign.cases.push({ id: "case_1", puzzleId: "p1", puzzleUrl: "", label: "Rotto" });
      const { valid, errors } = validateCampaignShape(campaign);
      assert(!valid, "atteso non valido");
      assert(errors.some((e) => e.includes("URL")), "errore atteso sull'URL mancante");
    },
  },
  {
    name: "validateCampaignShape: rifiuta id caso duplicati",
    fn: () => {
      const campaign = buildCampaignWithCases(1);
      campaign.cases.push({ ...campaign.cases[0] });
      const { valid, errors } = validateCampaignShape(campaign);
      assert(!valid, "atteso non valido");
      assert(errors.some((e) => e.includes("duplicato")), "errore atteso sull'id duplicato");
    },
  },
];
