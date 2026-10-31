// Specs of the bundled case library. Each spec fixes the map, the cast and the
// TRUE solution; tools/make-library.mjs proposes the clues. Placeholders in
// texts {victimRoom} = room where the victim is found, {murderer} = the only
// other person in that room.
const person = (key, it, en, icon, gender, bioIt, bioEn, extra = {}) => ({ key, names: { it, en }, icon, gender, bio: { it: bioIt, en: bioEn }, ...extra });

export const LIBRARY = [
  {
    id: "library", order: 1, difficulty: "very-easy", seed: 1, mode: "easy",
    map: ["AAABB", "AAABB", "CCDDD", "CCDDD", "CCDDD"],
    zones: { A: { it: "Studio", en: "Study" }, B: { it: "Biblioteca", en: "Library" }, C: { it: "Salotto", en: "Parlour" }, D: { it: "Cucina", en: "Kitchen" } },
    objects: [{ type: "table", row: 2, col: 3 }, { type: "chair", row: 0, col: 1 }, { type: "plant", row: 4, col: 4 }, { type: "door", row: 2, col: 2 }],
    cast: [
      person("v", "Lord Ashford", "Lord Ashford", "person1", "male", "Il padrone di casa.", "The master of the house.", { victim: true }),
      person("a", "Ada", "Ada", "maid", "female", "La cameriera: sa sempre tutto di tutti.", "The maid: she always knows everything about everyone."),
      person("b", "Bruno", "Bruno", "butler", "male", "Il maggiordomo, impeccabile e silenzioso.", "The butler, impeccable and silent."),
      person("c", "Clara", "Clara", "chef", "female", "La cuoca, odiava le critiche di Lord Ashford.", "The cook, who hated Lord Ashford's criticism."),
    ],
    solution: { v: [0, 0], a: [1, 2], b: [3, 4], c: [4, 1] },
    text: {
      it: { title: "Delitto nello studio", briefing: "Durante la riunione di famiglia, Lord Ashford viene trovato senza vita {victimRoom}. La casa è piena di gente, ma solo una persona era con lui. Ricostruisci chi si trovava dove.", resolution: "{murderer} era l'unica persona con Lord Ashford al momento del delitto: il caso è chiuso." },
      en: { title: "Murder in the Study", briefing: "During the family gathering, Lord Ashford is found dead {victimRoom}. The house is full of people, but only one of them was with him. Work out who was where.", resolution: "{murderer} was the only person with Lord Ashford when it happened: case closed." },
    },
  },
  {
    id: "dinner", order: 2, difficulty: "easy", seed: 1, mode: "easy",
    map: ["AABBB", "AABBB", "CCCDD", "CCCDD", "EEEDD"],
    zones: { A: { it: "Atrio", en: "Hall" }, B: { it: "Sala da pranzo", en: "Dining room" }, C: { it: "Salotto", en: "Lounge" }, D: { it: "Cucina", en: "Kitchen" }, E: { it: "Dispensa", en: "Pantry" } },
    objects: [{ type: "table", row: 1, col: 2 }, { type: "carpet", row: 2, col: 1 }, { type: "stool", row: 2, col: 4 }, { type: "lamp", row: 0, col: 1 }, { type: "shelf", row: 4, col: 2 }, { type: "plant", row: 4, col: 0 }, { type: "door", row: 2, col: 2 }],
    cast: [
      person("v", "Contessa Vera", "Countess Vera", "person1", "female", "L'ospite d'onore della serata.", "The guest of honour.", { victim: true }),
      person("a", "Edoardo", "Edward", "professor", "male", "Il professore, ospite d'onore mancato.", "The professor, passed over as guest of honour."),
      person("b", "Livia", "Livia", "artist", "female", "L'artista, sempre in ritardo.", "The artist, always late."),
      person("c", "Marco", "Marcus", "driver", "male", "L'autista, in attesa fuori dalla porta.", "The driver, waiting by the door."),
      person("d", "Nora", "Nora", "glasses", "female", "La cugina della contessa, appassionata di veleni.", "The countess's cousin, fascinated by poisons."),
    ],
    solution: { v: [0, 3], a: [1, 4], b: [2, 0], c: [3, 2], d: [4, 1] },
    text: {
      it: { title: "Cena con delitto", briefing: "La Contessa Vera non arriverà al dolce: la trovano {victimRoom}. Cinque ospiti, una sola persona nella stanza con lei. Chi?", resolution: "{murderer} era l'unico ospite con la contessa: il dolce può aspettare." },
      en: { title: "Dinner Party Murder", briefing: "Countess Vera will not live to see dessert: she is found {victimRoom}. Five guests, and only one person in the room with her. Who?", resolution: "{murderer} was the only guest with the countess: dessert can wait." },
    },
  },
  {
    id: "train", order: 3, difficulty: "easy", seed: 1, mode: "medium",
    map: ["AAABBB", "AAABBB", "CCDDEE", "CCDDEE", "FFFFEE", "FFFFFF"],
    zones: { A: { it: "Vagone letto", en: "Sleeper car" }, B: { it: "Vagone ristorante", en: "Dining car" }, C: { it: "Salone", en: "Lounge" }, D: { it: "Bar", en: "Bar" }, E: { it: "Bagagliaio", en: "Baggage car" }, F: { it: "Carro merci", en: "Freight car" } },
    objects: [{ type: "window", row: 0, col: 0 }, { type: "table", row: 0, col: 4 }, { type: "chair", row: 1, col: 5 }, { type: "tv", row: 2, col: 2 }, { type: "lamp", row: 3, col: 3 }, { type: "stool", row: 3, col: 2 }, { type: "shelf", row: 2, col: 5 }, { type: "carpet", row: 5, col: 2 }, { type: "plant", row: 5, col: 5 }, { type: "door", row: 4, col: 1 }],
    cast: [
      person("v", "Madame Orlova", "Madame Orlova", "person1", "female", "Una celebre cantante lirica.", "A celebrated opera singer.", { victim: true }),
      person("a", "Conte Petrov", "Count Petrov", "detective", "male", "Dice di viaggiare in incognito.", "Claims to be travelling incognito."),
      person("b", "Irina", "Irina", "maid", "female", "La governante di Madame Orlova.", "Madame Orlova's housekeeper."),
      person("c", "Sergej", "Sergei", "driver", "male", "Il capotreno, con le chiavi di ogni vagone.", "The conductor, with keys to every car."),
      person("d", "Katia", "Katya", "artist", "female", "Una pittrice in viaggio verso il mare.", "A painter on her way to the seaside."),
    ],
    solution: { v: [0, 1], a: [1, 2], b: [2, 4], c: [3, 0], d: [4, 3] },
    text: {
      it: { title: "Il treno della notte", briefing: "Il treno corre nella notte quando Madame Orlova viene trovata senza vita {victimRoom}. Nessuno è sceso alla stazione precedente. Chi era con lei?", resolution: "{murderer} era l'unico passeggero nello stesso vagone di Madame Orlova. La corsa finisce qui." },
      en: { title: "The Night Train", briefing: "The train rushes through the night when Madame Orlova is found dead {victimRoom}. Nobody got off at the previous station. Who was with her?", resolution: "{murderer} was the only passenger in the same car as Madame Orlova. The journey ends here." },
    },
  },
  {
    id: "restaurant", order: 4, difficulty: "medium", seed: 1, mode: "medium",
    map: ["AAABBC", "AAABBC", "DDEEEC", "DDEEEF", "GGGGFF", "GGGGFF"],
    zones: { A: { it: "Cucina", en: "Kitchen" }, B: { it: "Dispensa", en: "Pantry" }, C: { it: "Terrazza", en: "Terrace" }, D: { it: "Guardaroba", en: "Cloakroom" }, E: { it: "Sala", en: "Dining hall" }, F: { it: "Bar", en: "Bar" }, G: { it: "Cantina", en: "Cellar" } },
    objects: [{ type: "table", row: 2, col: 2 }, { type: "table", row: 3, col: 3 }, { type: "table", row: 3, col: 4 }, { type: "lamp", row: 0, col: 2 }, { type: "shelf", row: 1, col: 0 }, { type: "plant", row: 0, col: 5 }, { type: "chair", row: 2, col: 5 }, { type: "door", row: 2, col: 1 }, { type: "stool", row: 5, col: 0 }, { type: "tv", row: 3, col: 5 }, { type: "window", row: 4, col: 0 }, { type: "carpet", row: 4, col: 3 }],
    cast: [
      person("v", "Chef Moreau", "Chef Moreau", "person1", "male", "Lo chef stellato, tiranno dei fornelli.", "The star chef, tyrant of the stoves.", { victim: true }),
      person("a", "Giulia", "Julia", "chef", "female", "La sous-chef, stufa di prendere ordini.", "The sous-chef, tired of taking orders."),
      person("b", "Pietro", "Peter", "butler", "male", "Il maître di sala.", "The maître d'."),
      person("c", "Sofia", "Sophie", "glasses", "female", "La critica gastronomica, con il taccuino sempre in mano.", "The food critic, notebook always in hand."),
      person("d", "Dario", "Dario", "gardener", "male", "Il fornitore di erbe aromatiche.", "The herb supplier."),
      person("e", "Elena", "Helen", "hat", "female", "La sommelier, custode della cantina.", "The sommelier, keeper of the cellar."),
    ],
    solution: { v: [3, 2], a: [2, 3], b: [0, 0], c: [1, 5], d: [4, 1], e: [5, 4] },
    text: {
      it: { title: "Veleno al ristorante", briefing: "La serata del tutto esaurito finisce male: lo chef Moreau viene trovato senza vita {victimRoom}. Sei persone in locale e un solo testimone silenzioso: la mappa dei posti.", resolution: "{murderer} era l'unico nella stessa stanza dello chef Moreau. Il conto, stavolta, è salatissimo." },
      en: { title: "Poison at the Restaurant", briefing: "The sold-out evening ends badly: Chef Moreau is found dead {victimRoom}. Six people in the building and one silent witness: the seating plan.", resolution: "{murderer} was the only one in the same room as Chef Moreau. This time the bill is steep." },
    },
  },
  {
    id: "museum", order: 5, difficulty: "medium", seed: 1, mode: "medium",
    map: ["AAABBB", "AAABBB", "CC##DD", "CC##DD", "EEEFFF", "EEEFFF"],
    zones: { A: { it: "Sala egizia", en: "Egyptian hall" }, B: { it: "Pinacoteca", en: "Picture gallery" }, C: { it: "Armeria", en: "Armoury" }, D: { it: "Sala dei gioielli", en: "Jewel room" }, E: { it: "Atrio", en: "Atrium" }, F: { it: "Deposito", en: "Storeroom" } },
    objects: [{ type: "shelf", row: 0, col: 2 }, { type: "lamp", row: 1, col: 0 }, { type: "window", row: 0, col: 3 }, { type: "tv", row: 1, col: 4 }, { type: "table", row: 1, col: 5 }, { type: "plant", row: 2, col: 0 }, { type: "chair", row: 3, col: 0 }, { type: "door", row: 3, col: 4 }, { type: "carpet", row: 4, col: 0 }, { type: "stool", row: 5, col: 1 }, { type: "shelf", row: 5, col: 5 }, { type: "table", row: 4, col: 5 }],
    cast: [
      person("v", "Dottor Valli", "Dr. Valli", "person1", "male", "Il direttore del museo.", "The museum director.", { victim: true }),
      person("a", "Agata", "Agatha", "professor", "female", "La curatrice della collezione egizia.", "The curator of the Egyptian collection."),
      person("b", "Bepi", "Bob", "driver", "male", "La guardia notturna.", "The night guard."),
      person("c", "Carla", "Carla", "artist", "female", "La restauratrice, mani d'oro.", "The restorer, golden hands."),
      person("d", "Davide", "David", "detective", "male", "Un visitatore insolitamente curioso.", "An unusually curious visitor."),
      person("e", "Emma", "Emma", "glasses", "female", "La guida turistica dell'ultimo turno.", "The last tour's guide."),
    ],
    solution: { v: [0, 0], a: [1, 2], b: [2, 5], c: [3, 1], d: [4, 3], e: [5, 4] },
    text: {
      it: { title: "Mistero al museo", briefing: "Dopo la chiusura, il direttore Valli viene trovato senza vita {victimRoom}. L'allarme non è scattato e le sale erano vuote... quasi.", resolution: "{murderer} era l'unica persona con il direttore. L'allarme, ironicamente, non serviva a niente." },
      en: { title: "Museum Mystery", briefing: "After closing time, Director Valli is found dead {victimRoom}. The alarm never went off and the halls were empty... almost.", resolution: "{murderer} was the only person with the director. The alarm, ironically, was useless." },
    },
  },
  {
    id: "opera", order: 6, difficulty: "hard", seed: 1, mode: "hard",
    map: ["AAAABBB", "AAAABBB", "CCDDDDE", "CCDDDDE", "CCDDDDE", "FFFGGGG", "FFFGGGG"],
    zones: { A: { it: "Palcoscenico", en: "Stage" }, B: { it: "Camerino", en: "Dressing room" }, C: { it: "Quinte", en: "Backstage" }, D: { it: "Platea", en: "Stalls" }, E: { it: "Palchi", en: "Boxes" }, F: { it: "Foyer", en: "Foyer" }, G: { it: "Bar", en: "Bar" } },
    objects: [{ type: "chair", row: 2, col: 2 }, { type: "chair", row: 2, col: 3 }, { type: "chair", row: 3, col: 2 }, { type: "chair", row: 3, col: 3 }, { type: "chair", row: 4, col: 2 }, { type: "chair", row: 4, col: 3 }, { type: "chair", row: 4, col: 5 }, { type: "carpet", row: 5, col: 0 }, { type: "lamp", row: 0, col: 0 }, { type: "table", row: 1, col: 4 }, { type: "window", row: 0, col: 6 }, { type: "shelf", row: 6, col: 0 }, { type: "door", row: 5, col: 3 }, { type: "plant", row: 2, col: 6 }, { type: "stool", row: 3, col: 6 }],
    cast: [
      person("v", "Maestro Rossi", "Maestro Rossi", "person1", "male", "Il direttore d'orchestra, temutissimo.", "The conductor, thoroughly feared.", { victim: true }),
      person("a", "Greta", "Greta", "hat", "female", "La soprano, rivale storica del maestro.", "The soprano, the maestro's old rival."),
      person("b", "Ugo", "Hugh", "butler", "male", "Il tecnico delle luci.", "The lighting technician."),
      person("c", "Viola", "Viola", "artist", "female", "La costumista.", "The costume designer."),
      person("d", "Tullio", "Terry", "professor", "male", "Il critico musicale del giornale.", "The newspaper's music critic."),
      person("e", "Lia", "Lily", "maid", "female", "La maschera che accompagna gli ospiti.", "The usher who shows guests to their seats."),
    ],
    solution: { v: [2, 0], a: [4, 1], b: [0, 3], c: [1, 6], d: [3, 4], e: [6, 5] },
    text: {
      it: { title: "Il teatro dell'opera", briefing: "Cala il sipario sulla prima, ma non sul maestro Rossi: lo trovano senza vita {victimRoom}. In sala c'erano troppe persone... ma nella sua stanza, una sola.", resolution: "{murderer} era l'unica persona accanto al maestro. Applausi, e sipario." },
      en: { title: "The Opera House", briefing: "The curtain falls on opening night, but not on Maestro Rossi: he is found dead {victimRoom}. There were too many people in the house... but in his room, only one.", resolution: "{murderer} was the only person beside the maestro. Applause, and curtain." },
    },
  },
  {
    id: "cruise", order: 7, difficulty: "hard", seed: 1, mode: "hard",
    map: ["AABBBCC", "AABBBCC", "DDDEEEE", "DDDEEEE", "FFGGGHH", "FFGGGHH", "FFIIIII"],
    zones: { A: { it: "Plancia", en: "Bridge" }, B: { it: "Sala da pranzo", en: "Dining room" }, C: { it: "Spa", en: "Spa" }, D: { it: "Cabine", en: "Cabins" }, E: { it: "Ponte passeggio", en: "Promenade deck" }, F: { it: "Sala macchine", en: "Engine room" }, G: { it: "Casinò", en: "Casino" }, H: { it: "Biblioteca", en: "Library" }, I: { it: "Stiva", en: "Cargo hold" } },
    objects: [{ type: "window", row: 0, col: 2 }, { type: "lamp", row: 1, col: 3 }, { type: "table", row: 0, col: 5 }, { type: "plant", row: 1, col: 6 }, { type: "chair", row: 2, col: 0 }, { type: "carpet", row: 3, col: 1 }, { type: "stool", row: 3, col: 2 }, { type: "tv", row: 2, col: 5 }, { type: "shelf", row: 4, col: 0 }, { type: "door", row: 5, col: 1 }, { type: "table", row: 4, col: 3 }, { type: "carpet", row: 5, col: 4 }, { type: "window", row: 5, col: 6 }, { type: "shelf", row: 6, col: 6 }, { type: "stool", row: 6, col: 3 }],
    cast: [
      person("v", "Commodoro Hale", "Commodore Hale", "person1", "male", "Il comandante della nave.", "The ship's captain.", { victim: true }),
      person("a", "Silvana", "Sylvia", "detective", "female", "La prima ufficiale.", "The first officer."),
      person("b", "Teo", "Theo", "butler", "male", "Il capo cameriere.", "The head steward."),
      person("c", "Ines", "Ines", "chef", "female", "La chef di bordo.", "The ship's chef."),
      person("d", "Gabriele", "Gabriel", "glasses", "male", "Un passeggero misterioso.", "A mysterious passenger."),
      person("e", "Mara", "Mara", "artist", "female", "La pianista della sala.", "The lounge pianist."),
      person("f", "Orazio", "Horace", "driver", "male", "Il motorista, sempre sporco di grasso.", "The engineer, always covered in grease."),
    ],
    solution: { v: [0, 1], a: [1, 0], b: [2, 3], c: [3, 5], d: [4, 6], e: [5, 2], f: [6, 4] },
    text: {
      it: { title: "La nave da crociera", briefing: "In mezzo all'oceano, il commodoro Hale non risponde più al comando: lo trovano senza vita {victimRoom}. Non si può scendere, e sette persone sanno più di quanto dicono.", resolution: "{murderer} era l'unica persona con il commodoro. La nave ritorna in porto con un ospite in meno." },
      en: { title: "The Cruise Ship", briefing: "In the middle of the ocean, Commodore Hale stops answering the helm: he is found dead {victimRoom}. Nobody can get off, and seven people know more than they say.", resolution: "{murderer} was the only person with the commodore. The ship returns to port with one guest fewer." },
    },
  },
  {
    id: "hotel", order: 8, difficulty: "expert", seed: 1, mode: "expert",
    map: ["AAA#BBB", "CCDDDBB", "CCDDDEE", "FF#GGEE", "FFGGGEE", "HHHGGII", "HHHIIII"],
    zones: { A: { it: "Reception", en: "Reception" }, B: { it: "Ristorante", en: "Restaurant" }, C: { it: "Bar", en: "Lounge bar" }, D: { it: "Sala da ballo", en: "Ballroom" }, E: { it: "Spa", en: "Spa" }, F: { it: "Biblioteca", en: "Library" }, G: { it: "Piscina", en: "Pool" }, H: { it: "Cucina", en: "Kitchen" }, I: { it: "Giardino", en: "Garden" } },
    objects: [{ type: "lamp", row: 0, col: 1 }, { type: "plant", row: 0, col: 2 }, { type: "window", row: 0, col: 5 }, { type: "table", row: 1, col: 5 }, { type: "tv", row: 1, col: 0 }, { type: "chair", row: 2, col: 0 }, { type: "stool", row: 1, col: 1 }, { type: "carpet", row: 1, col: 2 }, { type: "shelf", row: 2, col: 3 }, { type: "door", row: 3, col: 3 }, { type: "table", row: 5, col: 3 }, { type: "plant", row: 4, col: 5 }, { type: "window", row: 3, col: 6 }, { type: "shelf", row: 6, col: 0 }, { type: "stool", row: 5, col: 1 }, { type: "table", row: 6, col: 4 }, { type: "carpet", row: 5, col: 5 }],
    cast: [
      person("v", "Signora Belvedere", "Mrs. Belvedere", "person1", "female", "La proprietaria dell'hotel.", "The hotel's owner.", { victim: true }),
      person("a", "Rocco", "Rocky", "butler", "male", "Il portiere di notte.", "The night porter."),
      person("b", "Anita", "Anita", "maid", "female", "La governante dei piani.", "The head housekeeper."),
      person("c", "Fabio", "Felix", "professor", "male", "Un ospite di lunga data.", "A long-staying guest."),
      person("d", "Paola", "Paula", "glasses", "female", "La giornalista in incognito.", "The undercover journalist."),
      person("e", "Nico", "Nick", "chef", "male", "Il cuoco, appena licenziato.", "The cook, just fired."),
      person("f", "Chiara", "Claire", "artist", "female", "La musicista del bar.", "The lounge-bar musician."),
    ],
    solution: { v: [1, 3], a: [2, 4], b: [0, 0], c: [3, 1], d: [4, 2], e: [5, 6], f: [6, 5] },
    text: {
      it: { title: "Hotel Belvedere", briefing: "L'Hotel Belvedere è al completo quando la proprietaria viene trovata senza vita {victimRoom}. Sette persone, nove sale, due corridoi sbarrati. Una sola era con lei.", resolution: "{murderer} era l'unica persona con la signora Belvedere. Check-out immediato." },
      en: { title: "Hotel Belvedere", briefing: "The Hotel Belvedere is fully booked when its owner is found dead {victimRoom}. Seven people, nine rooms, two blocked passages. Only one was with her.", resolution: "{murderer} was the only person with Mrs. Belvedere. Immediate check-out." },
    },
  },
];
