# Il Re è morto — i casi 1-9 (mappa, personaggi, dossier)

> **Attenzione, spoiler.** Ogni caso dice chi deve essere il colpevole e il dossier di chiusura (epilogo) ne rivela il nome. Non condividere questi file con chi deve giocare la campagna. La storia completa è in [campagna-storia.md](../campagna-storia.md).

Questi sono i nove casi della campagna prima del finale, **senza indizi e senza soluzione**: ogni file `.murdoku.json` contiene la mappa (stanze, pavimenti, mobili, porte e finestre), i personaggi con la loro descrizione, la vittima e il **dossier del caso** (testo introduttivo ed epilogo). Gli indizi e la soluzione li scrivi tu.

## Come si usano

1. Nell'editor premi **⬆ Importa** e scegli il file del caso: ritrovi mappa, personaggi, vittima e dossier (pannello *📖 Dossier del caso*).
2. Nella scheda **🗺️ Mappa** trovi le stanze (con i nomi), i mobili, le porte e le finestre; la descrizione di ogni personaggio è nella sua scheda, sotto la griglia.
3. Dichiara la soluzione e scrivi gli indizi: il colpevole indicato qui sotto deve essere **l'unico a trovarsi nella stessa stanza della vittima**, tutti gli altri in altre stanze (è la regola di base di ogni caso).
4. Controlla con **Verifica unicità** e **Indizi superflui**; il tempo verbale degli indizi è già impostato al passato.

Regole rispettate: una griglia N×N ha N persone (N−1 sospettati più la vittima); iniziali tutte diverse nello stesso caso; nessun sospettato con la V (riservata al re e ai suoi figli); nessuna magia; nessun nome del colpevole nel titolo né nell'introduzione.

| Caso | Titolo | Griglia | Difficoltà | Vittima | Colpevole | File |
|---|---|---|---|---|---|---|
| 1 | Il garzone della forgia | 6×6 | facile | Vanni | Bertoldo | `01-il-garzone-della-forgia.murdoku.json` |
| 2 | L'orto dell'abbazia | 6×6 | facile | Violante | fra Anselmo | `02-l-orto-dell-abbazia.murdoku.json` |
| 3 | Lo scriptorium | 6×6 | media | Valerio | Ambrogio | `03-lo-scriptorium.murdoku.json` |
| 4 | La taverna dei Tre Corvi | 7×7 | media | Vitale | Aimone il Guercio | `04-la-taverna-dei-tre-corvi.murdoku.json` |
| 5 | Le scuderie reali | 7×7 | media | Venanzia | ser Aldobrando | `05-le-scuderie-reali.murdoku.json` |
| 6 | La cripta | 7×7 | difficile | Valeria | Amedeo | `06-la-cripta.murdoku.json` |
| 7 | Le cucine | 8×8 | difficile | Valdo | Agnese | `07-le-cucine.murdoku.json` |
| 8 | La torre delle prigioni | 8×8 | difficile | Vivia | Alderico | `08-la-torre-delle-prigioni.murdoku.json` |
| 9 | Il banchetto dell'erede | 8×8 | undefined | Valdemaro | lord Alboino di Valgrigia | `09-il-banchetto-dell-erede.murdoku.json` |

---

## Caso 1 — Il garzone della forgia · 6×6

**Scena.** La forgia di Borgocenere, la casa del fabbro e la carbonaia. **Difficoltà:** facile. **File:** `01-il-garzone-della-forgia.murdoku.json`

**Vittima:** Vanni — garzone fabbro.

**Colpevole:** Bertoldo (il maestro fabbro). **Movente:** Vanni aveva scoperto che vendeva lame difettose al presidio.

### Personaggi

| Iniziale | Nome | Chi è | Avatar | Descrizione |
|---|---|---|---|---|
| A | **Arnaldo** | lavorante di bottega | Operaio | Lavorante, forte come un bue e di poche parole. Vanni gli aveva preso il posto accanto alla fornace, e lui non l'ha mai nascosto. |
| B | **Bertoldo** (colpevole) | il maestro fabbro | Fabbro | Maestro fabbro e padrone della forgia. Burbero ma stimato, fornisce ferri e armi al presidio del castello. Ultimamente ha le mani piene di ordini e il carattere peggiorato. |
| C | **Clelia** | la moglie del fabbro | Fornaio | Moglie del fabbro: tiene i conti e la cucina. Voleva bene al garzone come a un figlio, dice; ma la sera lo sentiva parlare di cose che non capiva. |
| D | **Duccio** | il carbonaio | Contadino/a | Carbonaio di Borgocenere: porta il carbone alla forgia ogni mattina. Parla solo del tempo, ma vede tutto quello che entra ed esce dal cortile. |
| E | **Egidia** | la figlia del vasaio | Cameriera/e | Figlia del vasaio della porta accanto: porta ogni giorno la zuppa ai lavoranti. Si fermava a parlare con Vanni più del dovuto. |
| V | **Vanni** (vittima) | la vittima, garzone fabbro | Ninja | 19 anni, garzone della forgia di Borgocenere. Silenzioso e instancabile, è arrivato in bottega ancora bambino: nessuno sa chi fossero i suoi genitori. |

### Mappa

Righe R1… dall'alto, colonne C1… da sinistra; una lettera per stanza.

```
      C1 C2 C3 C4 C5 C6 
  R1  F  F  F  F  C  C  
  R2  F  F  F  F  C  C  
  R3  F  F  F  G  G  G  
  R4  K  K  K  G  G  G  
  R5  K  K  K  Y  Y  Y  
  R6  K  K  K  Y  Y  Y  
```

