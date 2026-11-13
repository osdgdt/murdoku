# Murdoku Editor

🇬🇧 English version: [README.en.md](README.en.md) · L'app è disponibile in **italiano e inglese** (pulsante IT/EN in alto a destra; di default segue la lingua del browser).

🌐 **Gioca online:** [osdgdt.github.io/murdoku](https://osdgdt.github.io/murdoku/) — nessuna installazione richiesta, funziona direttamente nel browser.

Editor e player per puzzle **Murdoku**: un ibrido tra Sudoku e deduzione investigativa. Su una griglia si piazzano personaggi (uno per riga/colonna) rispettando indizi legati a una mappa con stanze, zone colorate e oggetti; una vittima va piazzata anch'essa, e a fine gioco si rivela l'assassino.

Una regola base, sempre valida, non aggirabile con indizi: **la vittima si trova sempre in una stanza con esattamente un'altra persona**, e quella persona è l'assassino. Non basta un indizio a definirlo: è imposto ovunque (validazione, solver, suggerimenti) — un piazzamento con la vittima da sola o con due o più persone nella sua stanza non è mai una soluzione valida. Righe e colonne vuote sono invece del tutto ammesse (non serve un personaggio per ognuna): se vuoi che restino vuote in una soluzione specifica, basta dirlo con un indizio generale ("nessuno era nella riga/colonna X").

L'editor segnala la violazione di questa regola in **✓ Valida soluzione**, e il solver non troverà mai né suggerirà mai un piazzamento che la infrange.

App web statica, senza build: HTML/CSS/JS con ES modules. Editor, gioco libero, stampa ed export/import restano interamente senza backend (tutto in `localStorage`); solo la **modalità campagna** (sotto) usa Firebase per account e progresso condiviso tra dispositivi — il resto del sito funziona esattamente come sempre, senza bisogno di alcun accesso.

## Avvio in locale

I moduli ES (`import`/`export`) non funzionano aprendo i file direttamente da `file://` in Chrome — serve un piccolo server statico. Nella cartella del progetto:

```bash
python -m http.server 8000
```

oppure, se hai Node:

```bash
npx serve .
```

Poi apri `http://localhost:8000` nel browser. Su Windows basta fare doppio clic su `Avvia Murdoku.bat`: avvia lo stesso server (sulla porta 8123) e apre il browser da solo.

## Novità principali

- **Rinomina le stanze:** nell'editor, scegli una stanza (clic sul suo cerchio colorato) e cambia il nome nel campo **Rinomina stanza** (Invio o clic fuori per confermare; massimo 40 caratteri; un nome vuoto viene rifiutato). Il nome nuovo compare subito su mappa, legenda, indizi, stampa e glossario; id, colore, pavimento e celle restano gli stessi, quindi gli indizi non si toccano; un passo di annulla/ripeti per ogni cambio.
- **Pacchetto medievale / dark fantasy:** 17 pavimenti nuovi (lastre scure, pietra muschiosa, pietra con rune, terra battuta, fango, paglia, ossario, assi del ponte, damasco rosso, piastrelle decorate…) in `src/model/texturesMedieval.js` e 25 oggetti nuovi nel gruppo «Medioevo e fantasy» della tavolozza dell'editor. Si occupano letti, panche, troni (sedute), pelli d'orso e giacigli; bloccano la cella botti, forzieri, camini, incudini, altari, statue, armature, rastrelliere, calderoni, pozzi, carri, sarcofagi, leggii, stendardi, candelabri, gabbie, lapidi e sfere di cristallo; saracinesche e feritoie stanno sul bordo come porte e finestre. Il disegno è in `src/skin/paper/objectsMedieval.js`; le frasi degli indizi gestiscono gli articoli («un'incudine», «an anvil»). Ci sono anche 10 **personaggi medievali** (fabbro, boia, araldo, ladro, alchimista, arciere, principessa, principe, giullare, bardo), accanto a re, regina, cavaliere, monaco, mago e contessa.
- **Tutorial:** la pagina `tutorial.html` («Come si gioca», dalla home e da un link sotto la griglia in gioco) spiega le regole risolvendo passo per passo un caso piccolo e originale, con gli oggetti, tre trucchi di strategia e i gesti dell'app. Il caso e la sua deduzione sono calcolati dalle stesse regole del solver (`src/tutorial/tutorialCase.js`), e un test controlla che il racconto della pagina resti vero.
- **Installabile e offline (PWA):** da telefono o desktop si può "Aggiungere alla schermata Home"; dopo la prima visita l'app funziona anche senza rete (campagne e login Google a parte). Dopo un aggiornamento del sito compare un avviso «È disponibile una nuova versione» con il pulsante Ricarica: il service worker (`sw.js`) installa i file nuovi saltando la cache HTTP del browser (GitHub Pages la tiene per 10 minuti), e `npm run e2e:update` simula un deploy per verificarlo.
- **Condividi con un link:** in editor, **🔗 Condividi** copia un link `player.html#case=…` che contiene l'intero caso (compresso, nel frammento dell'URL: non passa da nessun server). Chi lo apre gioca subito, senza file da ospitare. Il vecchio `?import=<url>` continua a funzionare.
- **Libreria di casi:** al momento vuota (la sezione «Casi inclusi» e il **📅 Caso del giorno** compaiono appena ci sono casi in `examples/library.json`). I casi si aggiungono come specifiche in `tools/cases/library.mjs`; ognuno ha soluzione unica verificata dal solver. I casi generati seguono regole fisse: **nessun indizio sulla vittima**, che si piazza per **ultima** nell'unica casella rimasta (griglia N×N con N personaggi); mai l'indizio «è più vicino a X che a Y»; la descrizione non dice dove si trova la vittima; i sospettati hanno i nomi in ordine alfabetico e il nome della vittima inizia con la V.
- **Scorciatoie da tastiera** nel gioco: 1-9 scelgono un personaggio, X segna, E gomma, U annulla, H suggerimento.
- **Suggerimenti graduali:** ogni deduzione si rivela in tre passi con «Mostra di più»: prima solo il personaggio su cui ragionare, poi gli indizi che servono, infine la casella. I suggerimenti scritti a mano restano completi.
- **Indizio fissato:** un clic su una riga d'indizio tiene evidenziate sulla griglia le sue caselle, finché non lo riclicchi o cambi personaggio (il passaggio del mouse resta temporaneo).
- **Privacy:** pagina dedicata (`privacy.html`) con i pulsanti per cancellare i dati locali e quelli nel cloud; font ospitati dal sito (nessuna richiesta a Google Fonts).
- **Segnalazione errori:** se qualcosa si rompe compare un avviso con un link che apre una issue GitHub precompilata (nulla viene inviato in automatico).
- **✂ Indizi superflui** (editor): trova gli indizi che si possono togliere senza perdere l'unicità della soluzione; segna quelli che servono comunque a determinare i sospettati senza la vittima (di solito è voluto).
- **📜 Storico** (pagina Traguardi): ogni risoluzione (data, tempo, suggerimenti), riepilogo per caso, tempo medio, serie di giorni consecutivi (attuale e record) e casi dell'ultima settimana; resta solo sul dispositivo.
- **Colori accessibili:** la palette dei personaggi è scelta per restare distinguibile con protanopia, deuteranopia e tritanopia (e token/note hanno comunque icona e iniziale); i casi esistenti vengono ricolorati da una migrazione.
- **📤 Condividi risultato** a fine caso: un testo senza spoiler (titolo, tempo, suggerimenti).
- **Mobile:** su schermi stretti la griglia si rimpicciolisce per entrare nel viewport e i nomi delle stanze passano in una legenda sotto la mappa.
- **Sicurezza dell'import:** ogni file/link importato è validato (id e colori solo in forma sicura, dimensione massima 1 MB, versione dello schema) prima di toccare la pagina.

## Struttura

- `index.html` — pagina iniziale (nuovo puzzle / gioca / puzzle salvati)
- `editor.html` — modalità editor: mappa, personaggi, indizi, soluzione, validazione
- `player.html` — modalità gioco: piazzamento personaggi, segni X, verifica soluzione
- `print.html` — vista di stampa (mappa + carte indizio + griglia vuota)
- `src/model/` — dati: griglia, icone, tipi di indizio, puzzle
- `src/editor/` — UI dell'editor
- `src/solver/` — predicati indizio, ricerca backtracking, validatore/verifica unicità
- `src/player/` — UI di gioco
- `src/storage/` — salvataggio su localStorage, export/import JSON
- `src/print/` — rendering della vista stampabile
- `src/i18n/` — traduzioni: `t("testo italiano")` + dizionario inglese in `src/i18n/en/`
- `examples/` — la libreria di casi inclusi (oggi vuota; `tools/make-library.mjs`, specifiche in `tools/cases/library.mjs`); ogni caso è verificato dal solver. `test/fixtures/` contiene i pochi casi che usano test ed e2e. I seed in `tools/cases/seeds.json` portano un'impronta della specifica e del generatore: se cambi una specifica o le regole del generatore, un seed scade e va rigenerato (un test lo segnala)
- `sw.js`, `manifest.webmanifest`, `icons/` — PWA (la lista dei file in cache di `sw.js` si rigenera con `npm run build:sw`)
- `test/` — test senza framework: apri `test/test-runner.html` nel browser, oppure `npm test` da terminale

## Uso

### Creare un puzzle
1. Apri **Nuovo puzzle** dalla home.
2. Nel tab **Mappa**: imposta le dimensioni della griglia (righe e colonne possono essere diverse), crea stanze/zone colorate (seleziona una zona e clicca sulle celle per dipingerle), aggiungi oggetti dalla palette. Con **🚫 Blocca/sblocca cella** puoi escludere singole celle dalla mappa per ottenere forme personalizzate (a L, con buchi, irregolari): le celle bloccate non sono utilizzabili per zone, oggetti o personaggi. La griglia disegna automaticamente una parete spessa dove una stanza confina con un'altra zona (o con l'esterno), e mostra il nome della stanza una sola volta come etichetta esterna alla mappa (mai sopra le caselle dove segni le note), col colore della stanza accanto al nome. La maggior parte degli oggetti (scaffale, tavolo, lampada, pianta, televisore) blocca la cella — nessun personaggio può starci sopra; sedie e tappeti invece sono bassi/piatti e restano occupabili, e porte e finestre non occupano la cella (vedi sotto). **Pavimenti**: ogni stanza ha il suo pavimento (circa 25: parquet, listoni, scacchiere, marmo, cotto, moquette, erba, ghiaia, sabbia, mosaico, acqua…) scelto da una griglia di miniature sotto il suo swatch; il colore della stanza resta come tinta leggera, così due stanze con lo stesso pavimento si distinguono comunque. **Porte e finestre** stanno su UN lato della cella: scegli lo strumento, poi il **lato** (Nord/Est/Sud/Ovest) dai pulsanti che compaiono, e clicca sulle celle (puoi metterne più di una nella stessa cella, su lati diversi, e una persona può starci); con "accanto a una porta" conta anche chi sta nella cella della porta. La stampa mostra i colori delle stanze ma non i pavimenti.
3. Aggiungi i **personaggi** nel pannello a destra (uno va marcato come vittima). Ogni personaggio ha un colore distintivo (assegnato automaticamente, modificabile cliccando su uno degli swatch): lo stesso colore lo identifica ovunque — token sulla griglia, segni candidato, scheda indizi in gioco — per riconoscere i sospettati a colpo d'occhio. C'è anche un campo **genere** (non specificato di default), usato solo dagli indizi che ci fanno riferimento (es. "qualcun altro nella stanza era un uomo"). La professione/illustrazione (circa 55: medico, pilota, pirata, mago, astronauta…) si sceglie da una griglia di avatar a colori; di default ai nuovi personaggi viene assegnata a rotazione una diversa.
4. Per ogni personaggio aggiungi **indizi** dal menu a tendina. Sono più di quaranta tipi, in famiglie: posizione (stanza, riga/colonna, angolo, pari/dispari), vicinanza (accanto a, in diagonale, di fronte, adiacenza tra stanze o righe/colonne), orientamento (a nord/sud/est/ovest di, tra due bersagli, più vicino a uno che a un altro), oggetti (su un oggetto, seduto/a, davanti a una finestra) e relazioni con gli altri (nella stessa stanza di, sola con…, qualcun altro nella sua stanza era…, la persona più a nord/sud/est/ovest). Tre meccanismi si applicano a quasi tutti: la casella **no** inverte l'indizio (non servono tipi separati per le negazioni), **"o uno o l'altro"** ne combina due con un OR, e per i bersagli-oggetto puoi scegliere un'istanza specifica ("Porta (3,1)") oppure l'opzione generica "Qualsiasi porta". La maggior parte degli oggetti blocca la cella; solo sedie, sgabelli e tappeti sono occupabili (su un tappeto si sta in piedi, non seduti) e porte e finestre, sul bordo della cella, non bloccano nessuno. **Il significato esatto, la frase com'è scritta in gioco e un esempio per ogni tipo sono nel [Glossario degli indizi](glossary.html)**, la fonte di riferimento: questo README non li ripete.

   Da ricordare (il Glossario ha il dettaglio di ogni tipo):

   - **"È accanto a"** e le sue varianti valgono solo se i due stanno nella stessa stanza: chi sta oltre il muro non conta. Fa eccezione il bersaglio-stanza (nell'elenco dei bersagli, segnato "(stanza)"): "accanto a una stanza" è vero **fuori** dalla stanza, in una cella che tocca uno dei suoi muri. "In una stanza adiacente a" accetta come bersaglio anche un personaggio o un oggetto, risolto in fase di soluzione.
   - Gli indizi con una "proprietà" (qualcun altro nella stanza è…, la persona più a nord/sud/est/ovest, sola con qualcuno che è…, c'è qualcuno a N righe/colonne…) hanno l'opzione **"che soddisfaceva un'altra condizione…"**, in cui annidi un indizio qualsiasi con i suoi parametri.
   - In cima alla sezione Indizi, **🔎 Indizi generali del caso** raccoglie i fatti sulla scena non legati a un personaggio: nessuno (o esattamente una persona) in una stanza o riga/colonna, nessuno accanto a un bersaglio, stanze piene o vuote, stanze con lo stesso numero di caselle, "nessuno che è… " con filtro "Tra" (chiunque, uomini, donne).
   - **Tempo verbale:** un menu accanto a titolo, autore e difficoltà imposta presente, passato o futuro per tutti gli indizi del caso (cambia le parole, non il significato; vale anche in gioco, stampa e glossario). Il lessico è uniforme: sempre "accanto a", mai "vicino a".
   - I **vecchi tipi di indizio** ("non è accanto a", "è a nord di", "sola con la vittima"…) non esistono più: si ottengono con la casella "no" o con gli indizi generali, e i casi salvati o importati vengono convertiti da soli (`src/model/migrations.js`, passo 3→4).
5. Passa al tab **Soluzione**: seleziona un personaggio e clicca sulla cella dove va piazzato nella soluzione corretta (niente righe/colonne condivise).
6. Clicca **Valida soluzione** per controllare che la soluzione rispetti tutti gli indizi, e **Verifica unicità** per controllare che non ci siano soluzioni alternative — se il puzzle è ambiguo, sotto il messaggio compare una piccola griglia di anteprima per ciascuna soluzione alternativa trovata (fino a 24), per capire a colpo d'occhio dove differiscono. Se ne esistono più di 24, il messaggio lo dice esplicitamente ("almeno N soluzioni") invece di far credere che la lista mostrata sia completa.
7. **Salva**, **Esporta JSON** per condividere il file, o **Stampa** per una versione cartacea. Il pulsante **🗑 Elimina** rimuove definitivamente il caso corrente (con richiesta di conferma); **📋 Duplica** crea una copia indipendente del caso (utile come base per un nuovo puzzle) senza toccare l'originale.

   Per condividere un caso con un link diretto (invece di far scaricare e importare manualmente il JSON esportato) basta mettere il file `.murdoku.json` online accanto al sito e mandare `player.html?import=<url-del-file>` — apre il caso e comincia subito a giocarlo. Rivisitare lo stesso link non cancella mai i progressi già fatti.
8. Apri il pannello **📖 Dossier del caso** (sopra la griglia) per scrivere un testo introduttivo mostrato al giocatore prima degli indizi, e una nota di chiusura mostrata insieme alla rivelazione dell'assassino. Ogni personaggio può avere anche una piccola bio narrativa, nella sua scheda.
9. **↶ Annulla** / **↷ Ripeti** nella barra degli strumenti disfano/rifanno le modifiche alla mappa, ai personaggi, agli indizi e alla soluzione (non i campi di testo libero come titolo o dossier, che si salvano direttamente). Se elimini una zona o un oggetto referenziato da un indizio, l'indizio viene ripulito automaticamente invece di restare "appeso".
10. Imposta la **difficoltà** del caso (accanto a titolo e autore): compare come badge colorato ovunque il puzzle sia elencato, e permette di ordinare gli elenchi.

La griglia mostra sempre le etichette di riga/colonna (R1, R2… / C1, C2…) sia in editor sia in gioco sia in stampa.

### Giocare
Apri **Gioca**, scegli un caso salvato (gli elenchi si possono ordinare per aggiornamento, titolo o difficoltà; i casi già risolti hanno un segno ✓), e seleziona un personaggio (o lo strumento X, o la gomma) dalla toolbar. Sulla griglia, il gesto decide cosa succede: un **clic/tocco rapido** su una cella segna o toglie una nota (candidato) per il personaggio selezionato, senza confermarlo; **tenere premuto fermo** su una cella per circa un secondo (una rotella si riempie) conferma lì il personaggio — e cancella automaticamente tutte le sue note esistenti su tutta la griglia, dato che il dubbio è ormai risolto; **tenere premuto e trascinare** su più celle applica lo strumento a tutte in un solo passaggio (utile anche per segnare X o cancellare più celle di fila) invece di ripetere il gesto una per una. Da tastiera: Invio/Spazio equivalgono al clic (nota), Maiusc+Invio equivale al tenere premuto (piazza). Confermare un personaggio segna automaticamente una X sul resto della sua riga/colonna, dato che nessun altro può stare lì. Tenere premuto di nuovo sulla cella in cui hai già confermato quel personaggio lo rimuove (e ritira anche le X automatiche insieme a lui); spostarlo direttamente su un'altra cella libera fa lo stesso con la vecchia posizione. Un cronometro in alto mostra il tempo trascorso, e si ferma quando risolvi il caso. **Pulisci tutto** richiede di **tenere premuto** il pulsante, per evitare di cancellare tutto per sbaglio. Usa **Annulla**, poi **Verifica soluzione**: dice solo se il caso è completamente risolto o no, senza rivelare quante posizioni sono già giuste (altrimenti si potrebbe indovinare per tentativi invece che dedurre dagli indizi). Man mano che confermi un personaggio sulla griglia, la sua scheda nel pannello indizi si affievolisce, come un nome depennato dalla lista dei sospettati; passando il mouse (o il focus) sul suo chip nella toolbar, o su una singola riga di indizio nella sua scheda, si evidenziano temporaneamente sulla griglia le caselle a cui quell'indizio fa riferimento; cliccando il chip la scheda si evidenzia invece in modo stabile con un anello del suo colore e, sulla griglia, restano evidenziate in oro TUTTE le caselle a cui i suoi indizi fanno riferimento (una stanza intera, tutte le piante, una riga…; gli indizi puramente geometrici, come "in un angolo", non hanno caselle da mostrare). Il passaggio del mouse sul chip mostra invece solo le caselle compatibili con tutti i suoi indizi insieme.

**Note sulla griglia:** ogni nota è un dischetto color carta con l'iniziale del personaggio e un anello del suo colore, leggibile su qualsiasi pavimento; in una casella con un oggetto (tappeto, sedia, sgabello) il disegno si rimpicciolisce in alto e le note stanno in una fascia sotto, mai sopra. Cliccando su un'etichetta di **riga (R1…) o colonna (C1…)**, sul bordo esterno della griglia, segni una nota per l'intera riga/colonna (la gomma le cancella; confermare un personaggio cancella le sue note di riga/colonna). Ogni stanza ha il **nome scritto sopra**, in una linguetta in alto a sinistra della sua prima casella libera, e le caselle sono divise da una **griglia nera** (più spessa tra una stanza e l'altra). A destra della griglia, la colonna con il caso e gli indizi **resta visibile mentre scorri** e, scegliendo un personaggio (anche col tasto 1-9), porta in cima la sua scheda.

Il pulsante **💡 Suggerimento** calcola una catena di deduzioni vere dagli indizi (non dalla risposta salvata dall'autore), rispettando quanto hai già confermato: evidenzia una cella e spiega il perché, con **‹ ›** per scorrere avanti/indietro tra i passi della catena se ce n'è più di uno. Ogni passo mostra anche un riquadro **"Perché"** con l'elenco degli indizi specifici che rendono quella deduzione certa (a volte l'indizio di un *altro* personaggio, non solo del suo) — o una nota quando la deduzione dipende dalla combinazione di più indizi insieme, senza che nessuno da solo basti. Se un piazzamento attuale è in conflitto con gli indizi, il messaggio nomina l'indizio esatto violato, non solo "il piazzamento sembra sbagliato". Anche quando il puzzle ha troppe poche informazioni per un'enumerazione completa delle soluzioni, il motore prova comunque tecniche più leggere prima di arrendersi — spesso trova comunque qualche piazzamento certo prima di dover dire "troppe possibilità". Oltre a ragionare personaggio per personaggio, riconosce anche interazioni strutturali tra più sospettati (l'equivalente Murdoku delle "coppie/triple nascoste" del Sudoku): se un gruppo di personaggi può stare solo in un gruppo altrettanto piccolo di celle, nessun altro può occuparle, anche senza un indizio diretto che lo dica — in questi casi il passo mostra un riquadro aggiuntivo **"Interazione tra personaggi"** sotto il "Perché", con i nomi coinvolti e le celle in questione. La ricerca esaustiva usa anche un pruning "guarda avanti" (forward checking) per scartare rami senza soluzione molto più rapidamente. Un click su Suggerimento può impiegare fino a qualche secondo nei casi più complessi, per dare priorità alla profondità della deduzione piuttosto che alla velocità. Segnala che un personaggio *non può* stare in una cella solo se ce l'hai già segnato come candidato lì in modalità Note: è vero anche altrove, ma dirtelo solo dove serve (una nota da cancellare) invece che ovunque sia tecnicamente vero evita di sommergerti di ovvietà.

### Modalità campagna
Dalla home, **🕵️ Modalità Campagna** porta a una sequenza di casi giocati in ordine: risolvere un caso sblocca il successivo. Richiede l'accesso con un account Google (solo per questa modalità — editor e gioco libero restano senza login), e sincronizza i progressi (piazzamenti, note, segni X, casi completati) su Firestore: puoi lasciare un caso a metà su un dispositivo e ritrovarlo identico accedendo con lo stesso account da un altro. Un caso già completato resta comunque rigiocabile/ripulibile, come nel gioco libero. Un link diretto a un caso specifico (`campaign.html?campaign=<id>&case=<id>`) funziona anche prima di aver fatto login: chiede l'accesso e poi apre subito quel caso.

**Indizi nascosti (campagne a storia):** nell'editor campagne ogni caso (dal secondo in poi) ha un pannello **🔒 Indizi nascosti**: per ogni indizio del caso scegli «Sempre visibile» oppure «Dopo il caso N» (un caso precedente). Finché il giocatore non risolve quel caso, nelle carte indizio compare un lucchetto («🔒 Indizio nascosto: risolvi «…» per scoprirlo») al posto dell'indizio, e i suggerimenti usano solo gli indizi visibili; risolvendo il caso, la schermata finale dice quali indizi ha rivelato nei casi successivi. Serve per una storia in cui ogni caso consegna una prova al caso finale. La regola vive nella campagna (non nel file del caso, che continua a funzionare da solo) e la verifica della soluzione usa sempre il caso completo. Una regola che non può avverarsi (il caso che rivela l'indizio è dopo, o non esiste più) viene ignorata: l'indizio si vede, mai un caso irrisolvibile.

Le campagne si creano solo dall'apposito **editor campagne** (`campaign-editor.html`), riservato al proprietario del sito: vi si crea una campagna (titolo, descrizione) e vi si aggiungono i casi incollando l'URL di un `.murdoku.json` già pubblicato (lo stesso meccanismo usato per condividere un caso singolo via link — vedi sopra), riordinandoli con ↑/↓.

#### Chi può gestire le campagne

L'UID storico del proprietario resta scritto in `firestore.rules` (così un errore di configurazione non può mai chiuderti fuori). Per dare lo stesso permesso a un'altra persona basta, nella console Firebase → Firestore, creare un documento **`admins/<uid>`** (l'UID è quello dell'account Google in Authentication → Utenti; il contenuto del documento è indifferente). I client non possono scrivere in `admins`. Dopo aver modificato `firestore.rules`, pubblicale con *Firestore → Regole → Pubblica* (o `firebase deploy --only firestore:rules`).

### Tema scuro
L'icona 🌙/☀️ in alto a destra (home, editor, gioca) passa dal tema chiaro a quello scuro; la scelta viene ricordata per le visite successive. La vista di stampa resta sempre chiara, per corrispondere a ciò che esce dalla stampante.

### Eliminare un caso
Sia nella home sia nella schermata di selezione di **Gioca**, ogni caso salvato ha un pulsante **🗑** che lo elimina definitivamente (dopo conferma). È disponibile anche dentro l'editor, per eliminare il caso che si sta modificando.

Con **✏️ Note** attivo, selezionare un personaggio e cliccare una cella lo segna come candidato invece di confermarlo: ogni personaggio occupa una posizione fissa in una mini-griglia 3x3 dentro la cella (come le matite del sudoku), quindi puoi segnare più candidati per cella. Confermare un piazzamento su una cella ne ripulisce i candidati; la gomma cancella candidati/segni X/personaggi confermati.

I progressi in modalità Gioca (piazzamenti confermati, segni X, candidati, e se la modalità Note era attiva) si salvano automaticamente per ogni caso, separatamente dal caso stesso — uscendo da un caso (chiudendo la scheda, ricaricando, tornando alla scelta del caso) e rientrando più tardi ritrovi tutto esattamente come l'avevi lasciato. **🧹 Pulisci tutto** azzera anche questo; eliminare il caso stesso ripulisce i progressi salvati insieme ad esso.

## Formato file

Un puzzle esportato è un JSON con `grid` (dimensioni, celle, zone, oggetti), `characters`, `clues` (tipizzati) e `solution.placements`. Vedi `src/model/puzzle.js` per la forma esatta.

## Sviluppo e test

Il sito **non ha build**: `package.json` serve solo agli strumenti di sviluppo.

```bash
npm install
npm test          # 400+ test sotto Node + controllo che sw.js sia aggiornato
npm run lint      # ESLint
npm run format    # Prettier (solo controllo; `npx prettier --write` per correggere)
npm run i18n      # elenca le stringhe senza traduzione inglese (--strict per far fallire)
npm run e2e:all   # test nel browser (Playwright): gioca un caso di prova (`test/fixtures`) in IT/EN, controllo accessibilità (axe) su 5 pagine in tema chiaro e scuro, percorso dell'autore nell'editor, gesti di gioco (nota, pressione lunga, annulla, ripresa dopo il ricaricamento, suggerimenti graduali)
npm run check:size  # nessun file tracciato oltre 1 MB
npm run make:library  # rigenera i casi in examples/library/ e l'indice examples/library.json (oggi vuoti; ogni caso è verificato dal solver)
npm run build:sw  # rigenera la lista di file in cache del service worker
```

I test girano anche nel browser: apri `test/test-runner.html` dal server statico locale. La CI (GitHub Actions) esegue lint, formattazione, test, controllo dimensioni ed e2e a ogni push. Se in Impostazioni → Pages la sorgente è «GitHub Actions», il sito si pubblica solo dopo che la CI è passata (`.github/workflows/pages.yml`); `test/` e `tools/` non vengono pubblicati.

**Aggiungere o cambiare testi:** scrivi il testo in italiano dentro `t("…")` (con segnaposto `{nome}`), poi aggiungi la voce inglese in `src/i18n/en/`. L'HTML statico si traduce da solo: basta aggiungere la voce al dizionario.

**Cambiare il formato dei casi:** aggiungi una funzione in `src/model/migrations.js`; i casi salvati o importati con una versione precedente vengono aggiornati al volo, quelli di una versione futura vengono rifiutati con un messaggio chiaro.
