import * as recentActivity from "../src/storage/recentActivityStore.js";
import { assert, assertEqual } from "./assert.js";

function reset() {
  localStorage.removeItem("murdoku:recent");
}

export const tests = [
  {
    name: "getRecent su uno storage vuoto restituisce null",
    fn: () => {
      reset();
      assertEqual(recentActivity.getRecent(), null);
    },
  },
  {
    name: "recordOpened/getRecent fanno un round-trip fedele per un puzzle standalone",
    fn: () => {
      reset();
      recentActivity.recordOpened({ kind: "puzzle", id: "puzzle_1", title: "Il caso del mordente", url: "player.html?id=puzzle_1" });
      const recent = recentActivity.getRecent();
      assertEqual(recent.kind, "puzzle");
      assertEqual(recent.id, "puzzle_1");
      assertEqual(recent.url, "player.html?id=puzzle_1");
      assert(typeof recent.openedAt === "number", "openedAt deve essere impostato automaticamente");
    },
  },
  {
    name: "recordOpened/getRecent fanno un round-trip fedele per un caso di campagna",
    fn: () => {
      reset();
      recentActivity.recordOpened({
        kind: "campaign", campaignId: "c1", campaignTitle: "La villa", caseId: "case_2",
        caseLabel: "Caso 2", title: "La villa — Caso 2", url: "campaign.html?campaign=c1&case=case_2",
      });
      const recent = recentActivity.getRecent();
      assertEqual(recent.kind, "campaign");
      assertEqual(recent.url, "campaign.html?campaign=c1&case=case_2");
    },
  },
  {
    name: "una nuova recordOpened sovrascrive la precedente (un solo slot)",
    fn: () => {
      reset();
      recentActivity.recordOpened({ kind: "puzzle", id: "p1", title: "Uno", url: "player.html?id=p1" });
      recentActivity.recordOpened({ kind: "puzzle", id: "p2", title: "Due", url: "player.html?id=p2" });
      assertEqual(recentActivity.getRecent().id, "p2");
    },
  },
  {
    name: "getRecent su un valore corrotto o incompleto in localStorage restituisce null invece di lanciare",
    fn: () => {
      localStorage.setItem("murdoku:recent", "{not json");
      assertEqual(recentActivity.getRecent(), null);
      localStorage.setItem("murdoku:recent", JSON.stringify({ kind: "puzzle" })); // manca url/title
      assertEqual(recentActivity.getRecent(), null);
      reset();
    },
  },
];
