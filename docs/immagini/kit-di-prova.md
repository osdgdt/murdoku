# Kit di prova per le immagini (personaggi, oggetti, pavimenti)

Scopo: provare **più stili** con siti di generazione di immagini **gratuiti**, confrontarli sugli stessi soggetti e scegliere. Solo dopo si
produce tutto. Questo file dice **cosa serve**, **come chiederlo** e **come consegnarmelo**.

> Le informazioni sui siti sono quelle che conosco io (possono essere superate): prima di usare un'immagine controlla la licenza e le
> condizioni del piano gratuito sul sito. Vedi «Licenze» in fondo.

## 1. Cosa serve

Tutto quello che usano i 9 casi esiste già nell'app (stile «Carta ritagliata»): le immagini nuove **sostituiscono** i disegni di oggi,
oppure ne danno una seconda versione. Oggi sono SVG nel codice (leggeri, seguono i temi); con immagini raster cambiano peso e colori,
vedi «Dopo la scelta dello stile».

### 1.1 Per i 9 casi: 27 oggetti + 4 «di bordo» + 32 personaggi + 26 pavimenti

**Oggetti (27)** — un disegno singolo, quadrato:
altare `altar`, incudine `anvil`, armatura `armor`, stendardo `banner`, botte `barrel`, letto `bed`, panca `bench`, gabbia `cage`,
candelabro `candelabrum`, tappeto `carpet`, carro `cart`, calderone `cauldron`, sedia `chair`, baule `chest`, camino `fireplace`,
lapide `gravestone`, leggio `lectern`, pagliericcio `pallet`, pianta `plant`, sarcofago `sarcophagus`, scaffale `shelf`, statua `statue`,
sgabello `stool`, tavolo `table`, trono `throne`, rastrelliera `weapon_rack`, pozzo `well`.

**Oggetti «di bordo» (4)** — strisce orizzontali larghe e basse (64×16) che stanno sul lato di una casella:
porta `door`, finestra `window`, saracinesca `portcullis`, feritoia `arrow_slit`.

**Personaggi (32)** — mezzo busto, deve riconoscersi anche in piccolo:
alchimista `alchemist`, artista `artist`, fornaio `baker`, banchiere `banker`, bardo `bard`, barista `bartender`, fabbro `blacksmith`,
macellaio `butcher`, maggiordomo `butler`, operaio `construction`, contessa `countess`, boia `executioner`, esploratore `explorer`,
contadino `farmer`, giardiniera `gardener`, studioso `glasses`, araldo `herald`, giullare `jester`, giudice `judge`, cavaliere `knight`,
avvocato `lawyer`, bibliotecario `librarian`, cameriera `maid`, meccanico `mechanic`, monaco `monk`, suora `nun`, prete `priest`,
principessa `princess`, soldato `soldier`, ladro `thief`, cameriere `waiter`, **vittima** `victim`.

**Pavimenti (26)** — texture **che si ripete senza cuciture**, vista dall'alto:
mattoni `brick`, tappeto `carpet`, tappeto blu `carpet_blue`, pietra a scacchi `checker_stone`, ciottoli `cobble`, pietra crepata
`cracked_stone`, damascato `damask`, terra `dirt`, cementine `encaustic`, lastre scure `flagstone_dark`, lastre muschiose
`flagstone_moss`, erba `grass`, ghiaia `gravel`, spina di pesce `herringbone`, marmo `marble`, muschio `moss`, ossario `ossuary`,
parquet `parquet`, assi `planks`, assi scure `planks_dark`, assi grezze `rough_planks`, ardesia `slate`, pietra `stone`, paglia `straw`,
cotto `terracotta`, legno `wood`.

### 1.2 Per casi non medievali (già presenti nell'app, da ridisegnare nello stesso stile)

- **Oggetti:** lampada `lamp`, TV `tv`, pelle d'orso `bearskin`, sfera di cristallo `crystal_ball`.
- **Personaggi (34):** detective, cuoco, autista, professore, medico, infermiera, poliziotto, pilota, marinaio, pompiere, farmacista,
  musicista, scienziato, fotografo, pirata, spia, mago, cowboy, re, regina, astronauta, ninja, clown, prestigiatore, attore, turista,
  rockstar, vampiro, gangster, arciere, principe, cronista, persona 1 e 2.
