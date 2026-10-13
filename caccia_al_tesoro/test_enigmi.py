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
from enigmi import cifrari, deduzione, figure, forme, parole, visivi
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


class TestForme(unittest.TestCase):
    def test_conteggi_a_forza_bruta(self):
        for fig in forme.CATALOGO + [("quadrati", n) for n in (1, 2, 3, 4)] + [("triangoli", n) for n in (1, 2, 3, 4)]:
            with self.subTest(fig=fig):
                self.assertEqual(forme.conta(fig), forme.conta_a_forza_bruta(fig))

    def test_valori_noti(self):
        self.assertEqual(forme.conta(("quadrati", 4)), 30)
        self.assertEqual(forme.conta(("triangoli", 3)), 13)
        self.assertEqual(forme.conta(("quadrati", 4)) + forme.conta(("triangoli", 3)), 43)

    def test_catalogo_conti(self):
        for n, fig in forme.FIGURA_PER_CONTO.items():
            self.assertEqual(forme.conta(fig), n)

    def test_quattro_metodi_danno_una_parola(self):
        for metodo in forme.METODI:
            with self.subTest(metodo=metodo):
                e, d = forme.forme_medio(metodo, config.SOLUZIONI["forme"], config.SEED)
                self.assertTrue(e.risposta.isalpha())
                if metodo == "scelta_multipla":
                    totale = forme.conta(forme.FIG_A) + forme.conta(forme.FIG_B)
                    self.assertIn((totale, e.risposta), d["righe"])
                    self.assertEqual(len({t for t, _ in d["righe"]}), len(d["righe"]))
                elif metodo == "mini_figure":
                    lettere = ""
                    for pr in d["prove"]:
                        self.assertEqual(forme.conta(pr["fig"]), pr["vero"])
                        numeri = [n for n, _ in pr["opzioni"]]
                        self.assertEqual(len(set(numeri)), 3)
                        self.assertEqual(len({l for _, l in pr["opzioni"]}), 3)
                        lettere += dict(pr["opzioni"])[pr["vero"]]
                    self.assertEqual(lettere, e.risposta)
                elif metodo == "coordinate":
                    lettere = ""
                    for (r, c), (vr, vc, fr, fc) in zip(d["scelte"], d["coppie"]):
                        self.assertEqual(forme.conta(fr), vr)
                        self.assertEqual(forme.conta(fc), vc)
                        self.assertEqual(forme.VALORI_COORDINATE[r], vr)
                        lettere += d["griglia"][r][c]
                    self.assertEqual(lettere, e.risposta)
                    self.assertEqual(len(set(d["scelte"])), 5)
                else:
                    lettere = "".join(ALFABETO[forme.conta(pr["fig"]) - 1] for pr in d["prove"])
                    self.assertEqual(lettere, e.risposta)


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


class TestPdf(unittest.TestCase):
    def test_genera_pdf(self):
        with tempfile.TemporaryDirectory() as t:
            for sol in (False, True):
                path = os.path.join(t, f"x{int(sol)}.pdf")
                genera.scrivi(ENIGMI, path, sol)
                self.assertGreater(os.path.getsize(path), 5000)
            path = os.path.join(t, "varianti.pdf")
            elenco = genera.scrivi_varianti(path)
            self.assertEqual([m for m, _ in elenco], forme.METODI)
            self.assertGreater(os.path.getsize(path), 5000)

    def test_ogni_metodo_enigma_8_nel_fascicolo(self):
        for metodo in forme.METODI:
            enigmi = genera.crea_enigmi(metodo_forme=metodo)
            self.assertEqual(len(enigmi), 12)
            self.assertTrue(enigmi[7].risposta.isalpha())


if __name__ == "__main__":
    unittest.main()
