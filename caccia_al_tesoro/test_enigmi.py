"""Verifica che ogni enigma abbia una soluzione unica e che la risposta sia sempre una parola.

Uso:  python -m unittest test_enigmi -v      (dalla cartella caccia_al_tesoro)
"""
import itertools
import os
import random
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import config
import genera
from enigmi import cifrari, deduzione, figure, giochi_tavolo, parole, visivi
from enigmi import mini_conversioni as mini
from enigmi import plancia_finale as pf
from enigmi import codici as cod
from enigmi.alfabeto import ALFABETO, sposta

DATI = {}
ENIGMI = genera.crea_enigmi(dati=DATI)


class TestGenerali(unittest.TestCase):
    def test_dodici_enigmi_sei_facili_sei_medi(self):
        self.assertEqual(len(ENIGMI), 12)
        self.assertEqual([i + 1 for i, e in enumerate(ENIGMI) if e.livello == 1], [1, 2, 5, 6, 9, 10])
        self.assertEqual([i + 1 for i, e in enumerate(ENIGMI) if e.livello == 2], [3, 4, 7, 8, 11, 12])

    def test_ogni_risposta_e_una_parola(self):
        for i, e in enumerate(ENIGMI, 1):
            with self.subTest(enigma=i):
                self.assertTrue(e.risposta.replace(" ", "").isalpha(), e.risposta)
                self.assertEqual(e.risposta, e.risposta.upper())
                self.assertTrue(all(ch in ALFABETO or ch == " " for ch in e.risposta), e.risposta)
                self.assertGreaterEqual(len(e.risposta), 3)

    def test_slot_mantenuti(self):
        self.assertEqual(ENIGMI[4].risposta, config.PAROLA_LABIRINTO.upper())
        self.assertEqual(ENIGMI[9].risposta, DATI["ladro"].upper())
        self.assertEqual(ENIGMI[10].titolo, "Cugini e animali")

    def test_alfabeto(self):
        self.assertEqual(len(ALFABETO), 21)
        self.assertEqual(sposta(sposta("ESTATE", 3), -3), "ESTATE")


class TestCifrari(unittest.TestCase):
    def test_simboli(self):
        d = DATI["simboli"]
        self.assertEqual(len(set(d["mappa"].values())), 21)
        self.assertEqual(cifrari.decodifica_simboli(d), config.SOLUZIONI["simboli"])

    def test_cesare(self):
        d = DATI["cesare"]
        self.assertNotEqual(d["cifrato"], d["parola"])
        self.assertEqual(cifrari.decodifica_cesare(d), config.SOLUZIONI["cesare"])

    def test_pigpen(self):
        d = DATI["pigpen"]
        spec = d["spec"]
        self.assertEqual(len(spec), 21)
        self.assertEqual(len(set(spec.values())), 21, "ogni lettera ha un simbolo diverso")
        msg = [spec[ch] for ch in d["parola"]]
        self.assertEqual(cifrari.decodifica_pigpen(d, msg), config.SOLUZIONI["pigpen"])


class TestParole(unittest.TestCase):
    def test_scala_di_parole(self):
        self.assertEqual(parole.controlla_scala(parole.SCALA), "MARE")
        self.assertEqual(ENIGMI[1].risposta, "MARE")

    def test_mastermind_unica_soluzione(self):
        d = DATI["mastermind"]
        segreta = d["parola"]
        self.assertEqual(len(set(segreta)), len(segreta))
        compatibili = [
            "".join(p) for p in itertools.permutations(ALFABETO, len(segreta))
            if all(parole.feedback(p, t) == fb for t, fb in d["tentativi"])
        ]
        self.assertEqual(compatibili, [segreta])
        for t, fb in d["tentativi"]:
            self.assertEqual(parole.feedback(t, segreta), fb)
            self.assertNotEqual(t, segreta)

    def test_pixel_ogni_lettera_unica(self):
        for lettera in parole.GLIFI:
            with self.subTest(lettera=lettera):
                b = parole.crea_pixel_lettera(lettera)
                sol = parole.risolvi_nonogram(b["righe"], b["colonne"], b["noti"], limite=5)
                self.assertEqual(len(sol), 1)
                self.assertEqual(sol[0], b["griglia"])

    def test_pixel_enigma(self):
        d = DATI["pixel"]
        self.assertEqual("".join(b["lettera"] for b in d["blocchi"]), config.SOLUZIONI["pixel"])
        for b in d["blocchi"]:
            self.assertEqual(len(parole.risolvi_nonogram(b["righe"], b["colonne"], b["noti"], limite=3)), 1)

    def test_glifi_5x5(self):
        for lettera, righe in parole.GLIFI.items():
            self.assertEqual(len(righe), 5, lettera)
            self.assertTrue(all(len(r) == 5 for r in righe), lettera)
        self.assertEqual(set(parole.GLIFI), set(ALFABETO))


