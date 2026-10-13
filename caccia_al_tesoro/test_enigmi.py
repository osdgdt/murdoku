"""Verifica che ogni enigma abbia una soluzione unica e una risposta coerente.

Uso:  python -m unittest test_enigmi -v      (dalla cartella caccia_al_tesoro)
"""
import itertools
import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import config
from enigmi import logica, visivi, deduzione


class TestLogica(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.enigmi, cls.dati = logica.crea(config.SEED)

    def _controlla_sudoku(self, d):
        n, br, bc = d["n"], d["br"], d["bc"]
        self.assertEqual(logica.conta_soluzioni_sudoku(d["puzzle"], n, br, bc, limite=5), 1)
        sol = d["soluzione"]
        for r in range(n):
            self.assertEqual(sorted(sol[r]), list(range(1, n + 1)))
        for c in range(n):
            self.assertEqual(sorted(sol[r][c] for r in range(n)), list(range(1, n + 1)))
        for r0 in range(0, n, br):
            for c0 in range(0, n, bc):
                blocco = [sol[r0 + i][c0 + j] for i in range(br) for j in range(bc)]
                self.assertEqual(sorted(blocco), list(range(1, n + 1)))
        for r in range(n):
            for c in range(n):
                if d["puzzle"][r][c]:
                    self.assertEqual(d["puzzle"][r][c], sol[r][c])
        for r, c in d["evidenziate"]:
            self.assertEqual(d["puzzle"][r][c], 0, "le caselle della risposta non devono essere date")

    def test_sudoku_4x4(self):
        self._controlla_sudoku(self.dati["sudoku4"])

    def test_sudoku_6x6(self):
        self._controlla_sudoku(self.dati["sudoku6"])

    def test_futoshiki(self):
        d = self.dati["futoshiki"]
        n = d["n"]
        self.assertEqual(logica.conta_futoshiki(n, d["dati"], d["vincoli"], limite=5), 1)
        sol = d["soluzione"]
        for r in range(n):
            self.assertEqual(sorted(sol[r]), list(range(1, n + 1)))
            self.assertEqual(sorted(sol[i][r] for i in range(n)), list(range(1, n + 1)))
        for a, b in d["vincoli"]:
            self.assertLess(sol[a[0]][a[1]], sol[b[0]][b[1]])
        for (r, c), v in d["dati"].items():
            self.assertEqual(sol[r][c], v)

    def test_futoshiki_confronto_forza_bruta(self):
        """Controllo indipendente del solver: conta le soluzioni enumerando tutte le righe possibili."""
        d = self.dati["futoshiki"]
        n = d["n"]
        perms = list(itertools.permutations(range(1, n + 1)))

        def rec(righe):
            if len(righe) == n:
                if any(len({r[c] for r in righe}) != n for c in range(n)):
                    return 0
                if any(not righe[a[0]][a[1]] < righe[b[0]][b[1]] for a, b in d["vincoli"]):
                    return 0
                return 1
            r = len(righe)
            tot = 0
            for p in perms:
                if any(p[c] == q[c] for q in righe for c in range(n)):
                    continue
                if any(d["dati"].get((r, c), p[c]) != p[c] for c in range(n)):
                    continue
                tot += rec(righe + [p])
            return tot

        self.assertEqual(rec([]), 1)

    def test_sequenze(self):
        e = [x for x in self.enigmi if x.titolo == "Completa la serie"][0]
        self.assertEqual(e.risposta, str(sum(seq[i] for seq, i, _ in logica.SEQUENZE)))
        self.assertEqual(e.risposta, "141")


class TestVisivi(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.enigmi, cls.dati = visivi.crea(config.SEED, config.PAROLA_LABIRINTO, config.FIGURA_PUNTINI)

    def test_labirinto_percorso_e_parola(self):
        d = self.dati["labirinto"]
        aperti = d["aperti"]
        nx, ny = d["w"], d["h"]
        # perfetto: n-1 passaggi => un solo percorso fra due celle qualsiasi
        passaggi = sum(len(v) for v in aperti.values()) // 2
        self.assertEqual(passaggi, nx * ny - 1)
        p = d["percorso"]
        self.assertEqual(p[0], (0, 0))
        self.assertEqual(p[-1], (nx - 1, ny - 1))
        for a, b in zip(p, p[1:]):
            self.assertIn(b, aperti[a])
        self.assertEqual(visivi.lettere_sul_percorso(d), config.PAROLA_LABIRINTO)

    def test_conteggi_forme(self):
        self.assertEqual(visivi.quadrati_in_griglia(4), 30)
        self.assertEqual(visivi.quadrati_in_griglia(2), 5)
        self.assertEqual(visivi.triangoli_in_triangolo(1), 1)
        self.assertEqual(visivi.triangoli_in_triangolo(2), 5)
        self.assertEqual(visivi.triangoli_in_triangolo(3), 13)
        self.assertEqual(visivi.triangoli_in_triangolo(4), 27)

    def test_risposta_forme(self):
        e = [x for x in self.enigmi if x.titolo == "Quante forme?"][0]
        self.assertEqual(e.risposta, "43")


class TestDeduzione(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.enigmi, cls.dati = deduzione.crea(config.SEED, config.NOMI)

    def test_indovinelli_iniziali(self):
        e = [x for x in self.enigmi if x.titolo == "Indovinelli in rima"][0]
        self.assertEqual(e.risposta, "PORTA")

    def test_ladro_unico(self):
        sosp = deduzione._sospetti(config.NOMI)
        self.assertEqual(deduzione.colpevoli_ladro(sosp), [self.dati["ladro"]])

    def test_logica_unica(self):
        ass, indizi = self.dati["logica"]
        trovate = deduzione._soluzioni(indizi, limite=5)
        self.assertEqual(len(trovate), 1)
        self.assertEqual(trovate[0], ass)
        self.assertTrue(all(deduzione._vero(ass, i) for i in indizi))

    def test_chi_mente_unico(self):
        dich = self.dati["chi_mente"]
        n = len(dich)
        possibili = [
            g for g in range(n)
            if sum(deduzione._vera(d, p, g) for p, d in enumerate(dich)) == 1
        ]
        self.assertEqual(len(possibili), 1)
        e = [x for x in self.enigmi if x.titolo == "Chi dice la verità?"][0]
        self.assertEqual(e.risposta, config.NOMI[possibili[0]].upper())
        self.assertEqual(len(set(dich)), n, "frasi tutte diverse")


class TestPdf(unittest.TestCase):
    def test_genera_pdf(self):
        import tempfile
        import genera
        enigmi = genera.crea_enigmi()
        self.assertEqual(len(enigmi), 12)
        self.assertEqual(sum(1 for e in enigmi if e.livello == 1), 6)
        self.assertEqual(sum(1 for e in enigmi if e.livello == 2), 6)
        with tempfile.TemporaryDirectory() as t:
            for sol in (False, True):
                path = os.path.join(t, f"x{int(sol)}.pdf")
                genera.scrivi(enigmi, path, sol)
                self.assertGreater(os.path.getsize(path), 5000)


if __name__ == "__main__":
    unittest.main()