- **Pavimenti (16):** `hatch`, `checker_bw`, `checker_cream`, `marble_black`, `carpet_green`, sabbia `sand`, mosaico `mosaic`,
  acqua `water`, linoleum `linoleum`, piastrelle bianche `tiles_white`, cemento `concrete`, rune `runes`, fango `mud`, bosco `forest`,
  neve `snow`, ponte `bridge`.
- **Nuovi temi** (oggetti, personaggi e pavimenti da inventare): servono te e me per decidere quali. Idee: giallo anni '20 / hotel,
  nave e pirati, Far West, spazio, scuola, ufficio moderno.

## 2. Piano di prova (una sola volta, per scegliere lo stile)

Per ogni stile genera **lo stesso piccolo insieme**, così si confronta alla pari (12 immagini a stile):

| Tipo | Soggetti di prova |
|---|---|
| Personaggi (4) | cavaliere, monaco, giullare, **vittima** |
| Oggetti (5) | incudine, tavolo, baule, camino, pozzo |
| Di bordo (1) | porta |
| Pavimenti (2) | lastre scure `flagstone_dark`, assi `planks` |

### Stili da provare

| Sigla | Stile | Note |
|---|---|---|
| **A** | Carta ritagliata (quello di oggi) | Riferimento: lo trovi già nell'app, non va generato |
| **B** | Vettoriale piatto, contorni netti | Il più facile da convertire in SVG e da tenere coerente |
| **C** | Miniatura da manoscritto medievale | Oro, colori caldi, linee fini; molto a tema per la campagna |
| **D** | Acquerello e inchiostro | Morbido; attenzione alla leggibilità in piccolo |
| **E** | Pixel art 64×64 | Coerente per natura, leggero, si ingrandisce senza sfocare |
| **F** | Xilografia a due colori | Contrasto alto: ottimo in piccolo e in tema contrasto |

### Modelli di richiesta (prompt)

Sostituisci `[STILE]` con la riga dello stile e `[SOGGETTO]` con il soggetto. Mantieni **le stesse parole** in tutte le immagini
dello stesso stile.

**Righe di stile**

- **B:** `flat vector illustration, clean bold outlines, limited palette of 6 colors, no gradients, no shading texture`
- **C:** `medieval illuminated manuscript miniature style, warm earthy colors with gold accents, fine ink outlines, parchment feel`
- **D:** `watercolor and ink illustration, soft washes, visible thin ink outlines, muted warm palette`
- **E:** `pixel art, 64x64 pixels, limited 16 color palette, crisp pixels, no anti-aliasing, black outline`
- **F:** `woodcut print style, two colors only (dark brown ink on cream), thick carved lines, high contrast`

**Personaggi**
```
[STILE]. Head-and-shoulders portrait of a [SOGGETTO, es. medieval knight], front view, centered, single character,
friendly stylized proportions, simple face, neutral plain white background, no text, no frame, no border, 1:1 square.
```
Per la **vittima**: `a pale ghostly figure with a halo, closed eyes, same style as the others` (nell'app è già un fantasma con l'aureola).

**Oggetti**
```
[STILE]. A single [SOGGETTO, es. blacksmith anvil], seen from slightly above, centered, whole object visible,
neutral plain white background, no floor, no cast shadow, no text, 1:1 square.
```

**Oggetto di bordo (porta)**
```
[STILE]. A [SOGGETTO, es. wooden door], front view, flat, centered, wide and short strip, 4:1 aspect ratio,
neutral plain white background, no text.
```

**Pavimenti**
```
[STILE]. Seamless tileable texture of [SOGGETTO, es. dark stone flagstones], top-down flat view, even lighting,
no perspective, no objects, no text, no vignette, fills the whole square, 1:1.
```
Dove il sito ha l'opzione «tile / seamless / pattern», **attivala**. Poi controlla: affiancando 2×2 la stessa immagine non si devono
vedere cuciture.