class TestFigure(unittest.TestCase):
    def test_serie(self):
        d = DATI["serie"]
        lettere = ""
        for pr in d["prove"]:
            stati = [s for s, _ in pr["opzioni"]]
            self.assertEqual(len(set(stati)), 4)
            self.assertEqual(stati.count(pr["giusta"]), 1)
            lettere += [l for s, l in pr["opzioni"] if s == pr["giusta"]][0]
            self.assertEqual(len({l for _, l in pr["opzioni"]}), 4, "lettere delle opzioni tutte diverse")
        self.assertEqual(lettere, config.SOLUZIONI["serie"])

    def test_ombre_e_specchi(self):
        d = DATI["ombre"]
        lettere = ""
        for pr in d["prove"]:
            forma = pr["forma"]
            self.assertTrue(figure.e_chirale(forma))
            self.assertEqual(len(set(figure.tutte_le_rotazioni(forma))), 4)
            target = figure.specchia(forma) if pr["tipo"] == "specchio" else forma
            opzioni = [f for f, _ in pr["opzioni"]]
            self.assertEqual(len(set(opzioni)), 4)
            self.assertEqual(opzioni.count(target), 1)
            self.assertEqual(pr["giusta"], target)
            lettere += [l for f, l in pr["opzioni"] if f == target][0]
        self.assertEqual(lettere, config.SOLUZIONI["ombre"])

    def test_specchio_diverso_da_rotazioni(self):
        rng = random.Random(1)
        for _ in range(30):
            f = figure.forma_casuale(rng)
            self.assertNotIn(figure.specchia(f), figure.tutte_le_rotazioni(f))


