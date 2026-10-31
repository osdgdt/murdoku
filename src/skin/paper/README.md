# Skin "Carta ritagliata" — guida per chi disegna

Tutto ciò che l'app mostra come *disegno* vive in questa cartella. Il resto del
codice sa solo **quali** oggetti e personaggi esistono (id, nome, regole di
gioco, in `src/model/icons.js`), non **come** appaiono: sostituire un disegno
significa cambiare una stringa SVG qui, senza toccare altro.

| File | Cosa contiene |
|---|---|
| `objects.js` | I 10 oggetti (`shelf, plant, carpet, chair, stool, table, lamp, door, window, tv`) |
| `characters.js` | I 12 ritratti selezionabili + la vittima (`victim`) |
| `rooms.js` | Dai pastelli salvati nell'editor ai colori dei "fogli di carta" delle stanze |
| `logo.js`, `ui-icons.js` | Marchio, icone delle card della home, scena dell'intestazione |
| `defs.js` | Il filtro SVG condiviso (ombra morbida sotto ogni strato di carta) |
| `../../../styles/skin-paper.css` | Colori, tema chiaro/scuro, bottoni, carte, mappa |

## Convenzioni per gli SVG

- `viewBox="0 0 64 64"`, disegno centrato; ogni oggetto è una pila di **strati piatti** (`L(forma, colore)`), ognuno con la propria ombra.
- **Oggetti:** colori propri (devono leggersi su qualunque stanza e in tema chiaro/scuro). Il tipo `carpet`, `chair` e `stool` sono *occupabili*: un personaggio può starci sopra, quindi il disegno non deve nascondere la pedina.
- **Personaggi:** adesivo fustellato con bordo bianco; il **corpo usa `currentColor`** (il colore del personaggio, impostato via CSS `color` sul contenitore), la testa e gli accessori hanno colori propri. Ogni personaggio deve distinguersi dagli altri **anche senza il colore** (capelli, copricapo, accessori): è ciò che rende il gioco leggibile con il daltonismo.
- Devono restare riconoscibili a **20 px** (chip della barra) e a 84 px (mappa).
- Nessun testo dentro gli SVG (le traduzioni stanno altrove) e nessun `id` proprio: gli id duplicati nella pagina rompono i riferimenti.

## Come sostituire il set con quello di un illustratore

1. Consegna: un SVG per oggetto e per personaggio con le convenzioni sopra.
2. Incolla il contenuto interno di ogni SVG nella voce corrispondente (o importa i file come stringhe) in `objects.js` / `characters.js`.
3. `npm test` controlla che ogni id abbia un disegno, che i tag siano bilanciati e che i corpi usino `currentColor`; `npm run e2e:a11y` controlla i contrasti della pagina.