## 3. Siti gratuiti da provare (in quest'ordine)

| Sito | Perché | Attenzione (da verificare sul sito) |
|---|---|---|
| **Recraft** (recraft.ai) | Può produrre **SVG veri** e stili coerenti | Il piano gratuito ha pochi crediti; spesso immagini pubbliche e non commerciali |
| **Leonardo.ai** | Crediti giornalieri gratuiti, PNG trasparenti, modalità «tile» | Nel piano gratuito le immagini sono di solito pubbliche |
| **Ideogram** | Buona qualità, riconosce bene le istruzioni | Piano gratuito di solito pubblico |
| **Microsoft Copilot / Bing Image Creator** | Gratuito, buona qualità | Niente sfondo trasparente: lo ritaglio io |
| **Gemini** (Google) | Gratuito, comodo per più varianti | Limiti giornalieri |
| **Hugging Face Spaces** (es. modelli FLUX) | Gratuito, nessun account per alcuni | Code di attesa, qualità variabile |
| **Adobe Firefly** | Addestrato su materiale con licenza | Pochi crediti mensili gratuiti |

**Senza AI, con licenza libera (controllare comunque):**
**game-icons.net** (oltre 4000 icone SVG, anche medievali; licenza CC BY: serve citare gli autori), **Kenney.nl** (CC0),
**OpenGameArt** (licenze miste: guarda ogni file), **Poly Haven** e **ambientCG** (texture CC0, per i pavimenti).

## 4. Come consegnarmi le prove

Una cartella per stile, nomi come l'id dell'app:
```
prove/B-vettoriale/personaggi/knight.png   (o .svg)
prove/B-vettoriale/oggetti/anvil.png
prove/B-vettoriale/bordo/door.png
prove/B-vettoriale/pavimenti/flagstone_dark.png
```
Puoi allegarle in chat (anche a gruppi) o metterle in `docs/immagini/prove/` con un commit. Per ogni stile scrivi nel nome della cartella
sito e modello usato, e se lo hai provato con «tile» attivo.

**Cosa faccio io con le prove:** una pagina di confronto che mostra ogni stile **sulla mappa vera**, alle tre dimensioni dell'app
(20 px nella barra, 56 px sulla mappa, 84 px grande) e nei temi chiaro, scuro e contrasto. Così scegli guardando il gioco e non le
immagini isolate.

## 5. Dopo la scelta dello stile

- **Vettoriale (SVG):** si inserisce nel formato delle icone (guida in `src/skin/paper/README.md`): `viewBox 0 0 64 64`, colori che
  seguono i temi, corpo del personaggio con `currentColor` (il colore del personaggio), nessun testo, nessun `id`. I test controllano
  che ogni id abbia il suo disegno.
- **Raster (PNG/WebP):** vanno ritagliati, ridotti (circa 128 px per oggetti e personaggi, 128-256 px per le texture) e convertiti in WebP.
  Perdono i colori che seguono il tema: il colore del personaggio diventa un anello o uno sfondo tondo attorno alla testa.
  Per i pavimenti raster serve la texture che si ripete (controllo 2×2).
- **Coerenza:** stessa luce (da alto a sinistra), stesso spessore di contorno, stessa tavolozza per tutti gli elementi di un tema.
- **Leggibilità:** ogni personaggio deve distinguersi dagli altri anche in **bianco e nero** (capelli, copricapo, accessori), perché il
  gioco funziona anche con il daltonismo.

## 6. Licenze (da controllare per ogni immagine)

1. **Uso commerciale** consentito? Molti piani gratuiti lo vietano o rendono le immagini pubbliche.
2. **Attribuzione** richiesta (CC BY)? Va messa nei crediti dell'app.
3. **Diritti sulle immagini generate:** la tutela del diritto d'autore sulle immagini AI è ancora incerta in molti paesi. Tienine nota
   (sito, data, piano, prompt) in un file `CREDITI.md`.
4. Niente nomi di personaggi, marchi o artisti viventi nei prompt.