class TestGiochiTavolo(unittest.TestCase):
    def test_conteggi_meeple(self):
        d = DATI["forme"]
        self.assertEqual(d["parola"], "MEEPLE")
        self.assertEqual(d["conteggi"], [11, 5, 5, 14, 10, 5])  # le lettere di MEEPLE con A=1, B=2...
        self.assertEqual(giochi_tavolo.verifica_scena(d["scena"]), d["conteggi"])
        tipi = [q["tipo"] for q in d["scena"]["domande"]]
        self.assertEqual(len(set(tipi)), 6, "un tipo di domanda diverso per ogni lettera")

    def test_triangoli_due_metodi(self):
        """Il conteggio dei triangoli coincide con un secondo calcolo indipendente."""
        rng = random.Random(7)
        for _ in range(120):
            a, b = rng.randrange(64), rng.randrange(64)
            segs = giochi_tavolo.segmenti_rosone(a, b)
            self.assertEqual(giochi_tavolo.conta_triangoli(segs), giochi_tavolo.conta_triangoli_per_rette(segs),
                             (a, b))

    def test_triangoli_valori_noti(self):
        self.assertEqual(giochi_tavolo.conta_triangoli(giochi_tavolo.segmenti_rosone(0, 0)), 0)
        self.assertEqual(giochi_tavolo.conta_triangoli(giochi_tavolo.segmenti_rosone(63, 0)), 6)    # 6 raggi
        self.assertEqual(giochi_tavolo.conta_triangoli(giochi_tavolo.segmenti_rosone(0, 21)), 4)    # 3 diagonali corte
        self.assertEqual(giochi_tavolo.conta_triangoli(giochi_tavolo.segmenti_rosone(0, 63)), 32)   # tutte le corte
        for n in (5, 10, 11, 14, 4, 25):
            ma, mb = giochi_tavolo.trova_rosone(n)
            self.assertEqual(giochi_tavolo.conta_triangoli(giochi_tavolo.segmenti_rosone(ma, mb)), n)

    def test_altre_parole(self):
        for parola in ("MAPPA", "DADO", "FATA", "TAVOLA", "CARTA"):
            with self.subTest(parola=parola):
                e, d = giochi_tavolo.enigma_plancia("tracciato", parola, config.SEED)
                self.assertEqual(e.risposta, parola)
                self.assertEqual(giochi_tavolo.verifica_scena(d["scena"]), d["conteggi"])

    def test_parola_impossibile(self):
        with self.assertRaises(ValueError):
            giochi_tavolo.enigma_plancia("tracciato", "ZUZU", config.SEED)  # troppi conteggi altissimi
        with self.assertRaises(ValueError):
            giochi_tavolo.enigma_plancia("tracciato", "PAROLALUNGA", config.SEED)

    def test_sei_metodi_stessa_plancia_stessa_parola(self):
        plance = []
        for metodo in giochi_tavolo.METODI:
            with self.subTest(metodo=metodo):
                e, d = giochi_tavolo.enigma_plancia(metodo, "MEEPLE", config.SEED)
                self.assertEqual(e.risposta, "MEEPLE")
                plance.append((d["conteggi"], d["scena"]["mappa"], d["scena"]["dadi"]))
                conteggi, parola = d["conteggi"], d["parola"]
                if metodo == "tabella_a1":
                    self.assertEqual("".join(ALFABETO[n - 1] for n in conteggi), parola)
                elif metodo == "tracciato":
                    self.assertEqual("".join(d["tracciato"][n] for n in conteggi), parola)
                    self.assertEqual(sorted(d["tracciato"]), list(range(1, 22)))
                elif metodo == "griglia_esagonale":
                    self.assertEqual("".join(d["griglia"][i][n - 1] for i, n in enumerate(conteggi)), parola)
                    self.assertTrue(all(len(r) == 21 for r in d["griglia"]))
                elif metodo == "carte":
                    lettere = ""
                    for n, opzioni in zip(conteggi, d["carte"]):
                        self.assertEqual(len({x for x, _ in opzioni}), 3)
                        self.assertEqual(len({l for _, l in opzioni}), 3)
                        lettere += dict(opzioni)[n]
                    self.assertEqual(lettere, parola)
                elif metodo == "classifica":
                    totali = [t for t, _ in d["classifica"]]
                    self.assertEqual(len(set(totali)), len(totali))
                    self.assertEqual(sum(conteggi), 50)
                    self.assertIn((50, "MEEPLE"), d["classifica"])
                elif metodo == "personaggi":
                    self.assertEqual(sorted(d["personaggi"]), list(range(1, 22)))
                    self.assertEqual(len(set(d["personaggi"].values())), 21)
                    self.assertEqual("".join(d["personaggi"][n][0] for n in conteggi), parola)
        self.assertTrue(all(p == plance[0] for p in plance), "la plancia è la stessa per tutti i metodi")

    def test_terreni_e_meeple(self):
        scena = DATI["forme"]["scena"]
        self.assertEqual(len(scena["mappa"]), 19)
        self.assertEqual(set(scena["mappa"].values()), set(giochi_tavolo.TERRENI))
        stili = {m["stile"] for m in scena["meeple"]}
        self.assertEqual(stili, set(giochi_tavolo.STILI_MEEPLE))
        for cella in {m["cella"] for m in scena["meeple"]}:
            self.assertLessEqual(sum(1 for m in scena["meeple"] if m["cella"] == cella), 2)


class TestVisivi(unittest.TestCase):
    def test_labirinto_percorso_e_parola(self):
        d = DATI["labirinto"]
        aperti = d["aperti"]
        nx, ny = d["w"], d["h"]
        passaggi = sum(len(v) for v in aperti.values()) // 2
        self.assertEqual(passaggi, nx * ny - 1)  # perfetto: un solo percorso fra due celle
        p = d["percorso"]
        self.assertEqual(p[0], (0, 0))
        self.assertEqual(p[-1], (nx - 1, ny - 1))
        for a, b in zip(p, p[1:]):
            self.assertIn(b, aperti[a])
        self.assertEqual(visivi.lettere_sul_percorso(d), config.PAROLA_LABIRINTO)


class TestDeduzione(unittest.TestCase):
    def test_ladro_unico(self):
        sosp = deduzione._sospetti(config.NOMI)
        self.assertEqual(deduzione.colpevoli_ladro(sosp), [DATI["ladro"]])

    def test_logica_unica(self):
        ass, indizi = DATI["logica"]
        trovate = deduzione._soluzioni(indizi, limite=5)
        self.assertEqual(len(trovate), 1)
        self.assertEqual(trovate[0], ass)
        self.assertTrue(all(deduzione._vero(ass, i) for i in indizi))