| Lettera | Stanza | Pavimento | Caselle | Mobili |
|---|---|---|---|---|
| F | La forgia | Lastre scure | 11 | camino (R1C1), incudine (R2C3), rastrelliera (R3C2) |
| C | La carbonaia | Terra battuta | 4 | botte (R1C5), carro (R2C6) |
| G | Il magazzino | Listoni scuri | 6 | scaffale (R3C5), forziere (R4C6) |
| K | La casa del fabbro | Listoni chiari | 9 | tavolo (R5C2), letto (R6C1) |
| Y | Il cortile | Ciottoli | 6 | pozzo (R6C5) |

**Porte tra le stanze:** La forgia – La carbonaia; La forgia – Il magazzino; La forgia – La casa del fabbro; La casa del fabbro – Il magazzino; La casa del fabbro – Il cortile; Il magazzino – Il cortile. **Finestre:** 4.

_I mobili pieni (9) occupano la loro casella; panche, sgabelli, giacigli, tappeti e troni si possono occupare._

### Dossier del caso

**Introduzione** (mostrata al giocatore prima degli indizi):

> La regina Adela ti ha scelto per scoprire come è morto suo marito, ma per cominciare ti manda a Borgocenere: un garzone fabbro giace morto accanto all'incudine. «Un fatto di poco conto», dice, «ma un'indagine parte da dove capita.» La forgia è ancora calda, e cinque persone giurano di non aver visto niente.

**Epilogo** (nota di chiusura, mostrata dopo la soluzione):

> Il maestro fabbro confessa: Vanni aveva scoperto le lame difettose vendute all'esercito. Nel gettone di ferro che il ragazzo portava al collo c'è lo stemma di Victor, e un foglietto: «Il coppiere non entrò mai nella camera». Alla regina dici che il garzone era figlio del re. «Non lo sapevo», sussurra Adela.

---

## Caso 2 — L'orto dell'abbazia · 6×6

**Scena.** L'orto, la serra, l'infermeria e il refettorio dell'abbazia di San Ilario. **Difficoltà:** facile. **File:** `02-l-orto-dell-abbazia.murdoku.json`

**Vittima:** Violante — erborista.

