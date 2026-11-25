"""Barra di progresso su una riga, aggiornata in tempo reale (senza dipendenze).

    bar = Progress(totale, "Foto")
    for elemento in elementi:
        ...
        bar.step(nome)      # avanza di uno e ridisegna: Foto [#####-----] 12/200   6%  2:10 trascorsi, ~30:00 mancanti  ultimo: nome
    bar.done()

`bar.note("testo")` stampa una riga sopra la barra. Se l'uscita non è un terminale (file, pipe) non riscrive la riga: stampa una
riga ogni 5%.
"""

from __future__ import annotations

import shutil
import sys
import time

CR = chr(13)
NL = chr(10)


def _clock(seconds: float) -> str:
    seconds = int(max(0, seconds))
    hours, rest = divmod(seconds, 3600)
    minutes, secs = divmod(rest, 60)
    return f"{hours}:{minutes:02d}:{secs:02d}" if hours else f"{minutes}:{secs:02d}"


class Progress:
    def __init__(self, total: int, label: str = "", stream=None, done_already: int = 0):
        self.total = max(1, total)
        self.label = label
        self.stream = stream or sys.stderr
        self.count = done_already
        self.start = time.time()
        self.started_at = done_already  # lavoro già fatto prima (cache): non conta nel calcolo del tempo che manca
        self.tty = hasattr(self.stream, "isatty") and self.stream.isatty()
        self._last_percent = -1
        self.draw("")

    def line(self, last: str = "") -> str:
        fraction = min(1.0, self.count / self.total)
        elapsed = time.time() - self.start
        worked = self.count - self.started_at
        eta = elapsed / worked * (self.total - self.count) if worked > 0 else 0
        width = max(10, min(30, shutil.get_terminal_size((80, 20)).columns - 75))
        filled = int(width * fraction)
        bar = "#" * filled + "-" * (width - filled)
        text = f"{self.label} [{bar}] {self.count}/{self.total} {int(fraction * 100):3d}%  {_clock(elapsed)} trascorsi"
        if worked > 0 and self.count < self.total:
            text += f", ~{_clock(eta)} mancanti"
        if last:
            text += f"  ultimo: {last}"
        return text

    def draw(self, last: str) -> None:
        text = self.line(last)
        if self.tty:
            columns = shutil.get_terminal_size((80, 20)).columns - 1
            self.stream.write(CR + text[:columns].ljust(columns))
            self.stream.flush()
            return
        percent = int(100 * self.count / self.total)
        if percent // 5 != self._last_percent // 5 or self.count >= self.total:
            self._last_percent = percent
            self.stream.write(text + NL)
            self.stream.flush()

    def note(self, text: str) -> None:
        """Stampa una riga sopra la barra (che si ridisegna sotto)."""
        if self.tty:
            columns = shutil.get_terminal_size((80, 20)).columns - 1
            self.stream.write(CR + " " * columns + CR + text + NL)
            self.draw("")
        else:
            self.stream.write(text + NL)
            self.stream.flush()

    def step(self, last: str = "", by: int = 1) -> None:
        self.count += by
        self.draw(last)

    def done(self) -> None:
        if self.tty:
            self.stream.write(NL)
            self.stream.flush()