class TestMiniConversioni(unittest.TestCase):
    CASI = [(43, "MEEPLE"), (50, "SOLE"), (7, "ZUCCA"), (99, "TESORO"), (10, "DADO"), (1, "ARCO"), (28, "FIORISTA"[:7])]

    @staticmethod
    def da_romano(r):
        v = {"I": 1, "V": 5, "X": 10}
        tot = 0
        for a, b in zip(r, r[1:] + " "):
            tot += -v[a] if b in v and v[a] < v[b] else v[a]
        return tot

    def test_dieci_mini_dal_facile_al_difficile(self):
        minis = mini.crea_mini(43, "MEEPLE")
        self.assertEqual(len(minis), 10)
        livelli = [m.livello for m in minis]
        self.assertEqual(livelli, sorted(livelli))
        self.assertEqual(set(livelli), {1, 2, 3})
        self.assertEqual(len({m.titolo for m in minis}), 10)

    def test_numeri_e_parole_non_validi(self):
        for numero, parola in ((0, "SOLE"), (100, "SOLE"), (43, "JOLLY"), (43, "AB"), (43, "MEEPLE E")):
            with self.assertRaises(ValueError):
                mini.crea_mini(numero, parola)

    def test_aritmetica(self):
        self.assertEqual(mini.somma_cifre(43), 7)
        self.assertEqual(mini.prodotto_cifre(43), 12)
        self.assertEqual(mini.chiave_una_cifra(99), 9)   # 9+9=18 -> 9
        self.assertEqual(mini.chiave_una_cifra(10), 10)  # radice 1 -> 10
        self.assertEqual([mini.romano(n) for n in (4, 9, 14, 19, 24, 39)], ["IV", "IX", "XIV", "XIX", "XXIV", "XXXIX"])
        for n in range(1, 40):
            self.assertEqual(self.da_romano(mini.romano(n)), n)

    def test_decodifica_di_ogni_mini(self):
        """Per ogni mini enigma si decodifica a mano (con le regole della consegna) il messaggio stampato."""
        for numero, parola in self.CASI:
            with self.subTest(numero=numero, parola=parola):
                m = {x.titolo: x for x in mini.crea_mini(numero, parola, seed=5)}
                s = mini.somma_cifre(numero)
                k = mini.chiave_una_cifra(numero)
                ds = mini.cifre(numero)
                # 1) Cesare con la somma delle cifre
                d = m["Cesare con la somma delle cifre"].dati
                self.assertEqual(d["chiave"], s)
                self.assertEqual(sposta(d["cifrato"], -s), parola)
                # 2) cifre una alla volta
                d = m["Cesare con le cifre, una alla volta"].dati
                self.assertEqual("".join(sposta(ch, -ds[i % len(ds)]) for i, ch in enumerate(d["cifrato"])), parola)
                # 3) casella di partenza
                d = m["La casella di partenza"].dati
                self.assertEqual((d["riga"], d["colonna"]), divmod(numero, 10))
                letti = "".join(d["griglia"][d["riga"]][(d["colonna"] + i) % 10] for i in range(len(parola)))
                self.assertEqual(letti, parola)
                # 4) ruota dei salti: dalla stella, salto k, 23 caselle
                d = m["La ruota dei salti"].dati
                self.assertEqual(d["salto"], k)
                pos = d["partenza"]
                letti = ""
                for _ in parola:
                    letti += d["lettere"][pos]
                    pos = (pos + k) % mini.RUOTA
                self.assertEqual(letti, parola)
                self.assertEqual(len(set(d["posizioni"])), len(parola), "salti su caselle diverse")
                # 5) una lettera ogni K
                d = m["Una lettera ogni K"].dati
                self.assertEqual(d["passo"], k)
                self.assertEqual("".join(d["lettere"][i * k - 1] for i in range(1, len(parola) + 1)), parola)
                # 6) gruppi a misura di cifra
                d = m["Gruppi a misura di cifra"].dati
                misure = [x if x > 0 else 10 for x in ds]
                pos, letti = 0, ""
                for i in range(len(parola)):
                    letti += d["lettere"][pos]
                    pos += misure[i % len(misure)]
                self.assertEqual(letti, parola)
                self.assertEqual(len(d["lettere"]), sum(misure[i % len(misure)] for i in range(len(parola))))
                # 7) calcoli
                d = m["Calcoli con il tuo numero"].dati
                self.assertEqual("".join(ALFABETO[mini.valuta(e, numero) - 1] for e in d["espressioni"]), parola)
                # 8) alfabeto a rovescio
                d = m["L'alfabeto a rovescio"].dati
                rev = ALFABETO[::-1]
                self.assertEqual("".join(rev[x - s - 1] for x in d["numeri"]), parola)
                # 9) numeri romani
                d = m["Numeri romani"].dati
                self.assertEqual("".join(ALFABETO[self.da_romano(r) - s - 1] for r in d["romani"]), parola)
                # 10) Pigpen + Cesare
                d = m["Pigpen e Cesare insieme"].dati
                self.assertEqual(sposta(d["pigpen"], -s), parola)

    def test_pdf_mini(self):
        import genera_mini
        with tempfile.TemporaryDirectory() as t:
            for sol in (False, True):
                path = os.path.join(t, f"m{int(sol)}.pdf")
                genera_mini.scrivi(mini.crea_mini(43, "MEEPLE"), path, 43, "MEEPLE", sol)
                self.assertGreater(os.path.getsize(path), 5000)


