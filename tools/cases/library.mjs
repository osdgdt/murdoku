// Specs of the bundled case library. Each spec fixes the map, the cast and the
// TRUE solution; tools/make-library.mjs proposes the clues. Placeholders in
// texts {victimRoom} = room where the victim is found, {murderer} = the only
// other person in that room.
//
// Fields worth knowing:
//   tense    verb tense of every clue of the case ("present" | "past" | "future")
//   require  clue types that must appear (so each case shows off something new)
//   objects  { type, row, col } — doors and windows also take a `side` (N/E/S/W),
//            they sit on the edge of the cell and never block it
const person = (key, it, en, icon, gender, bioIt, bioEn, extra = {}) => ({ key, names: { it, en }, icon, gender, bio: { it: bioIt, en: bioEn }, ...extra });
const victim = (it, en, gender, bioIt, bioEn) => person("v", it, en, "victim", gender, bioIt, bioEn, { victim: true });

export const LIBRARY = [
  {
    id: "faro", order: 1, difficulty: "very-easy", seed: 1, mode: "easy", tense: "present", require: ["inFrontOfWindow"],
    map: ["AAABB", "AAABB", "CCDDD", "CCDDD", "CCDDD"],
    zones: { A: { it: "Lanterna", en: "Lantern room" }, B: { it: "Alloggio del guardiano", en: "Keeper's quarters" }, C: { it: "Rimessa delle barche", en: "Boat shed" }, D: { it: "Cantina", en: "Cellar" } },
    textures: { A: "planks", B: "parquet", C: "gravel", D: "stone" },
    objects: [
      { type: "window", row: 1, col: 2, side: "E" }, { type: "window", row: 0, col: 0, side: "N" }, { type: "door", row: 2, col: 1, side: "E" },
      { type: "table", row: 3, col: 3 }, { type: "chair", row: 4, col: 2 }, { type: "carpet", row: 3, col: 0 }, { type: "plant", row: 0, col: 4 }, { type: "lamp", row: 1, col: 0 },
    ],
    cast: [
      victim("Capitano Morgan", "Captain Morgan", "male", "Il vecchio guardiano del faro.", "The old lighthouse keeper."),
      person("a", "Ettore", "Hector", "sailor", "male", "Il marinaio che porta le provviste.", "The sailor who brings the supplies."),
      person("b", "Lucia", "Lucy", "photographer", "female", "Una fotografa venuta per le tempeste.", "A photographer who came for the storms."),
      person("c", "Nino", "Nick", "mechanic", "male", "Il meccanico del generatore.", "The generator mechanic."),
    ],
    solution: { v: [0, 1], a: [1, 2], b: [3, 4], c: [4, 0] },
    text: {
      it: { title: "Il faro nella tempesta", briefing: "Una notte di tempesta, il capitano Morgan viene trovato senza vita {victimRoom}. Il faro è isolato dal mare in burrasca: chi era con lui?", resolution: "{murderer} era l'unica persona con il capitano. La luce del faro torna a girare." },
      en: { title: "The Lighthouse in the Storm", briefing: "On a stormy night, Captain Morgan is found dead {victimRoom}. The lighthouse is cut off by the raging sea: who was with him?", resolution: "{murderer} was the only person with the captain. The lighthouse beam turns again." },
    },
  },
  {
    id: "pasticceria", order: 2, difficulty: "easy", seed: 1, mode: "easy", tense: "present",
    map: ["AABBB", "AABBB", "CCCDD", "CCCDD", "EEEDD"],
    zones: { A: { it: "Laboratorio", en: "Workshop" }, B: { it: "Negozio", en: "Shop" }, C: { it: "Sala da tè", en: "Tea room" }, D: { it: "Magazzino", en: "Storeroom" }, E: { it: "Cella frigorifera", en: "Cold room" } },
    textures: { A: "tiles_white", B: "checker_cream", C: "carpet_blue", D: "concrete", E: "linoleum" },
    objects: [
      { type: "door", row: 1, col: 1, side: "E" }, { type: "window", row: 2, col: 2, side: "E" }, { type: "window", row: 0, col: 3, side: "N" },
      { type: "table", row: 1, col: 2 }, { type: "shelf", row: 0, col: 4 }, { type: "chair", row: 2, col: 0 }, { type: "stool", row: 3, col: 0 }, { type: "carpet", row: 3, col: 1 }, { type: "lamp", row: 4, col: 2 }, { type: "plant", row: 4, col: 4 },
    ],
    cast: [
      victim("Maestro Ferrante", "Master Ferrante", "male", "Il pasticcere più famoso della città.", "The city's most famous pastry chef."),
      person("a", "Anselmo", "Anselm", "banker", "male", "Il banchiere a cui Ferrante doveva molti soldi.", "The banker Ferrante owed a lot of money."),
      person("b", "Rosa", "Rosie", "photographer", "female", "La food blogger, sempre a caccia di scoop.", "The food blogger, always chasing a scoop."),
      person("c", "Tino", "Tim", "mechanic", "male", "Il tecnico che ripara i forni.", "The technician who fixes the ovens."),
      person("d", "Vera", "Vera", "police", "female", "L'ispettrice, venuta per un controllo igienico.", "The inspector, there for a hygiene check."),
    ],
    solution: { v: [0, 3], a: [1, 4], b: [2, 1], c: [3, 2], d: [4, 0] },
    text: {
      it: { title: "Amaro in pasticceria", briefing: "All'alba, il maestro Ferrante viene trovato senza vita {victimRoom}. Nell'aria c'è profumo di zucchero... e di guai. Chi c'era con lui?", resolution: "{murderer} era l'unica persona con il maestro. La torta resta incompiuta." },
      en: { title: "Bitter in the Bakery", briefing: "At dawn, Master Ferrante is found dead {victimRoom}. The air smells of sugar... and trouble. Who was with him?", resolution: "{murderer} was the only person with the master. The cake stays unfinished." },
    },
  },
  {
    id: "clinica", order: 3, difficulty: "easy", seed: 1, mode: "medium", tense: "present", require: ["inFrontOfWindow"],
    map: ["AAABBC", "AAABBC", "DD#EEC", "DDFEEC", "GGFFHH", "GGFFHH"],
    zones: { A: { it: "Reception", en: "Reception" }, B: { it: "Sala d'attesa", en: "Waiting room" }, C: { it: "Corridoio", en: "Corridor" }, D: { it: "Ambulatorio", en: "Surgery" }, E: { it: "Laboratorio", en: "Laboratory" }, F: { it: "Radiologia", en: "X-ray room" }, G: { it: "Farmacia", en: "Pharmacy" }, H: { it: "Obitorio", en: "Morgue" } },
    textures: { A: "marble", B: "carpet_green", C: "concrete", D: "tiles_white", E: "linoleum", F: "slate", G: "parquet", H: "marble_black" },
    objects: [
      { type: "window", row: 0, col: 0, side: "N" }, { type: "door", row: 1, col: 2, side: "E" }, { type: "window", row: 1, col: 3, side: "S" }, { type: "door", row: 3, col: 1, side: "E" },
      { type: "chair", row: 0, col: 1 }, { type: "table", row: 1, col: 0 }, { type: "plant", row: 0, col: 5 }, { type: "lamp", row: 2, col: 5 }, { type: "tv", row: 2, col: 3 },
      { type: "shelf", row: 3, col: 1 }, { type: "stool", row: 3, col: 4 }, { type: "carpet", row: 4, col: 0 }, { type: "table", row: 5, col: 2 },
    ],
    cast: [
      victim("Dottor Bellandi", "Dr. Bellandi", "male", "Il primario, stimato e temuto.", "The chief physician, respected and feared."),
      person("a", "Sabrina", "Sabrina", "nurse", "female", "L'infermiera capo, sempre al suo fianco.", "The head nurse, always at his side."),
      person("b", "Ottavio", "Octavius", "pharmacist", "male", "Il farmacista, che sapeva troppo sui farmaci.", "The pharmacist, who knew too much about drugs."),
      person("c", "Greta", "Greta", "lawyer", "female", "L'avvocata di un paziente scontento.", "The lawyer of a disgruntled patient."),
      person("d", "Franco", "Frank", "construction", "male", "L'operaio dei lavori nel reparto.", "The workman renovating the ward."),
    ],
    solution: { v: [0, 4], a: [1, 3], b: [3, 0], c: [4, 2], d: [5, 5] },
    text: {
      it: { title: "Turno di notte in clinica", briefing: "Durante il turno di notte, il dottor Bellandi viene trovato senza vita {victimRoom}. Le porte erano chiuse dall'interno: chi era con lui?", resolution: "{murderer} era l'unica persona con il dottore. La diagnosi era sbagliata, il colpevole no." },
      en: { title: "Night Shift at the Clinic", briefing: "During the night shift, Dr. Bellandi is found dead {victimRoom}. The doors were locked from the inside: who was with him?", resolution: "{murderer} was the only person with the doctor. The diagnosis was wrong, the culprit was not." },
    },
  },
  {
    id: "collegio", order: 4, difficulty: "medium", seed: 1, mode: "medium", tense: "past", require: ["inFrontOfWindow"],
    map: ["AAAABB", "CCDDBB", "CCDDEE", "FFDDEE", "FFGGGG", "HHGGGG"],
    zones: { A: { it: "Aula magna", en: "Great hall" }, B: { it: "Biblioteca", en: "Library" }, C: { it: "Laboratorio", en: "Laboratory" }, D: { it: "Cortile", en: "Courtyard" }, E: { it: "Dormitorio", en: "Dormitory" }, F: { it: "Mensa", en: "Canteen" }, G: { it: "Palestra", en: "Gym" }, H: { it: "Cappella", en: "Chapel" } },
    textures: { A: "marble", B: "planks_dark", C: "linoleum", D: "grass", E: "carpet", F: "checker_bw", G: "wood", H: "stone" },
    objects: [
      { type: "window", row: 0, col: 2, side: "N" }, { type: "door", row: 1, col: 1, side: "E" }, { type: "window", row: 1, col: 4, side: "W" }, { type: "window", row: 3, col: 1, side: "E" },
      { type: "table", row: 3, col: 2 }, { type: "chair", row: 2, col: 2 }, { type: "stool", row: 1, col: 2 }, { type: "lamp", row: 0, col: 0 }, { type: "shelf", row: 0, col: 3 },
      { type: "tv", row: 2, col: 5 }, { type: "carpet", row: 3, col: 5 }, { type: "shelf", row: 5, col: 0 }, { type: "plant", row: 4, col: 5 }, { type: "table", row: 1, col: 0 },
    ],
    cast: [
      victim("Rettore Alberti", "Rector Albert", "male", "Il rettore, severo con tutti.", "The rector, strict with everyone."),
      person("a", "Sandri", "Sanders", "professor", "male", "Il professore di storia, escluso dalla cattedra.", "The history professor, passed over for the chair."),
      person("b", "Elisa", "Elise", "librarian", "female", "La bibliotecaria dei libri proibiti.", "The librarian of the forbidden books."),
      person("c", "Matteo", "Matthew", "scientist", "male", "Il ricercatore dei laboratori.", "The lab researcher."),
      person("d", "Agnese", "Agnes", "nun", "female", "La suora che cura la cappella.", "The nun who looks after the chapel."),
      person("e", "Bruno", "Bruce", "chef", "male", "Il cuoco della mensa.", "The canteen cook."),
    ],
    solution: { v: [0, 5], a: [1, 4], b: [2, 0], c: [3, 3], d: [4, 1], e: [5, 2] },
    text: {
      it: { title: "Esame finale al collegio", briefing: "La notte prima degli esami, il rettore Alberti fu trovato senza vita {victimRoom}. Il collegio era chiuso a chiave: chi era con lui?", resolution: "{murderer} era l'unica persona con il rettore. Nessuno sarà promosso a pieni voti." },
      en: { title: "Final Exam at the College", briefing: "The night before the exams, Rector Albert was found dead {victimRoom}. The college was locked up: who was with him?", resolution: "{murderer} was the only person with the rector. Nobody will graduate with honours." },
    },
  },
  {
    id: "castello", order: 5, difficulty: "medium", seed: 1, mode: "medium", tense: "past", require: ["inFrontOfWindow"],
    map: ["AAB#CC", "AABBCC", "DDEEEF", "DDEEEF", "GGHHIF", "GGHHII"],
    zones: { A: { it: "Torre", en: "Tower" }, B: { it: "Sala del trono", en: "Throne room" }, C: { it: "Armeria", en: "Armoury" }, D: { it: "Cucine", en: "Kitchens" }, E: { it: "Salone", en: "Great hall" }, F: { it: "Prigione", en: "Dungeon" }, G: { it: "Cappella", en: "Chapel" }, H: { it: "Giardino", en: "Garden" }, I: { it: "Scuderia", en: "Stables" } },
    textures: { A: "stone", B: "carpet", C: "slate", D: "terracotta", E: "checker_cream", F: "cobble", G: "marble", H: "grass", I: "sand" },
    objects: [
      { type: "door", row: 0, col: 1, side: "E" }, { type: "window", row: 0, col: 5, side: "N" }, { type: "window", row: 1, col: 5, side: "S" }, { type: "window", row: 3, col: 0, side: "W" },
      { type: "table", row: 2, col: 2 }, { type: "chair", row: 3, col: 3 }, { type: "stool", row: 3, col: 2 }, { type: "carpet", row: 2, col: 4 }, { type: "lamp", row: 0, col: 1 },
      { type: "shelf", row: 1, col: 0 }, { type: "plant", row: 4, col: 3 }, { type: "tv", row: 2, col: 0 }, { type: "table", row: 4, col: 5 }, { type: "plant", row: 5, col: 3 },
    ],
    cast: [
      victim("Re Aldovrando", "King Aldovrand", "male", "Il re, che amava le feste e i debiti.", "The king, who loved feasts and debts."),
      person("a", "Isolda", "Isolde", "queen", "female", "La regina, stanca della corte.", "The queen, weary of the court."),
      person("b", "Gawen", "Gawain", "knight", "male", "Il cavaliere del re, fedele fino a un certo punto.", "The king's knight, loyal up to a point."),
      person("c", "Ambrogio", "Ambrose", "wizard", "male", "Il mago di corte, con il suo libro di incantesimi.", "The court wizard, with his book of spells."),
      person("d", "Brunilde", "Brunhild", "chef", "female", "La cuoca reale, che conosceva ogni veleno.", "The royal cook, who knew every poison."),
      person("e", "Tobia", "Toby", "clown", "male", "Il giullare, l'unico che poteva dire la verità.", "The jester, the only one allowed to tell the truth."),
    ],
    solution: { v: [2, 3], a: [3, 4], b: [0, 0], c: [1, 5], d: [4, 1], e: [5, 2] },
    text: {
      it: { title: "Il banchetto del re", briefing: "Durante il banchetto d'inverno, re Aldovrando fu trovato senza vita {victimRoom}. Le porte del castello erano sprangate: chi era con lui?", resolution: "{murderer} era l'unica persona con il re. Il regno ha bisogno di un nuovo sovrano." },
      en: { title: "The King's Banquet", briefing: "During the winter banquet, King Aldovrand was found dead {victimRoom}. The castle gates were barred: who was with him?", resolution: "{murderer} was the only person with the king. The realm needs a new ruler." },
    },
  },
  {
    id: "stazione", order: 6, difficulty: "medium", seed: 1, mode: "medium", tense: "past", require: ["inFrontOfWindow"],
    map: ["AAA#BBB", "CCDDDBB", "CCDEEEF", "GG#EEEF", "GGHHHIF", "JJHHHII", "JJKKKII"],
    zones: { A: { it: "Plancia", en: "Bridge" }, B: { it: "Serra", en: "Greenhouse" }, C: { it: "Alloggi", en: "Quarters" }, D: { it: "Mensa", en: "Mess" }, E: { it: "Laboratorio", en: "Lab" }, F: { it: "Camera di equilibrio", en: "Airlock" }, G: { it: "Infermeria", en: "Infirmary" }, H: { it: "Sala macchine", en: "Engine room" }, I: { it: "Stiva", en: "Cargo bay" }, J: { it: "Palestra", en: "Gym" }, K: { it: "Osservatorio", en: "Observatory" } },
    textures: { A: "tiles_white", B: "grass", C: "carpet_blue", D: "checker_bw", E: "linoleum", F: "concrete", G: "tiles_white", H: "slate", I: "gravel", J: "carpet_green", K: "marble_black" },
    objects: [
      { type: "window", row: 0, col: 2, side: "N" }, { type: "window", row: 2, col: 1, side: "E" }, { type: "door", row: 1, col: 1, side: "E" }, { type: "door", row: 4, col: 1, side: "S" },
      { type: "table", row: 2, col: 4 }, { type: "chair", row: 3, col: 4 }, { type: "stool", row: 2, col: 5 }, { type: "lamp", row: 0, col: 1 }, { type: "plant", row: 0, col: 5 }, { type: "shelf", row: 3, col: 0 },
      { type: "carpet", row: 5, col: 0 }, { type: "tv", row: 6, col: 3 }, { type: "plant", row: 5, col: 5 }, { type: "table", row: 5, col: 3 }, { type: "shelf", row: 6, col: 5 }, { type: "lamp", row: 4, col: 6 },
    ],
    cast: [
      victim("Comandante Volkov", "Commander Volkov", "male", "Il comandante della stazione orbitale.", "The commander of the orbital station."),
      person("a", "Imani", "Imani", "scientist", "female", "La biologa della serra.", "The greenhouse biologist."),
      person("b", "Hiro", "Hiro", "astronaut", "male", "L'astronauta delle passeggiate esterne.", "The spacewalk astronaut."),
      person("c", "Sven", "Sven", "mechanic", "male", "Il tecnico dei motori.", "The engine technician."),
      person("d", "Léa", "Leah", "doctor", "female", "La dottoressa di bordo.", "The station doctor."),
      person("e", "Omar", "Omar", "pilot", "male", "Il pilota della navetta di rifornimento.", "The supply shuttle pilot."),
    ],
    solution: { v: [4, 3], a: [5, 2], b: [0, 0], c: [1, 5], d: [2, 1], e: [3, 6] },
    text: {
      it: { title: "Delitto in orbita", briefing: "A quattrocento chilometri dalla Terra, il comandante Volkov fu trovato senza vita {victimRoom}. Nessuna navetta poteva partire: chi era con lui?", resolution: "{murderer} era l'unica persona con il comandante. Il silenzio dello spazio ha parlato." },
      en: { title: "Murder in Orbit", briefing: "Four hundred kilometres above Earth, Commander Volkov was found dead {victimRoom}. No shuttle could leave: who was with him?", resolution: "{murderer} was the only person with the commander. The silence of space has spoken." },
    },
  },
  {
    id: "monastero", order: 7, difficulty: "hard", seed: 1, mode: "hard", tense: "past",
    map: ["AAABBBC", "AAABBBC", "DDEEEFF", "DDEEEFF", "GGGHHFF", "GGGHHII", "JJJJJII"],
    zones: { A: { it: "Chiostro", en: "Cloister" }, B: { it: "Biblioteca", en: "Library" }, C: { it: "Campanile", en: "Bell tower" }, D: { it: "Refettorio", en: "Refectory" }, E: { it: "Chiesa", en: "Church" }, F: { it: "Orto", en: "Vegetable garden" }, G: { it: "Dormitorio", en: "Dormitory" }, H: { it: "Scriptorium", en: "Scriptorium" }, I: { it: "Cantina", en: "Cellar" }, J: { it: "Foresteria", en: "Guesthouse" } },
    textures: { A: "grass", B: "planks_dark", C: "stone", D: "terracotta", E: "marble", F: "gravel", G: "wood", H: "parquet", I: "cobble", J: "sand" },
    objects: [
      { type: "window", row: 0, col: 2, side: "N" }, { type: "window", row: 3, col: 6, side: "E" }, { type: "door", row: 1, col: 2, side: "E" }, { type: "door", row: 3, col: 1, side: "S" },
      { type: "chair", row: 2, col: 3 }, { type: "chair", row: 2, col: 4 }, { type: "chair", row: 3, col: 2 }, { type: "chair", row: 3, col: 3 },
      { type: "carpet", row: 2, col: 0 }, { type: "lamp", row: 0, col: 1 }, { type: "shelf", row: 0, col: 4 }, { type: "table", row: 1, col: 3 }, { type: "plant", row: 4, col: 6 },
      { type: "stool", row: 6, col: 1 }, { type: "table", row: 6, col: 4 }, { type: "tv", row: 5, col: 5 }, { type: "plant", row: 0, col: 6 }, { type: "shelf", row: 5, col: 0 },
    ],
    cast: [
      victim("Abate Benedetto", "Abbot Benedict", "male", "L'abate, custode di un grande segreto.", "The abbot, keeper of a great secret."),
      person("a", "Tommaso", "Thomas", "monk", "male", "Il monaco copista.", "The scribe monk."),
      person("b", "Chiara", "Clare", "nun", "female", "La suora dell'infermeria.", "The infirmary nun."),
      person("c", "Ruggero", "Roger", "farmer", "male", "Il contadino che lavora l'orto.", "The farmer who tends the garden."),
      person("d", "Ilaria", "Hilary", "librarian", "female", "La studiosa venuta a consultare i codici.", "The scholar who came to consult the codices."),
      person("e", "Aldo", "Alan", "tourist", "male", "Un pellegrino arrivato la sera prima.", "A pilgrim who arrived the evening before."),
    ],
    solution: { v: [2, 2], a: [3, 4], b: [0, 0], c: [1, 6], d: [4, 1], e: [6, 3] },
    text: {
      it: { title: "Il segreto del monastero", briefing: "All'ora dei vespri, l'abate Benedetto fu trovato senza vita {victimRoom}. Il monastero era isolato dalla neve: chi era con lui?", resolution: "{murderer} era l'unica persona con l'abate. Il segreto ora è al sicuro... forse." },
      en: { title: "The Secret of the Monastery", briefing: "At the hour of vespers, Abbot Benedict was found dead {victimRoom}. The monastery was snowed in: who was with him?", resolution: "{murderer} was the only person with the abbot. The secret is safe now... perhaps." },
    },
  },
  {
    id: "villa", order: 8, difficulty: "hard", seed: 1, mode: "hard", tense: "past",
    map: ["AAAABBB", "CCDDDBB", "CCDDDEE", "FFGGGEE", "FFGGGHH", "IIGGGHH", "IIIJJJJ"],
    zones: { A: { it: "Veranda", en: "Veranda" }, B: { it: "Terrazza", en: "Terrace" }, C: { it: "Studio", en: "Study" }, D: { it: "Salotto", en: "Drawing room" }, E: { it: "Darsena", en: "Boathouse" }, F: { it: "Biblioteca", en: "Library" }, G: { it: "Sala da pranzo", en: "Dining room" }, H: { it: "Serra", en: "Conservatory" }, I: { it: "Cucina", en: "Kitchen" }, J: { it: "Cantina", en: "Cellar" } },
    textures: { A: "planks", B: "gravel", C: "planks_dark", D: "carpet_blue", E: "water", F: "parquet", G: "checker_cream", H: "grass", I: "terracotta", J: "brick" },
    objects: [
      { type: "window", row: 0, col: 4, side: "N" }, { type: "window", row: 3, col: 6, side: "E" }, { type: "window", row: 3, col: 4, side: "E" },
      { type: "door", row: 1, col: 1, side: "E" }, { type: "door", row: 3, col: 1, side: "E" }, { type: "door", row: 5, col: 1, side: "E" },
      { type: "table", row: 4, col: 2 }, { type: "chair", row: 3, col: 2 }, { type: "chair", row: 3, col: 3 }, { type: "chair", row: 4, col: 4 }, { type: "carpet", row: 5, col: 3 },
      { type: "lamp", row: 0, col: 2 }, { type: "shelf", row: 3, col: 0 }, { type: "plant", row: 0, col: 6 }, { type: "tv", row: 1, col: 2 }, { type: "stool", row: 2, col: 3 },
      { type: "plant", row: 5, col: 0 }, { type: "shelf", row: 4, col: 6 }, { type: "table", row: 6, col: 4 }, { type: "lamp", row: 6, col: 5 }, { type: "carpet", row: 4, col: 5 },
    ],
    cast: [
      victim("Contessa Lavinia", "Countess Lavinia", "female", "La padrona della villa sul lago.", "The lady of the lakeside villa."),
      person("a", "Edmondo", "Edmund", "butler", "male", "Il maggiordomo di sempre.", "The butler of many years."),
      person("b", "Giacinta", "Hyacinth", "maid", "female", "La cameriera che origliava alle porte.", "The maid who listened at doors."),
      person("c", "Rodolfo", "Rudolph", "gardener", "male", "Il giardiniere, licenziato il giorno prima.", "The gardener, dismissed the day before."),
      person("d", "Caterina", "Catherine", "artist", "female", "La pittrice ospite della villa.", "The painter staying at the villa."),
      person("e", "Leopoldo", "Leopold", "lawyer", "male", "L'avvocato di famiglia, con il testamento.", "The family lawyer, carrying the will."),
    ],
    solution: { v: [4, 3], a: [3, 4], b: [0, 0], c: [1, 5], d: [2, 1], e: [5, 6] },
    text: {
      it: { title: "La villa sul lago", briefing: "Il giorno della lettura del testamento, la contessa Lavinia fu trovata senza vita {victimRoom}. Sei persone, dieci stanze, un solo testimone muto: la villa.", resolution: "{murderer} era l'unica persona con la contessa. Il testamento ora è tutto da riscrivere." },
      en: { title: "The Villa on the Lake", briefing: "On the day the will was read, Countess Lavinia was found dead {victimRoom}. Six people, ten rooms, and one silent witness: the villa.", resolution: "{murderer} was the only person with the countess. The will must now be rewritten." },
    },
  },
];
