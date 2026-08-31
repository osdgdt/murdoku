# Murdoku Editor

🌐 **Gioca online:** [osdgdt.github.io/murdoku](https://osdgdt.github.io/murdoku/) — nessuna installazione richiesta, funziona direttamente nel browser.

Editor e player per puzzle **Murdoku**: un ibrido tra Sudoku e deduzione investigativa. Su una griglia si piazzano personaggi (uno per riga/colonna) rispettando indizi legati a una mappa con stanze, zone colorate e oggetti; una vittima va piazzata anch'essa, e a fine gioco si rivela l'assassino.

Una regola base, sempre valida, non aggirabile con indizi: **la vittima si trova sempre in una stanza con esattamente un'altra persona**, e quella persona è l'assassino. Non basta un indizio a definirlo: è imposto ovunque (validazione, solver, suggerimenti) — un piazzamento con la vittima da sola o con due o più persone nella sua stanza non è mai una soluzione valida. Righe e colonne vuote sono invece del tutto ammesse (non serve un personaggio per ognuna): se vuoi che restino vuote in una soluzione specifica, basta dirlo con un indizio generale ("nessuno era nella riga/colonna X").

L'editor segnala la violazione di questa regola in **✓ Valida soluzione**, e il solver non troverà mai né suggerirà mai un piazzamento che la infrange.

App web statica, senza backend né build: HTML/CSS/JS con ES modules.

## Avvio in locale

I moduli ES (`import`/`export`) non funzionano aprendo i file direttamente da `file://` in Chrome — serve un piccolo server statico. Nella cartella del progetto:

```bash
python -m http.server 8000
```

oppure, se hai Node:

```bash
npx serve .
```

Poi apri `http://localhost:8000` nel browser.

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
- `test/` — test senza framework: apri `test/test-runner.html` nel browser

## Uso

### Creare un puzzle
1. Apri **Nuovo puzzle** dalla home.
2. Nel tab **Mappa**: imposta le dimensioni della griglia (righe e colonne possono essere diverse), crea stanze/zone colorate (seleziona una zona e clicca sulle celle per dipingerle), aggiungi oggetti dalla palette. Con **🚫 Blocca/sblocca cella** puoi escludere singole celle dalla mappa per ottenere forme personalizzate (a L, con buchi, irregolari): le celle bloccate non sono utilizzabili per zone, oggetti o personaggi. La griglia disegna automaticamente una parete spessa dove una stanza confina con un'altra zona (o con l'esterno), e mostra il nome della stanza una sola volta come etichetta esterna alla mappa (mai sopra le caselle dove segni le note), col colore della stanza accanto al nome. La maggior parte degli oggetti (scaffale, tavolo, lampada, porta, finestra, pianta, televisore) blocca la cella — nessun personaggio può starci sopra; sedie e tappeti invece sono bassi/piatti e restano occupabili.
3. Aggiungi i **personaggi** nel pannello a destra (uno va marcato come vittima). Ogni personaggio ha un colore distintivo (assegnato automaticamente, modificabile cliccando su uno degli swatch): lo stesso colore lo identifica ovunque — token sulla griglia, segni candidato, scheda indizi in gioco — per riconoscere i sospettati a colpo d'occhio. C'è anche un campo **genere** (non specificato di default), usato solo dagli indizi che ci fanno riferimento (es. "qualcun altro nella stanza era un uomo").
4. Per ogni personaggio aggiungi **indizi** dal menu a tendina: "è accanto a", "è in diagonale rispetto a", "si trova su un oggetto di un certo tipo" (es. un tappeto), "era seduto/a" (su una sedia, uno sgabello, o qualunque altro oggetto occupabile, senza doverne scegliere uno — diverso da "si trova su un oggetto di un certo tipo", che richiede di specificare quale), "si trova tra due bersagli", "è a nord/sud/est/ovest di" (a distanza esatta o generica), "si trova nella stanza", "si trova nella riga/colonna N", "si trova in una riga/colonna pari/dispari", "si trova nella stessa stanza di", "è l'unica persona vicino a", "è sola nella stanza" (eventualmente una specifica), "è sola con (un personaggio a scelta) nella stanza", "condivide riga/colonna con" (personaggio o oggetto), "è di fronte a", "si trova in un angolo" (della mappa) / "si trova in un angolo della sua stanza" (della stanza in cui si trova, qualunque forma abbia — anche irregolare — e ovunque sia sulla mappa), "è più vicino a un bersaglio che a un altro", "qualcun altro nella sua stanza era..." (accanto a/uomo/donna/seduto su un certo tipo di oggetto/seduto su qualunque oggetto occupabile), "è la persona più a nord/sud/est/ovest" (su tutta la mappa o nella sua stanza, eventualmente solo tra chi aveva una certa proprietà), "c'è qualcuno a N righe/colonne a nord/sud/est/ovest di lui/lei" (a distanza esatta o generica, senza dover indicare chi), "si trova in una stanza adiacente a", "si trova in una riga/colonna adiacente a" (non la stessa: quella subito accanto), "condivide riga/colonna con uno tra più bersagli" (scegline diversi tenendo premuto Ctrl/Cmd), "è sola con qualcuno che era..." (un uomo, seduto su un certo oggetto, ecc.), e **"o uno o l'altro"**: un indizio composto che combina due indizi qualsiasi con un OR (es. "si trova sul tappeto, oppure è accanto alla pianta") — scegli un tipo e i suoi parametri per ciascuno dei due rami, esattamente come faresti per un indizio normale. Ogni riga ha anche una casella **no**, che inverte l'indizio nel suo opposto — non serve un tipo separato per ogni negazione: per esempio "non era nella riga/colonna di X" si ottiene da "condivide riga/colonna con" (o "è di fronte a", se non vuoi specificare l'asse) più la casella "no", e "non era in una riga/colonna adiacente a X" da "si trova in una riga/colonna adiacente a" più "no". Per gli indizi che si riferiscono a un oggetto, oltre a scegliere un'istanza specifica (es. "Porta (3,1)") puoi scegliere l'opzione generica "Qualsiasi porta": l'indizio sarà soddisfatto se il personaggio è vicino a una qualunque porta della mappa, senza dover indicare quale. La maggior parte degli oggetti non è occupabile da personaggi (nessuno può stare sopra uno scaffale o un tavolo); sedie, sgabelli e tappeti fanno eccezione.

   Ovunque scegli un "bersaglio" tra personaggio/oggetto (es. "è accanto a", "è di fronte a", "condivide riga/colonna con", "è più vicino a"), nell'elenco trovi anche le **stanze** (segnate "(stanza)"): "è accanto a" una stanza è vero se ci si trova in una cella adiacente a una qualunque delle sue caselle, anche senza trovarsi in nessuna stanza in particolare — utile per indizi come "era accanto al bagno" senza dover indicare quale personaggio o oggetto specifico. Vale anche al contrario per "si trova in una stanza adiacente a": oltre a scegliere direttamente una stanza fissa, puoi scegliere un personaggio o un oggetto come bersaglio — l'indizio sarà vero se la propria stanza confina con quella in cui **quel** bersaglio finisce per trovarsi (risolta dinamicamente in fase di soluzione, non fissata a priori).

   Gli indizi con una "proprietà" (qualcun altro nella stanza era..., è la persona più a nord/ecc..., è sola con qualcuno che era..., c'è qualcuno a N righe/colonne di lui/lei...) hanno anche l'opzione **"che soddisfaceva un'altra condizione..."**: invece di scegliere tra le proprietà fisse (uomo/donna/accanto a/seduto su), annidi lì un indizio qualsiasi, con i suoi parametri — per esempio "c'è qualcuno a 2 righe a nord di lei" + condizione "si trova in una stanza adiacente al bagno" dà "c'era qualcuno due righe a nord di lei in una zona adiacente al bagno".

   In cima alla sezione **Indizi** trovi anche **🔎 Indizi generali del caso**: fatti sulla scena non legati a un personaggio specifico — "nessuno si trova nella stanza X", "nessuno si trova nella riga/colonna N", "esattamente una persona si trova nella stanza X", "nessuno è vicino a X", "due personaggi nominati si trovano nella stessa stanza", "N stanze erano piene/vuote", "N stanze erano vuote, con lo stesso numero di caselle" (es. "esattamente 2 stanze erano vuote e avevano lo stesso numero di caselle" — diverso da "le stanze di due bersagli...", perché qui non scegli tu quali stanze, sono "le vuote" qualunque esse siano), "le stanze di due bersagli avevano lo stesso numero di caselle", "nessuno che era... (un uomo, seduto su un certo oggetto...) si trovava [ovunque o in una stanza specifica]" — quest'ultimo ha anche un filtro **"Tra"** (chiunque/solo uomini/solo donne) da combinare con la proprietà scelta, per indizi come "nessuna donna era seduta su uno sgabello". Utile per indizi che descrivono la scena del crimine in generale invece che il punto di vista di un sospettato.
5. Passa al tab **Soluzione**: seleziona un personaggio e clicca sulla cella dove va piazzato nella soluzione corretta (niente righe/colonne condivise).
6. Clicca **Valida soluzione** per controllare che la soluzione rispetti tutti gli indizi, e **Verifica unicità** per controllare che non ci siano soluzioni alternative — se il puzzle è ambiguo, sotto il messaggio compare una piccola griglia di anteprima per ciascuna soluzione alternativa trovata (fino a 24), per capire a colpo d'occhio dove differiscono. Se ne esistono più di 24, il messaggio lo dice esplicitamente ("almeno N soluzioni") invece di far credere che la lista mostrata sia completa.
7. **Salva**, **Esporta JSON** per condividere il file, o **Stampa** per una versione cartacea. Il pulsante **🗑 Elimina** rimuove definitivamente il caso corrente (con richiesta di conferma); **📋 Duplica** crea una copia indipendente del caso (utile come base per un nuovo puzzle) senza toccare l'originale.
8. Apri il pannello **📖 Dossier del caso** (sopra la griglia) per scrivere un testo introduttivo mostrato al giocatore prima degli indizi, e una nota di chiusura mostrata insieme alla rivelazione dell'assassino. Ogni personaggio può avere anche una piccola bio narrativa, nella sua scheda.
9. **↶ Annulla** / **↷ Ripeti** nella barra degli strumenti disfano/rifanno le modifiche alla mappa, ai personaggi, agli indizi e alla soluzione (non i campi di testo libero come titolo o dossier, che si salvano direttamente). Se elimini una zona o un oggetto referenziato da un indizio, l'indizio viene ripulito automaticamente invece di restare "appeso".
10. Imposta la **difficoltà** del caso (accanto a titolo e autore): compare come badge colorato ovunque il puzzle sia elencato, e permette di ordinare gli elenchi.

La griglia mostra sempre le etichette di riga/colonna (R1, R2… / C1, C2…) sia in editor sia in gioco sia in stampa.

### Giocare
Apri **Gioca**, scegli un caso salvato (gli elenchi si possono ordinare per aggiornamento, titolo o difficoltà; i casi già risolti hanno un segno ✓), seleziona un personaggio (o lo strumento X) e clicca sulle celle della griglia per piazzarlo. Confermare un personaggio segna automaticamente una X sul resto della sua riga/colonna, dato che nessun altro può stare lì. Cliccare di nuovo la cella in cui hai già confermato quel personaggio lo rimuove (e ritira anche le X automatiche insieme a lui); spostarlo direttamente su un'altra cella libera fa lo stesso con la vecchia posizione. Un cronometro in alto mostra il tempo trascorso, e si ferma quando risolvi il caso. **Pulisci tutto** ora richiede di **tenere premuto** il pulsante, per evitare di cancellare tutto per sbaglio. Usa **Annulla**, poi **Verifica soluzione**: dice solo se il caso è completamente risolto o no, senza rivelare quante posizioni sono già giuste (altrimenti si potrebbe indovinare per tentativi invece che dedurre dagli indizi). Man mano che confermi un personaggio sulla griglia, la sua scheda nel pannello indizi si affievolisce, come un nome depennato dalla lista dei sospettati; cliccando il suo chip nella toolbar la scheda si evidenzia invece con un anello del suo colore, per trovare subito tutti i suoi indizi.

Con uno strumento selezionato (personaggio in modalità note, X, o gomma) puoi **trascinare il mouse** su più celle per applicarlo a tutte in un solo passaggio, invece di cliccarle una per una; un semplice click continua a funzionare come prima (es. su una X già segnata, la toglie).

Il pulsante **💡 Suggerimento** calcola una catena di deduzioni vere dagli indizi (non dalla risposta salvata dall'autore), rispettando quanto hai già confermato: evidenzia una cella e spiega il perché, con **‹ ›** per scorrere avanti/indietro tra i passi della catena se ce n'è più di uno. Ogni passo mostra anche un riquadro **"Perché"** con l'elenco degli indizi specifici che rendono quella deduzione certa (a volte l'indizio di un *altro* personaggio, non solo del suo) — o una nota quando la deduzione dipende dalla combinazione di più indizi insieme, senza che nessuno da solo basti. Se un piazzamento attuale è in conflitto con gli indizi, il messaggio nomina l'indizio esatto violato, non solo "il piazzamento sembra sbagliato". Anche quando il puzzle ha troppe poche informazioni per un'enumerazione completa delle soluzioni, il motore prova comunque tecniche più leggere prima di arrendersi — spesso trova comunque qualche piazzamento certo prima di dover dire "troppe possibilità". Oltre a ragionare personaggio per personaggio, riconosce anche interazioni strutturali tra più sospettati (l'equivalente Murdoku delle "coppie/triple nascoste" del Sudoku): se un gruppo di personaggi può stare solo in un gruppo altrettanto piccolo di celle, nessun altro può occuparle, anche senza un indizio diretto che lo dica — in questi casi il passo mostra un riquadro aggiuntivo **"Interazione tra personaggi"** sotto il "Perché", con i nomi coinvolti e le celle in questione. La ricerca esaustiva usa anche un pruning "guarda avanti" (forward checking) per scartare rami senza soluzione molto più rapidamente. Un click su Suggerimento può impiegare fino a qualche secondo nei casi più complessi, per dare priorità alla profondità della deduzione piuttosto che alla velocità. Segnala che un personaggio *non può* stare in una cella solo se ce l'hai già segnato come candidato lì in modalità Note: è vero anche altrove, ma dirtelo solo dove serve (una nota da cancellare) invece che ovunque sia tecnicamente vero evita di sommergerti di ovvietà.

### Tema scuro
L'icona 🌙/☀️ in alto a destra (home, editor, gioca) passa dal tema chiaro a quello scuro; la scelta viene ricordata per le visite successive. La vista di stampa resta sempre chiara, per corrispondere a ciò che esce dalla stampante.

### Eliminare un caso
Sia nella home sia nella schermata di selezione di **Gioca**, ogni caso salvato ha un pulsante **🗑** che lo elimina definitivamente (dopo conferma). È disponibile anche dentro l'editor, per eliminare il caso che si sta modificando.

Con **✏️ Note** attivo, selezionare un personaggio e cliccare una cella lo segna come candidato invece di confermarlo: ogni personaggio occupa una posizione fissa in una mini-griglia 3x3 dentro la cella (come le matite del sudoku), quindi puoi segnare più candidati per cella. Confermare un piazzamento su una cella ne ripulisce i candidati; la gomma cancella candidati/segni X/personaggi confermati.

I progressi in modalità Gioca (piazzamenti confermati, segni X, candidati, e se la modalità Note era attiva) si salvano automaticamente per ogni caso, separatamente dal caso stesso — uscendo da un caso (chiudendo la scheda, ricaricando, tornando alla scelta del caso) e rientrando più tardi ritrovi tutto esattamente come l'avevi lasciato. **🧹 Pulisci tutto** azzera anche questo; eliminare il caso stesso ripulisce i progressi salvati insieme ad esso.

## Formato file

Un puzzle esportato è un JSON con `grid` (dimensioni, celle, zone, oggetti), `characters`, `clues` (tipizzati) e `solution.placements`. Vedi `src/model/puzzle.js` per la forma esatta.

## Test

Apri `test/test-runner.html` nel browser (servito dal server statico locale) per eseguire i test su modello dati e solver.