**Colpevole:** fra Anselmo (fra Anselmo, l'infermiere). **Movente:** Violante aveva trovato il suo registro dei veleni, che vendeva di nascosto.

### Personaggi

| Iniziale | Nome | Chi è | Avatar | Descrizione |
|---|---|---|---|---|
| A | **Anselmo** (colpevole) | fra Anselmo, l'infermiere | Monaco | Fra Anselmo, infermiere dell'abbazia: conosce ogni pianta e ogni dose. Autorevole, di rado visto fuori dall'infermeria, se non per raccogliere erbe all'alba. |
| B | **Bonifacio** | il giardiniere | Giardiniere/a | Giardiniere laico dell'abbazia. Lavora l'orto da vent'anni e non ha mai amato che altri mettessero le mani nelle sue aiuole. |
| C | **Clemenza** | suor Clemenza | Suora | Suor Clemenza, sorvegliante dell'orto e dell'infermeria: severa con le novizie. Rimproverava Violante per i ritardi, e per le sue visite fuori orario. |
| D | **Dionigi** | il frate portinaio | Sacerdote | Frate portinaio: apre e chiude il portone dell'abbazia e sa chi è venuto e chi se n'è andato. Dorme poco e ascolta molto. |
| E | **Eufemia** | la cuoca del refettorio | Fornaio | Cuoca del refettorio: prepara i pasti dei monaci e dei pellegrini. Ha le erbe in cucina quanto l'erborista le ha nell'orto, e non lo ha mai detto volentieri. |
| V | **Violante** (vittima) | la vittima, erborista | Farmacista | 20 anni, erborista: cura le aiuole e prepara gli unguenti dell'infermeria. Teneva un erbario a cui non lasciava avvicinare nessuno. |

### Mappa

Righe R1… dall'alto, colonne C1… da sinistra; una lettera per stanza.

```
      C1 C2 C3 C4 C5 C6 
  R1  O  O  O  O  L  L  
  R2  O  O  O  O  L  L  
  R3  O  O  O  O  R  R  
  R4  I  I  C  C  R  R  
  R5  I  I  C  C  R  R  
  R6  I  I  C  C  R  R  
```

| Lettera | Stanza | Pavimento | Caselle | Mobili |
|---|---|---|---|---|
| O | L'orto | Erba | 12 | pozzo (R1C1), panca (R2C3), statua (R3C4) |
| L | La serra delle erbe | Muschio | 4 | pianta (R1C5), scaffale (R2C6) |
| R | Il refettorio | Listoni scuri | 8 | tavolo (R4C5), panca (R5C6), sgabello (R6C5) |
| I | L'infermeria | Listoni chiari | 6 | calderone (R4C1), giaciglio (R5C2) |
| C | Il chiostro | Lastre di pietra | 6 | statua (R6C3) |

**Porte tra le stanze:** L'orto – La serra delle erbe; L'orto – Il refettorio; L'orto – L'infermeria; L'orto – Il chiostro; Il chiostro – L'infermeria; Il chiostro – Il refettorio. **Finestre:** 4.

_I mobili pieni (7) occupano la loro casella; panche, sgabelli, giacigli, tappeti e troni si possono occupare._

### Dossier del caso

**Introduzione** (mostrata al giocatore prima degli indizi):

> All'abbazia di San Ilario una giovane erborista è stata trovata morta nell'orto, tra le aiuole. La regina ti ha scritto: «Il mio giardino è pieno delle stesse piante; fammi sapere se qualcuno le usa male.» L'abate ti riceve a denti stretti, e cinque persone ti dicono di non aver visto niente.

**Epilogo** (nota di chiusura, mostrata dopo la soluzione):

> Fra Anselmo cede quando ti mostri il suo registro dei veleni: lo smerciava ai nobili del borgo. Nell'erbario di Violante, fra le foglie di digitale, una nota: «La cameriera rammendava davanti al camino». Due figli del re morti in pochi giorni: sai già che non saranno gli ultimi.

---

## Caso 3 — Lo scriptorium · 6×6

**Scena.** Lo scriptorium, la biblioteca e la legatoria dell'abbazia. **Difficoltà:** media. **File:** `03-lo-scriptorium.murdoku.json`

**Vittima:** Valerio — scrivano.

**Colpevole:** Ambrogio (il segretario dell'abate). **Movente:** Falsificava atti di proprietà; Valerio se n'era accorto.

### Personaggi

| Iniziale | Nome | Chi è | Avatar | Descrizione |
|---|---|---|---|---|
| A | **Ambrogio** (colpevole) | il segretario dell'abate | Avvocato | Segretario dell'abate: custodisce i registri e i sigilli dell'abbazia. Preciso, riservato, sempre ben informato sugli affari del monastero. |
| B | **Benvenuto** | il copista | Studioso/a | Copista anziano, miope e sospettoso. Lavora fianco a fianco con Valerio da anni e ne invidia la velocità. |
| C | **Cosimo** | il miniatore | Artista | Miniatore: illustra i codici più preziosi. Vive per i colori e per i pennelli; ha debiti con un mercante di Borgocenere. |
| D | **Domitilla** | la monaca bibliotecaria | Bibliotecario/a | Monaca bibliotecaria: conosce a memoria ogni scaffale. Dice di aver sentito rumori nella notte, ma di non aver visto nulla. |
| E | **Eligio** | il rilegatore | Meccanico | Rilegatore dell'abbazia: lavora la pelle, la colla e le borchie. Entra ed esce dallo scriptorium per ritirare i fogli, e nessuno lo nota più. |
| V | **Valerio** (vittima) | la vittima, scrivano | Cronista | 22 anni, scrivano dello scriptorium. Una calligrafia perfetta e un occhio da contabile: leggeva ogni atto che copiava. |

### Mappa

Righe R1… dall'alto, colonne C1… da sinistra; una lettera per stanza.

```
      C1 C2 C3 C4 C5 C6 
  R1  S  S  S  S  B  B  
  R2  S  S  S  S  B  B  
  R3  S  S  S  S  U  U  
  R4  C  C  C  R  U  U  
  R5  C  C  C  R  R  R  
  R6  C  C  C  R  R  R  
```

| Lettera | Stanza | Pavimento | Caselle | Mobili |
|---|---|---|---|---|
| S | Lo scriptorium | Listoni chiari | 12 | leggio (R1C2), leggio (R3C2), candelabro (R1C3), panca (R2C1) |
| B | La biblioteca | Lastre scure | 4 | scaffale (R1C5), scaffale (R2C6) |
| U | Lo studio del segretario | Moquette rossa | 4 | forziere (R3C5), tappeto (R4C6) |
| R | La legatoria | Assi di legno | 7 | tavolo (R5C5), forziere (R6C4) |
| C | Il chiostro | Ciottoli | 9 | panca (R5C2), pianta (R6C1) |

**Porte tra le stanze:** Lo scriptorium – La biblioteca; Lo scriptorium – Lo studio del segretario; Lo scriptorium – Il chiostro; Lo scriptorium – La legatoria; Lo studio del segretario – La legatoria; Il chiostro – La legatoria. **Finestre:** 5.

_I mobili pieni (9) occupano la loro casella; panche, sgabelli, giacigli, tappeti e troni si possono occupare._

### Dossier del caso

**Introduzione** (mostrata al giocatore prima degli indizi):

> Un copista è stato ucciso nello scriptorium, con il pennino ancora sul foglio. La regina ti fa dire di essere discreto: «Le carte di un monastero sono delicate, e tanti vi si fidano più che del re». Cinque persone sospette, e un solo libro mastro in disordine.

**Epilogo** (nota di chiusura, mostrata dopo la soluzione):

> Ambrogio aveva falsificato una trentina di atti e Valerio l'aveva scoperto. Dentro il pennino d'argento un foglietto: «Il medico pregava nella cappella mentre il re moriva». Il medico di corte, ti avverte la regina, è un uomo onesto: non perdere tempo.

---

## Caso 4 — La taverna dei Tre Corvi · 7×7

**Scena.** La taverna dei Tre Corvi, a Borgocenere: sala, cucina, camere, cantina, stalla e cortile. **Difficoltà:** media. **File:** `04-la-taverna-dei-tre-corvi.murdoku.json`

**Vittima:** Vitale — mercenario.

**Colpevole:** Aimone il Guercio (Aimone il Guercio, soldato di ventura). **Movente:** Un debito di gioco: Vitale lo aveva sorpreso a barare ai dadi.

### Personaggi

| Iniziale | Nome | Chi è | Avatar | Descrizione |
|---|---|---|---|---|
| A | **Aimone** (colpevole) | Aimone il Guercio, soldato di ventura | Soldato | Aimone il Guercio, soldato di ventura con un occhio solo e molte cicatrici. Gioca a dadi con Vitale quasi ogni sera, e perde più spesso di quanto ammetta. |
| B | **Brigida** | la cameriera | Cameriere | Cameriera dei Tre Corvi. Sa tutto di tutti: serve vino e ascolta. Si è fatta più guardinga da quando Vitale è morto. |
| C | **Camillo** | il mercante | Banchiere | Mercante di panni di passaggio a Borgocenere: ha preso una stanza ai Tre Corvi per una settimana. Paga bene e parla poco. |
| D | **Drogone** | il mandriano | Contadino/a | Mandriano delle colline, in paese solo per vendere le bestie. Beve forte e ha il pugno facile. |
| E | **Elvira** | la lavandaia | Cameriera/e | Lavandaia dei Tre Corvi: lava lenzuola e boccali, e raccoglie le chiacchiere insieme ai panni sporchi. Vitale le lasciava sempre una moneta. |
| F | **Fiorenzo** | il cantiniere | Barista | Cantiniere della taverna: scende in cantina a spillare e risale con le orecchie piene. Tiene i conti dei debiti di gioco, e non li ha mai detti a nessuno. |
| V | **Vitale** (vittima) | la vittima, mercenario | Arciere/a | 21 anni, mercenario al soldo di chi paga. Giocatore di dadi, spaccone, benvoluto a metà. |

### Mappa

Righe R1… dall'alto, colonne C1… da sinistra; una lettera per stanza.

```
      C1 C2 C3 C4 C5 C6 C7 
  R1  T  T  T  T  K  K  K  
  R2  T  T  T  T  K  K  K  
  R3  T  T  T  T  L  L  L  
  R4  C  C  C  C  L  L  L  
  R5  C  C  C  C  Y  Y  Y  
  R6  P  P  P  Y  Y  Y  Y  
  R7  P  P  P  Y  Y  Y  Y  
```

| Lettera | Stanza | Pavimento | Caselle | Mobili |
|---|---|---|---|---|
| T | La sala della taverna | Listoni scuri | 12 | camino (R1C1), panca (R1C3), panca (R2C2), tavolo (R2C3), panca (R3C1) |
| K | La cucina | Mattoni | 6 | scaffale (R1C7), calderone (R2C5) |
| L | Le camere | Listoni chiari | 6 | letto (R3C6), letto (R4C7) |
| C | La cantina | Lastre scure | 8 | botte (R4C2), botte (R5C4), botte (R4C1) |
| P | La stalla | Paglia | 6 | giaciglio (R6C2) |
| Y | Il cortile | Terra battuta | 11 | carro (R7C6), pozzo (R5C6) |

**Porte tra le stanze:** La sala della taverna – La cucina; La sala della taverna – Le camere; La sala della taverna – La cantina; La cucina – Le camere; La cantina – Le camere; La cantina – Il cortile; Le camere – Il cortile; La cantina – La stalla; La stalla – Il cortile. **Finestre:** 6.

_I mobili pieni (9) occupano la loro casella; panche, sgabelli, giacigli, tappeti e troni si possono occupare._

### Dossier del caso

**Introduzione** (mostrata al giocatore prima degli indizi):

> Alla taverna dei Tre Corvi si è sparsa una voce e un cadavere: un mercenario, steso tra le panche con una daga nel fianco. «Lì si gioca, si beve, si dice di tutto», ti fa sapere la regina. «Ascolta tutto, e non fidarti di nessuno.» Sei persone giurano di non aver visto niente.

**Epilogo** (nota di chiusura, mostrata dopo la soluzione):

> Aimone ammette tutto, con una risata amara. Sotto la medaglia di Vitale, un foglietto: «La sarta cuciva nel corridoio, vicino all'armatura». La regina annuisce piano quando glielo racconti: «Un'altra giovane vita sprecata».

---

## Caso 5 — Le scuderie reali · 7×7

**Scena.** Le scuderie, il campo del torneo, il fienile, l'armeria, il maniscalco e la selleria. **Difficoltà:** media. **File:** `05-le-scuderie-reali.murdoku.json`

**Vittima:** Venanzia — palafreniera.

**Colpevole:** ser Aldobrando (ser Aldobrando, cavaliere). **Movente:** Venanzia aveva visto che truccava la lancia nei tornei.

### Personaggi

| Iniziale | Nome | Chi è | Avatar | Descrizione |
|---|---|---|---|---|
| A | **Aldobrando** (colpevole) | ser Aldobrando, cavaliere | Cavaliere | Ser Aldobrando, cavaliere di molti tornei e di pochi scrupoli. Vince spesso, e di recente è il favorito per la giostra del re. |
| B | **Brunone** | il garzone di stalla | Operaio | Garzone di stalla, tutto muscoli e poco cervello. Venanzia lo sgridava per il fieno sprecato. |
| C | **Corrado** | il maniscalco | Fabbro | Maniscalco delle scuderie: ferra i cavalli dei cavalieri e conosce il peso di ogni lancia. Venanzia gli portava i cavalli zoppi, e lui le dava sempre ragione. |
| D | **Delia** | la dama | Principessa | Dama della corte, appassionata di tornei: siede sempre in prima fila. Frequenta le scuderie più di quanto sia decoroso. |
| E | **Ermengarda** | la guardarobiera | Cameriera/e | Guardarobiera della corte: cura le insegne, i panni e gli stendardi del torneo. Ha le chiavi del magazzino. |
| F | **Fabiano** | lo scudiero | Soldato | Scudiero di ser Aldobrando: lucida le armi e porta la lancia. Fedele, o abituato a esserlo. |
| V | **Venanzia** (vittima) | la vittima, palafreniera | Cowboy | 21 anni, palafreniera della corte. Conosce ogni cavallo per nome e ogni cavaliere per i suoi vizi. |

### Mappa

Righe R1… dall'alto, colonne C1… da sinistra; una lettera per stanza.

```
      C1 C2 C3 C4 C5 C6 C7 
  R1  C  C  C  C  C  C  C  
  R2  C  C  C  C  C  C  C  
  R3  S  S  S  S  F  F  F  
  R4  S  S  S  S  F  F  F  
  R5  A  A  M  M  R  R  R  
  R6  A  A  M  M  R  R  R  
  R7  A  A  M  M  R  R  R  
```

| Lettera | Stanza | Pavimento | Caselle | Mobili |
|---|---|---|---|---|
| C | Il campo del torneo | Erba | 14 | stendardo (R1C2), stendardo (R1C6), panca (R2C3), panca (R2C5) |
| S | Le scuderie | Paglia | 8 | giaciglio (R4C2), sgabello (R3C1) |
| F | Il fienile | Assi grezze | 6 | carro (R4C7) |
| A | L'armeria | Lastre scure | 6 | rastrelliera (R5C1), armatura (R7C2) |
| M | Il maniscalco | Cotto | 6 | incudine (R6C3), camino (R5C4) |
| R | La selleria | Listoni scuri | 9 | forziere (R5C7), panca (R7C5), botte (R6C6) |

**Porte tra le stanze:** Il campo del torneo – Le scuderie; Il campo del torneo – Il fienile; Le scuderie – Il fienile; Le scuderie – L'armeria; Le scuderie – Il maniscalco; Il fienile – La selleria; Il maniscalco – La selleria; L'armeria – Il maniscalco. **Finestre:** 5.

_I mobili pieni (9) occupano la loro casella; panche, sgabelli, giacigli, tappeti e troni si possono occupare._

### Dossier del caso

**Introduzione** (mostrata al giocatore prima degli indizi):

> Ai margini del campo del torneo hanno trovato una palafreniera, uccisa tra le stalle. La regina conosce già alcuni dettagli della scena e se ne scusa: «Gli stallieri parlano con me». Tu annoti la cosa e passi oltre. Sei sospettati, e tutti a due passi dal luogo del delitto.

**Epilogo** (nota di chiusura, mostrata dopo la soluzione):

> Ser Aldobrando cade sul tuo argomento più semplice: la lancia truccata. Nel doppio fondo del boccale di Venanzia, un biglietto: «L'ostessa era nel cortile, accanto al pozzo». Cinque figli del re, ormai, e tutti morti.

---

## Caso 6 — La cripta · 7×7

**Scena.** La cripta dell'abbazia, dove il re sarà sepolto, con la sacrestia, la navata, la cappella dei pellegrini e l'ossario. **Difficoltà:** difficile. **File:** `06-la-cripta.murdoku.json`

**Vittima:** Valeria — novizia.

**Colpevole:** Amedeo (Amedeo, il sagrestano). **Movente:** Rubava l'argento dei reliquiari; Valeria lo vide.

### Personaggi

| Iniziale | Nome | Chi è | Avatar | Descrizione |
|---|---|---|---|---|
| A | **Amedeo** (colpevole) | Amedeo, il sagrestano | Monaco | Sagrestano: custodisce i vasi sacri, le chiavi e i reliquiari. Parla poco e non lascia mai la cripta senza chiuderla. |
| B | **Benedetto** | l'abate Benedetto | Sacerdote | Abate di San Ilario: anziano, severo, impegnato a preparare le esequie del re. |
| C | **Cassiano** | il becchino | Giardiniere/a | Becchino del borgo: scava le tombe e le chiude. Si dice che parli con i morti, e che i vivi gli stiano a distanza. |
| D | **Donata** | la pellegrina | Contadino/a | Pellegrina venuta a pregare sulle tombe dei santi. Arrivata da pochi giorni, ha già fatto troppe domande. |
| E | **Eusebio** | il pellegrino | Esploratore | Pellegrino ed ex soldato: prega molto e dorme poco. Non vuole dire da dove viene. |
| F | **Fortunato** | il frate cercatore | Alchimista | Frate cercatore: gira per i villaggi a raccogliere le offerte e le porta all'abbazia. Tiene i conti dell'argento dei reliquiari, e non vuole che nessuno li riveda. |
| V | **Valeria** (vittima) | la vittima, novizia | Suora | 20 anni, novizia dell'abbazia di San Ilario. Curiosa, taciturna, spesso trovata dove non dovrebbe. |

### Mappa

Righe R1… dall'alto, colonne C1… da sinistra; una lettera per stanza.

```
      C1 C2 C3 C4 C5 C6 C7 
  R1  S  S  S  N  N  N  N  
  R2  S  S  S  N  N  N  N  
  R3  K  K  K  K  P  P  P  
  R4  K  K  K  K  P  P  P  
  R5  K  K  K  K  O  O  O  
  R6  D  D  D  D  O  O  O  
  R7  D  D  D  D  O  O  O  
```

| Lettera | Stanza | Pavimento | Caselle | Mobili |
|---|---|---|---|---|
| S | La sacrestia | Assi di legno | 6 | forziere (R1C1), candelabro (R2C2) |
| N | La navata | Scacchiera di pietra | 8 | panca (R1C6), statua (R1C4) |
| K | La cripta | Pietra incrinata | 12 | altare (R3C1), sarcofago (R4C3), lapide (R5C4), candelabro (R3C4) |
| P | La cappella dei pellegrini | Listoni chiari | 6 | panca (R4C6) |
| O | L'ossario | Ossario | 9 | lapide (R5C7), sarcofago (R7C6) |
| D | Il deposito delle reliquie | Lastre scure | 8 | forziere (R6C1), scaffale (R7C3) |

**Porte tra le stanze:** La sacrestia – La navata; La sacrestia – La cripta; La navata – La cripta; La navata – La cappella dei pellegrini; La cripta – La cappella dei pellegrini; La cripta – L'ossario; La cripta – Il deposito delle reliquie; Il deposito delle reliquie – L'ossario; La cappella dei pellegrini – L'ossario. **Finestre:** 4.

_I mobili pieni (11) occupano la loro casella; panche, sgabelli, giacigli, tappeti e troni si possono occupare._

### Dossier del caso

**Introduzione** (mostrata al giocatore prima degli indizi):

> Nella cripta dell'abbazia, dove il re sarà sepolto, una novizia è stata trovata ai piedi di un sarcofago. La regina vi si recherà per le esequie, e vuole una risposta prima di allora. Il sagrestano, ti avvertono, parla poco; gli altri cinque parlano solo per dire che non c'erano.

**Epilogo** (nota di chiusura, mostrata dopo la soluzione):

> Il sagrestano vende l'argento delle reliquie da anni, e Valeria lo ha visto. Nel rosario, in una perla vuota: «La nobildonna aspettava udienza davanti al trono». Intorno alla bara del re, i figli che restano sono sempre meno.

---

## Caso 7 — Le cucine · 8×8

**Scena.** Le cucine del castello: cucina grande, dispensa, macelleria, forno, lavanderia, cantina e cortile. **Difficoltà:** difficile. **File:** `07-le-cucine.murdoku.json`

**Vittima:** Valdo — cuoco.

**Colpevole:** Agnese (Agnese, la dispensiera). **Movente:** Gelosia: Valdo era stato promosso cuoco del re al suo posto.

### Personaggi

| Iniziale | Nome | Chi è | Avatar | Descrizione |
|---|---|---|---|---|
| A | **Agnese** (colpevole) | Agnese, la dispensiera | Cameriera/e | Dispensiera del castello: tiene le chiavi di cantine e dispense. Sa quanto vino e quanta carne entrano in cucina, e quanto ne esce. |
| B | **Bruno** | lo sguattero | Cameriere | Sguattero: lava le pentole e porta l'acqua. Valdo lo trattava meglio di quanto meritasse, dice. |
| C | **Cesare** | il trinciante | Barista | Trinciante del re: taglia le carni a tavola e le assaggia prima di tutti. Valdo gli aveva portato via il posto accanto al re, e lui non lo ha scordato. |
| D | **Damiano** | il maestro di cucina | Maggiordomo | Maestro di cucina, capo di tutti i fornelli. Aveva proposto un altro per il posto di cuoco del re. |
| E | **Ezio** | il macellaio | Macellaio | Macellaio del castello: fornisce la carne e conosce i coltelli meglio di chiunque. |
| F | **Filippo** | il fornaio | Fornaio | Fornaio: all'alba è già al forno. Passa dalle cucine per le farine e per le uova. |
| G | **Ginevra** | la lavandaia | Contadino/a | Lavandaia: porta i panni puliti e si ferma volentieri a chiacchierare. |
| V | **Valdo** (vittima) | la vittima, cuoco | Cuoco/a | 22 anni, cuoco: promosso da poco cuoco personale del re. Ambizioso, orgoglioso del suo posto. |

### Mappa

Righe R1… dall'alto, colonne C1… da sinistra; una lettera per stanza.

```
      C1 C2 C3 C4 C5 C6 C7 C8 
  R1  K  K  K  K  D  D  D  D  
  R2  K  K  K  K  D  D  D  D  
  R3  K  K  K  K  M  M  M  M  
  R4  F  F  F  W  M  M  M  M  
  R5  F  F  F  W  C  C  C  C  
  R6  B  B  B  W  C  C  C  C  
  R7  B  B  B  B  C  C  C  C  
  R8  B  B  B  B  C  C  C  C  
```

| Lettera | Stanza | Pavimento | Caselle | Mobili |
|---|---|---|---|---|
| K | La cucina grande | Mattoni | 12 | calderone (R2C2), camino (R1C4), tavolo (R3C3), panca (R3C1) |
| D | La dispensa | Pietra muschiosa | 8 | scaffale (R1C5), scaffale (R1C8), botte (R2C7) |
| M | La macelleria | Cotto | 8 | tavolo (R4C6) |
| F | Il forno | Mattoni a intreccio | 6 | camino (R4C1), panca (R5C2), calderone (R5C3) |
| W | La lavanderia | Lastre di pietra | 3 | — |
| C | Il cortile | Ciottoli | 16 | pozzo (R6C7), carro (R8C8) |
| B | La cantina | Terra battuta | 11 | botte (R6C1), botte (R7C2), botte (R6C3), forziere (R8C2) |

**Porte tra le stanze:** La cucina grande – La dispensa; La cucina grande – La macelleria; La cucina grande – Il forno; La cucina grande – La lavanderia; La dispensa – La macelleria; La macelleria – La lavanderia; La macelleria – Il cortile; Il forno – La lavanderia; La lavanderia – Il cortile; La lavanderia – La cantina; La cantina – Il cortile. **Finestre:** 6.

_I mobili pieni (15) occupano la loro casella; panche, sgabelli, giacigli, tappeti e troni si possono occupare._

### Dossier del caso

**Introduzione** (mostrata al giocatore prima degli indizi):

> Un cuoco è morto nelle cucine del castello, vicino al calderone. La regina ti riceve nella sala, ti offre un calice di vino e beve per prima: «Qui non ci si fida di nessuno, nemmeno dei cuochi». Fuori, il castello sa già che si indaga, e sette persone avevano accesso alle cucine.

**Epilogo** (nota di chiusura, mostrata dopo la soluzione):

> La dispensiera crolla: la promozione di Valdo le aveva bruciato dentro. Nel manico del cucchiaio d'argento, un foglietto: «Il cancelliere scriveva nell'anticamera, vicino al candelabro». Sette figli morti: ti chiedi chi, a corte, ci guadagna.

---

## Caso 8 — La torre delle prigioni · 8×8

**Scena.** La torre delle prigioni, con le celle, il corpo di guardia, la scala e il cortile. **Difficoltà:** difficile. **File:** `08-la-torre-delle-prigioni.murdoku.json`

**Vittima:** Vivia — carceriera.

**Colpevole:** Alderico (Alderico, capitano della guardia). **Movente:** Vivia sapeva che lasciava fuggire prigionieri dietro compenso.

### Personaggi

| Iniziale | Nome | Chi è | Avatar | Descrizione |
|---|---|---|---|---|
| A | **Alderico** (colpevole) | Alderico, capitano della guardia | Cavaliere | Capitano della guardia della torre: soldato di lunga carriera, rispettato dai suoi uomini. |
| B | **Brunilde** | la guardia | Soldato | Guardia di turno nella torre: fa la ronda ai piani alti. Ha un debito con un cambiavalute. |
| C | **Cunegonda** | la dama | Contessa | Dama di corte, in visita al prigioniero per conto di una nobile famiglia. Veste di seta e parla a bassa voce. |
| D | **Dino** | il ladro in cella | Ladro/a | Ladro rinchiuso in cella, in attesa del giudizio. Ride sempre, dice di avere amici fuori. |
| E | **Ettore** | l'araldo | Araldo/a | Araldo del re: legge i bandi e porta i messaggi ai detenuti. Sa chi entra e chi esce. |
| F | **Fausto** | il boia | Boia | Boia della torre: lavora quando serve, e quando non serve aspetta. Di Vivia era il collega più vicino. |
| G | **Giuditta** | la cuoca dei prigionieri | Fornaio | Cuoca dei prigionieri: porta ogni giorno la zuppa alle celle. Vivia le teneva la porta, e le raccontava tutto quello che vedeva. |
| V | **Vivia** (vittima) | la vittima, carceriera | Poliziotto/a | 20 anni, carceriera della torre: tiene le chiavi di ogni cella. Giovane, ligia, spesso sola nei sotterranei. |

### Mappa

Righe R1… dall'alto, colonne C1… da sinistra; una lettera per stanza.

```
      C1 C2 C3 C4 C5 C6 C7 C8 
  R1  K  K  K  P  P  P  P  P  
  R2  K  K  K  P  P  P  P  P  
  R3  K  K  K  G  G  G  G  G  
  R4  Z  Z  T  T  G  G  G  G  
  R5  Z  Z  T  T  Y  Y  Y  Y  
  R6  Z  Z  T  T  Y  Y  Y  Y  
  R7  Z  Z  T  T  Y  Y  Y  Y  
  R8  Z  Z  T  T  Y  Y  Y  Y  
```

| Lettera | Stanza | Pavimento | Caselle | Mobili |
|---|---|---|---|---|
| K | La sala del capitano | Moquette blu | 9 | tavolo (R1C2), candelabro (R1C3), sedia (R2C1) |
| P | Le celle | Lastre scure | 10 | gabbia (R1C6), gabbia (R2C4), giaciglio (R2C7), panca (R1C8) |
| G | Il corpo di guardia | Lastre di pietra | 9 | armatura (R3C4), tavolo (R3C6), rastrelliera (R4C8), panca (R4C5) |
| Z | La scala | Ardesia | 10 | candelabro (R5C1) |
| T | La sala degli interrogatori | Listoni scuri | 10 | forziere (R5C4), gabbia (R7C3), botte (R8C4) |
| Y | Il cortile della torre | Ghiaia | 16 | pozzo (R6C6), carro (R7C8) |

**Porte tra le stanze:** La sala del capitano – Il corpo di guardia; La sala del capitano – La scala; La sala del capitano – La sala degli interrogatori; Le celle – Il corpo di guardia (saracinesca); Il corpo di guardia – La sala degli interrogatori; Il corpo di guardia – Il cortile della torre; La scala – La sala degli interrogatori; La sala degli interrogatori – Il cortile della torre. **Finestre:** 5; feritoie: 2.

_I mobili pieni (13) occupano la loro casella; panche, sgabelli, giacigli, tappeti e troni si possono occupare._

### Dossier del caso

**Introduzione** (mostrata al giocatore prima degli indizi):

> Una carceriera giace in fondo alla torre delle prigioni, con le chiavi mancanti. La regina ti nota stanco e ti prende le mani: «I pretendenti sono quasi finiti», dice piano. E lo ripete, come per convincersene.

**Epilogo** (nota di chiusura, mostrata dopo la soluzione):

> Il capitano della guardia fa il nome del compratore delle fughe e resta in silenzio. Nell'anello di chiavi c'è un foglietto che sembra innocuo: «La regina pregò nella cappella prima di cena». Lo metti in tasca senza pensarci.

---

## Caso 9 — Il banchetto dell'erede · 8×8

**Scena.** La sala grande, durante il banchetto. **Difficoltà:** undefined. **File:** `09-il-banchetto-dell-erede.murdoku.json`

**Vittima:** Valdemaro — il maggiore, acclamato erede.

**Colpevole:** lord Alboino di Valgrigia (lord Alboino di Valgrigia). **Movente:** Impedire l'incoronazione e restare a corte.

### Personaggi

| Iniziale | Nome | Chi è | Avatar | Descrizione |
|---|---|---|---|---|
| A | **Alboino** (colpevole) | lord Alboino di Valgrigia | Giudice | Lord Alboino di Valgrigia, nobile di un'altra casata, ospite del banchetto. Elegante e affabile, attento a chi può diventare re. |
| B | **Bartolo** | il giullare | Giullare/a | Giullare: fa ridere tutti e osserva tutti. Dice la verità solo per scherzo. |
| C | **Costanza** | la contessa | Contessa | Contessa vedova, madre di uno dei figli del re. Siede al tavolo d'onore con aria assente. |
| D | **Domenico** | il prete | Sacerdote | Prete di corte: benedice il pane e il vino del banchetto. Ha confessato metà della sala. |
| E | **Elia** | il bardo | Bardo/a | Bardo: canta le imprese del re e dei suoi figli. Compone anche quando nessuno glielo chiede. |
| F | **Federico** | l'araldo | Araldo/a | Araldo di corte: annuncia gli ospiti e legge i bandi. Conosce l'ordine di ogni posto a tavola. |
| G | **Guido** | il cavaliere | Cavaliere | Cavaliere della guardia del re: siede vicino al trono per tradizione. Giura fedeltà a chi regna. |
| V | **Valdemaro** (vittima) | la vittima, il maggiore, acclamato erede | Principe | 23 anni, il maggiore dei figli del re. Acclamato erede al banchetto, davanti a tutta la corte. |

### Mappa

Righe R1… dall'alto, colonne C1… da sinistra; una lettera per stanza.

```
      C1 C2 C3 C4 C5 C6 C7 C8 
  R1  S  S  S  S  S  S  M  M  
  R2  S  S  S  S  S  S  M  M  
  R3  S  S  S  S  S  S  M  M  
  R4  S  S  S  S  S  S  M  M  
  R5  K  K  K  A  A  A  L  L  
  R6  K  K  K  A  A  A  L  L  
  R7  K  K  K  Y  Y  Y  Y  Y  
  R8  C  C  C  Y  Y  Y  Y  Y  
```

| Lettera | Stanza | Pavimento | Caselle | Mobili |
|---|---|---|---|---|
| S | La sala grande | Damasco rosso | 24 | trono (R1C3), stendardo (R1C1), stendardo (R1C6), candelabro (R2C2), candelabro (R2C5), tavolo (R3C3), tavolo (R3C4), panca (R4C2), panca (R4C5) |
| M | La galleria dei musici | Parquet a quadrotti | 8 | panca (R1C7), forziere (R4C8) |
| K | Le cucine di servizio | Mattoni | 9 | calderone (R5C1), camino (R7C1), botte (R6C3) |
| A | L'anticamera | Moquette rossa | 6 | panca (R6C4), statua (R5C6) |
| L | La loggia | Marmo bianco | 4 | pianta (R5C8) |
| Y | Il cortile d'onore | Ciottoli | 10 | pozzo (R7C6), carro (R8C8) |
| C | La cappella | Piastrelle decorate | 3 | altare (R8C2), candelabro (R8C1) |

**Porte tra le stanze:** La sala grande – La galleria dei musici; La sala grande – Le cucine di servizio; La sala grande – L'anticamera; La galleria dei musici – La loggia; Le cucine di servizio – L'anticamera; Le cucine di servizio – Il cortile d'onore; Le cucine di servizio – La cappella; L'anticamera – Il cortile d'onore; L'anticamera – La loggia; La loggia – Il cortile d'onore; Il cortile d'onore – La cappella. **Finestre:** 7.

_I mobili pieni (16) occupano la loro casella; panche, sgabelli, giacigli, tappeti e troni si possono occupare._

### Dossier del caso

**Introduzione** (mostrata al giocatore prima degli indizi):

> Nella sala grande, al banchetto, i nobili hanno appena acclamato Valdemaro come erede quando lui crolla tra i candelabri. Davanti al trono vuoto, la regina piange. Ti volti, e per un attimo sorride.

**Epilogo** (nota di chiusura, mostrata dopo la soluzione):

> Lord Alboino confessa: voleva evitare un'incoronazione che lo avrebbe escluso. Sotto il castone dell'anello col sigillo trovi l'ultimo foglietto: «Il re dormiva nel letto vicino alla finestra; quello vicino al camino era della regina». Hai nove testimonianze e una stanza da ricostruire.

---