class TestPlanciaFinale(unittest.TestCase):
    def test_conteggi_con_somma_esatta(self):
        iv = pf._intervalli()
        for punteggio in (19, 35, 50, 72, 85):
            with self.subTest(punteggio=punteggio):
                c1 = pf.scegli_conteggi(punteggio, random.Random(3))
                self.assertEqual(sum(c1.values()), punteggio)
                self.assertEqual(list(c1), pf.ORDINE)
                for tipo, n in c1.items():
                    self.assertIn(n, iv[tipo])
                self.assertEqual(c1, pf.scegli_conteggi(punteggio, random.Random(3)), "riproducibile dal seme")

    def test_scena_e_codice(self):
        for punteggio, parola, seme in ((50, "MEEPLE", 2026), (23, "DADO", 1), (85, "TESORO", 5), (64, "ZUCCA", 9)):
            with self.subTest(punteggio=punteggio):
                d = pf.crea_plancia_finale(punteggio, parola, seme)
                risposte = giochi_tavolo.verifica_scena(d["scena"])
                self.assertEqual(risposte, [d["conteggi"][t] for t in pf.ORDINE])
                self.assertEqual(sum(risposte), punteggio)
                self.assertEqual(d["chiave"], mini.somma_cifre(punteggio))
                self.assertEqual(sposta(d["pigpen"], -d["chiave"]), parola)
                self.assertEqual(len(set(m["cella"] for m in d["scena"]["meeple"])) > 0, True)
                self.assertEqual(len(d["scena"]["monete"]), d["conteggi"]["monete"])

    def test_errori(self):
        for punteggio in (5, 18, 86, 200):
            with self.assertRaises(ValueError):
                pf.crea_plancia_finale(punteggio, "MEEPLE", 1)
        for parola in ("JOLLY", "AB", "MEEPLE E"):
            with self.assertRaises(ValueError):
                pf.crea_plancia_finale(50, parola, 1)

    def test_niente_numero_e_difficolta_e_biglietto(self):
        import shutil
        import subprocess
        import genera_plancia
        if not shutil.which("pdftotext"):
            self.skipTest("pdftotext non disponibile")
        d = pf.crea_plancia_finale(50, "MEEPLE", 2026)
        aiuto = genera_plancia.aiuto_da_config()
        self.assertEqual(aiuto["luogo"], "Desteenazione")
        self.assertEqual(aiuto["indirizzo"], "Via Livorno 7, Brescia")

        def testo(path, pagina):
            return subprocess.run(["pdftotext", "-f", str(pagina), "-l", str(pagina), path, "-"],
                                  capture_output=True, text=True, check=True).stdout

        with tempfile.TemporaryDirectory() as t:
            giocatori, soluzioni, senza = (os.path.join(t, n) for n in ("g.pdf", "s.pdf", "n.pdf"))
            genera_plancia.scrivi(d, giocatori, False, aiuto)
            genera_plancia.scrivi(d, soluzioni, True, aiuto)
            genera_plancia.scrivi(d, senza, False, None)
            vietate = ("ENIGMA N", "MINI ENIGMA", "MEDIO", "DIFFICILE", "FACILE")
            for path in (giocatori, soluzioni, senza):
                for pagina in (1, 2):
                    tx = testo(path, pagina)
                    for v in vietate:
                        self.assertNotIn(v, tx, f"{os.path.basename(path)} pag. {pagina}: '{v}'")
            for pagina in (1, 2):
                tx = testo(giocatori, pagina)
                self.assertIn("Desteenazione", tx)
                self.assertIn("Via Livorno 7, Brescia", tx)
                self.assertIn("Se non riesci a risolvere l'enigma, vai a", tx)
                for path in (soluzioni, senza):
                    self.assertNotIn("Via Livorno", testo(path, pagina), "il biglietto non va nelle soluzioni")

    def test_pdf_solo_grigi(self):
        import shutil
        import subprocess
        import genera_plancia
        d = pf.crea_plancia_finale(50, "MEEPLE", 2026)
        with tempfile.TemporaryDirectory() as t:
            for sol in (False, True):
                path = os.path.join(t, f"x{int(sol)}.pdf")
                genera_plancia.scrivi(d, path, sol, genera_plancia.aiuto_da_config())
                self.assertGreater(os.path.getsize(path), 8000)
                if shutil.which("pdftoppm"):
                    prefisso = os.path.join(t, f"img{int(sol)}")
                    subprocess.run(["pdftoppm", "-r", "40", "-png", path, prefisso], check=True)
                    from PIL import Image, ImageChops
                    immagini = [f for f in os.listdir(t) if f.startswith(f"img{int(sol)}") and f.endswith(".png")]
                    self.assertEqual(len(immagini), 2)
                    for nome in immagini:
                        r, g, b = Image.open(os.path.join(t, nome)).convert("RGB").split()
                        self.assertIsNone(ImageChops.difference(r, g).getbbox(), f"{nome}: pixel non grigi")
                        self.assertIsNone(ImageChops.difference(g, b).getbbox(), f"{nome}: pixel non grigi")


