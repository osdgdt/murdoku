# Prova con un lettore di schermo (a mano)

I controlli automatici (axe, `test/e2e/a11y-keyboard.mjs`, `test/test-contrast.js`) verificano l'albero di accessibilità, le regioni live e i contrasti, ma **non sostituiscono un lettore di schermo vero**. Questa lista serve a provare il gioco con NVDA (Windows), VoiceOver (macOS/iOS) o TalkBack (Android) e a segnalare cosa non torna.

Prima di cominciare: apri `player.html`, scegli un caso (il tutorial va bene) e, se vuoi, prova anche con il tema **ad alto contrasto** (pulsante del tema in alto: chiaro → scuro → alto contrasto).

## Cosa dovresti sentire

1. **Arrivo sulla pagina:** il titolo del caso, poi la barra «Personaggi e strumenti» (una sola tappa con Tab; frecce destra/sinistra per scorrere i personaggi; «Selezionato»/«premuto» sul personaggio scelto).
2. **Scelta di un personaggio** (Invio, o i tasti 1-9): «Anna selezionato. Indizi: …» letto in automatico.
3. **La griglia:** una sola tappa con Tab. Le frecce si muovono tra le caselle (saltano quelle bloccate; dalla prima riga si sale alle etichette delle colonne). Ogni casella dice «Riga 2, colonna 3, stanza Cucina: vuota» oppure chi c'è, la X, le note, i mobili e le porte/finestre.
4. **Azioni da tastiera:** Invio = nota (o X/gomma secondo lo strumento); Maiusc+Invio = piazza il personaggio selezionato; Home/Fine/PagSu/PagGiù e Ctrl+Home/Fine per spostarsi in fretta. Dopo ogni azione il **focus resta sulla casella** e senti una frase: «Anna piazzato in riga 2, colonna 3», «Nota Bruno aggiunta…», «X segnata…».
5. **Suggerimento (H o il pulsante):** «Sto calcolando un suggerimento…», e su griglie grandi ogni 10 secondi «Ancora in calcolo: N secondi»; il pulsante **Annulla** compare accanto. A fine calcolo senti il testo del suggerimento; con `‹ ›` («Passo precedente/successivo») si scorrono i passi.
6. **Verifica soluzione:** se non è tutto corretto senti «Non è ancora tutto corretto…» (senza dire quante caselle sono giuste). Se è corretto, senti «Caso risolto! L'assassino è … Tempo …» e il **focus passa alla regione «Caso risolto»**.
7. **Scheda in background:** se cambi scheda mentre calcola, il titolo diventa «✓ Suggerimento pronto — …» e torna normale quando rientri.

## Cosa segnalare

- Una casella che non dice cosa contiene, o che lo dice male.
- Il focus che torna all'inizio della pagina dopo un'azione.
- Frasi doppie, troppo lunghe, o mute (nessun annuncio dopo una mossa).
- Elementi che non si raggiungono da tastiera, o che richiedono il mouse (il «Pulisci tutto» si fa tenendo premuto Invio o Spazio).
- Nel tema ad alto contrasto: qualunque testo poco leggibile, o un'informazione che si capiva solo dal colore.

Scrivi cosa hai usato (lettore, browser, sistema) e dove si è verificato.