class TestCodici(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.blocchi = cod.crea_catalogo("CASTELLO")

    def test_regole_per_riga_iniettive(self):
        for chiave, r in cod.REGOLE.items():
            if not r.deduzione:
                clue = [r.funzione(l) for l in cod.LINEE]
                self.assertEqual(len(set(clue)), 32, chiave)

    def test_ogni_regola_ogni_lettera_unica(self):
        """Per qualunque lettera dell'alfabeto, ogni voce del catalogo ha una sola soluzione (con poche caselle di partenza)."""
        for voce in cod.CATALOGO:
            base, trab = voce
            for lettera in ALFABETO:
                with self.subTest(voce=voce, lettera=lettera):
                    p = cod.pattern_voce(lettera, voce)
                    righe, colonne = cod.clue_pattern(p, base)
                    hint = cod.crea_hint(p, base)
                    self.assertLessEqual(len(hint), 4)
                    sol = cod.risolvi(righe, colonne, base, hint, 3)
                    self.assertEqual(sol, [p])
                    self.assertEqual(cod.togli_trabocchetto(sol[0], trab), cod.griglia_glifo(lettera))

    def test_valori_noti_della_L(self):
        L = cod.griglia_glifo("L")
        r, c = cod.clue_pattern(L, "binario")
        self.assertEqual(r, ((16,), (16,), (16,), (16,), (31,)))
        self.assertEqual(c, ((31,), (1,), (1,), (1,), (1,)))
        r, c = cod.clue_pattern(L, "somma_pos")
        self.assertEqual((r, c), (((1,), (1,), (1,), (1,), (15,)), ((15,), (5,), (5,), (5,), (5,))))
        r, c = cod.clue_pattern(L, "primi")
        self.assertEqual(r[4], (2310,))
        self.assertEqual(c[1], (11,))
        r, c = cod.clue_pattern(L, "ternario")
        self.assertEqual(r[0], (1,))
        self.assertEqual(r[4], (121,))
        r, c = cod.clue_pattern(L, "salti")
        self.assertEqual(r[4], (1, 1, 1, 1, 1))
        r, c = cod.clue_pattern(L, "progressive")
        self.assertEqual(r[4], (1, 3, 6, 10, 15))
        r, c = cod.clue_pattern(L, "binario2")
        self.assertEqual((r[0], r[4]), ((2, 0), (3, 7)))

    def test_catalogo_blocchi(self):
        self.assertEqual(len(self.blocchi), 22)
        livelli = [cod.livello_voce(b["voce"]) for b in self.blocchi]
        self.assertEqual(livelli, sorted(livelli), "dal più facile al più difficile")
        usate = set()
        for b in self.blocchi:
            self.assertIn(len(b["esempi"]), (1, 2))
            lettere = [e["lettera"] for e in b["esempi"]]
            self.assertTrue(set(lettere).isdisjoint(set("CASTELLO")), "gli esempi non sono lettere della parola")
            self.assertNotIn(b["bersaglio"]["lettera"], lettere)
            self.assertTrue(cod.esempi_validi(b["voce"], lettere, cod.CATALOGO))
            for e in b["esempi"]:
                self.assertEqual((e["righe"], e["colonne"]), cod.clue_pattern(e["pattern"], b["voce"][0]))
            usate |= set(lettere)
        self.assertGreater(len(usate), 8, "lettere di esempio varie")

    def test_trabocchetti_visibili(self):
        for b in self.blocchi:
            trab = b["voce"][1]
            if trab in ("specchio", "capovolto"):
                for e in b["esempi"]:
                    self.assertNotEqual(e["pattern"], cod.griglia_glifo(e["lettera"]))

    def test_pdf_catalogo_senza_spoiler(self):
        import shutil
        import subprocess
        from enigmi import dossier_codici
        with tempfile.TemporaryDirectory() as t:
            g, s = os.path.join(t, "g.pdf"), os.path.join(t, "s.pdf")
            dossier_codici.scrivi_catalogo(self.blocchi, g, False)
            dossier_codici.scrivi_catalogo(self.blocchi, s, True)
            self.assertGreater(os.path.getsize(g), 5000)
            if shutil.which("pdftotext"):
                tg = subprocess.run(["pdftotext", g, "-"], capture_output=True, text=True, check=True).stdout.upper()
                ts = subprocess.run(["pdftotext", s, "-"], capture_output=True, text=True, check=True).stdout.upper()
                for nome in ("SALTI", "BINARIO", "SOMME PROGRESSIVE", "ESTREMI", "POTENZE DI 3", "PRODOTTI", "FATTORIALI",
                             "CODICE GRAY", "MONETE ROMANE", "TRE MISURE", "DISPARI E PARI"):
                    self.assertNotIn(nome, tg, "il PDF dei giocatori non rivela le regole")
                    self.assertIn(nome, ts)


class TestEnigmaCodici(unittest.TestCase):
    @staticmethod
    def conta_forza_bruta(voce, lettera):
        """Conteggio indipendente dal solver: righe candidate dalla funzione della regola, colonne ricalcolate a mano."""
        base = voce[0]
        f = cod.REGOLE[base].funzione
        p = cod.pattern_voce(lettera, voce)
        righe = [f(r) for r in p]
        colonne = [f(tuple(p[r][c] for r in range(5))) for c in range(5)]
        hint = cod.crea_hint(p, base)
        cand = [[l for l in cod.LINEE if f(l) == righe[r] and all(hint.get((r, c), l[c]) == l[c] for c in range(5))]
                for r in range(5)]
        return sum(1 for g in itertools.product(*cand)
                   if all(f(tuple(g[r][c] for r in range(5))) == colonne[c] for c in range(5)))

    def test_soluzione_unica_forza_bruta(self):
        for voce in cod.CATALOGO:
            for lettera in ALFABETO:
                self.assertEqual(self.conta_forza_bruta(voce, lettera), 1, (voce, lettera))

    def test_enigma_dodici_lettere(self):
        blocchi = cod.crea_enigma("NASCONDIGLIO")
        self.assertEqual(len(blocchi), 12)
        self.assertEqual("".join(b["bersaglio"]["lettera"] for b in blocchi), "NASCONDIGLIO")
        self.assertEqual(len({b["voce"] for b in blocchi}), 12)
        livelli = [cod.livello_voce(b["voce"]) for b in blocchi]
        self.assertEqual(livelli, sorted(livelli))
        for b in blocchi:
            self.assertTrue(cod.verifica_unica(b))
            for e in b["esempi"]:
                self.assertNotIn(e["lettera"], "NASCONDIGLIO")

    def test_parole_piu_corte_usano_meno_regole(self):
        for parola in ("SOLE", "CASTELLO", "A"):
            blocchi = cod.crea_enigma(parola)
            self.assertEqual(len(blocchi), len(parola))
            self.assertEqual(len({b["voce"] for b in blocchi}), len(parola))
        with self.assertRaises(ValueError):
            cod.crea_enigma("A" * 23)

    def test_pdf_enigma(self):
        import shutil
        import subprocess
        from enigmi import dossier_enigma
        blocchi = cod.crea_enigma("NASCONDIGLIO")
        with tempfile.TemporaryDirectory() as t:
            g, s = os.path.join(t, "g.pdf"), os.path.join(t, "s.pdf")
            dossier_enigma.scrivi_enigma(blocchi, "NASCONDIGLIO", g, False)
            dossier_enigma.scrivi_enigma(blocchi, "NASCONDIGLIO", s, True)
            if shutil.which("pdftotext"):
                tg = subprocess.run(["pdftotext", g, "-"], capture_output=True, text=True, check=True).stdout.upper()
                ts = subprocess.run(["pdftotext", s, "-"], capture_output=True, text=True, check=True).stdout.upper()
                self.assertIn("PROFESSORESSA", tg)
                self.assertIn("CODICE 12", tg)
                for b in blocchi:
                    nome = cod.nome_voce(b["voce"]).upper()
                    self.assertNotIn(nome, tg, "il PDF dei giocatori non rivela le regole")
                    self.assertIn(nome, ts, "la versione per gli spiegatori spiega ogni regola")


class TestPoolCodici(unittest.TestCase):
    """Pool unico di 22 regole (12 della prima serie + 10 difficili della seconda)."""

    def test_pool(self):
        self.assertEqual(len(cod.CATALOGO), 22)
        self.assertEqual(len(set(cod.CATALOGO)), 22)
        livelli = [cod.livello_voce(v) for v in cod.CATALOGO]
        self.assertEqual(livelli, sorted(livelli), "ordinato dal più facile al più difficile")
        self.assertEqual(livelli.count(1), 5)
        self.assertEqual(len([v for v in cod.CATALOGO if v[1]]), 3)

    def test_romani(self):
        for n, r in ((0, "0"), (4, "IV"), (9, "IX"), (19, "XIX"), (31, "XXXI"), (38, "XXXVIII"), (144, "CXLIV")):
            self.assertEqual(cod._romano(n), r)

    def test_caselle_di_partenza_al_massimo_quattro(self):
        for voce in cod.CATALOGO:
            for lettera in ALFABETO:
                self.assertLessEqual(len(cod.crea_hint(cod.pattern_voce(lettera, voce), voce[0])), 4, (voce, lettera))

    def test_enigma_ventidue_lettere_usa_tutte_le_regole(self):
        parola = "ABBABBABBABBABBABBABBA"
        blocchi = cod.crea_enigma(parola)
        self.assertEqual([b["voce"] for b in blocchi], cod.CATALOGO)
        self.assertEqual("".join(b["bersaglio"]["lettera"] for b in blocchi), parola)
        for b in blocchi:
            self.assertTrue(cod.verifica_unica(b))
            for e in b["esempi"]:
                self.assertTrue(set(e["lettera"]).isdisjoint(set(parola)))

    def test_troppe_lettere_diverse_dicono_errore(self):
        with self.assertRaises(ValueError):
            cod.crea_enigma(ALFABETO)  # 21 lettere diverse: nessuna lettera libera per gli esempi
        with self.assertRaises(ValueError):
            cod.crea_enigma(ALFABETO + "AAA")  # 24 lettere

    def test_pdf_enigma_ventidue(self):
        from enigmi import dossier_enigma
        parola = "ABBABBABBABBABBABBABBA"
        blocchi = cod.crea_enigma(parola)
        with tempfile.TemporaryDirectory() as t:
            for sol in (False, True):
                path = os.path.join(t, f"x{int(sol)}.pdf")
                dossier_enigma.scrivi_enigma(blocchi, parola, path, sol)
                self.assertGreater(os.path.getsize(path), 5000)


class TestPdf(unittest.TestCase):
    def test_genera_pdf(self):
        with tempfile.TemporaryDirectory() as t:
            for sol in (False, True):
                path = os.path.join(t, f"x{int(sol)}.pdf")
                genera.scrivi(ENIGMI, path, sol)
                self.assertGreater(os.path.getsize(path), 5000)
            path = os.path.join(t, "varianti.pdf")
            elenco = genera.scrivi_varianti(path)
            self.assertEqual([m for m, _ in elenco], giochi_tavolo.METODI)
            self.assertGreater(os.path.getsize(path), 5000)

    def test_ogni_metodo_enigma_8_nel_fascicolo(self):
        for metodo in giochi_tavolo.METODI:
            enigmi = genera.crea_enigmi(metodo_forme=metodo)
            self.assertEqual(len(enigmi), 12)
            self.assertTrue(enigmi[7].risposta.isalpha())


if __name__ == "__main__":
    unittest.main()
