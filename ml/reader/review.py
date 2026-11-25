"""Pagina di correzione locale: la foto accanto ai dati letti, da correggere a mano; il solver dice se il caso torna.

    python -m reader.review            # dalla cartella ml/, con MURDOKU_DATA impostata → http://127.0.0.1:8765
    python -m reader.review --lan      # anche dal telefono, sulla stessa rete (Wi-Fi): stampa un link con un codice segreto

Solo libreria standard: un piccolo server su 127.0.0.1 (non esce dal computer; con --lan si apre alla rete locale, ma solo a
chi ha il link col codice, che cambia a ogni avvio). Le foto restano nella cartella dei dati,
le bozze corrette in `lavoro/bozze/`, i casi accettati in `lavoro/record/`. Niente di tutto questo va nel repository.
"""

from __future__ import annotations

import json
import os
import secrets
import socket
import sys
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from http.cookies import SimpleCookie
from urllib.parse import parse_qs, urlparse

import cv2

from murdoku_ml.unsupported import UNSUPPORTED

from . import config, draft, imageio
from .grammar import default_wording

HTML = Path(__file__).with_name("review.html")
_lock = threading.Lock()  # Tesseract e Node uno alla volta: semplice e senza sorprese
_image_cache: dict[tuple[str, int], bytes] = {}


def manifest() -> dict:
    return json.loads((config.work_dir() / "manifest.json").read_text(encoding="utf-8"))


def entry_for(number: int) -> dict | None:
    return next((c for c in manifest()["cases"] if c["number"] == number), None)


def status_of(number: int) -> str:
    path = config.work_dir() / "record" / f"{number:03d}.record.json"
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))["extraction"]["status"]
    return "bozza" if draft.draft_path(number).exists() else "da leggere"


def photo_list(entry: dict) -> list[dict]:
    photos = []
    for kind in ("personaggi", "mappa", "passaggi"):
        for index, name in enumerate(entry[kind]):
            photos.append({"kind": kind, "file": name, "label": kind.capitalize() + (f" {index + 1}" if len(entry[kind]) > 1 else "")})
    return photos


def jpeg(name: str, width: int) -> bytes:
    key = (name, width)
    if key in _image_cache:
        return _image_cache[key]
    image = imageio.load(config.data_dir() / name)
    cache = config.work_dir() / "pagine" / (name.rsplit(".", 1)[0] + ".json")
    if cache.exists():
        rotation = json.loads(cache.read_text(encoding="utf-8")).get("rotation", 0)
        if rotation:
            image = imageio.rotate(image, rotation)
    scale = min(1.0, width / image.shape[1])
    if scale < 1:
        image = cv2.resize(image, None, fx=scale, fy=scale, interpolation=cv2.INTER_AREA)
    ok, data = cv2.imencode(".jpg", image, [cv2.IMWRITE_JPEG_QUALITY, 80])
    _image_cache[key] = bytes(data)
    return _image_cache[key]


_size_cache: dict[str, list[int]] = {}


def image_size(name: str) -> list[int]:
    if name in _size_cache:  # caricare la foto intera solo per sapere quanto è grande costa: una volta sola
        return _size_cache[name]
    image = imageio.load(config.data_dir() / name)
    cache = config.work_dir() / "pagine" / (name.rsplit(".", 1)[0] + ".json")
    if cache.exists() and json.loads(cache.read_text(encoding="utf-8")).get("rotation", 0) % 2:
        _size_cache[name] = [image.shape[0], image.shape[1]]
    else:
        _size_cache[name] = [image.shape[1], image.shape[0]]
    return _size_cache[name]


def warm_images(names: list[str]) -> None:
    """Prepara in anticipo le foto di un caso (le due larghezze: telefono e computer), così il cambio di scheda è immediato."""

    def work() -> None:
        for name in names:
            for width in (1200, 1800):
                try:
                    jpeg(name, width)
                except Exception:  # una foto illeggibile si vedrà quando la si apre
                    pass

    threading.Thread(target=work, daemon=True).start()


class Handler(BaseHTTPRequestHandler):
    token: str | None = None  # con --lan: il codice che il browser deve avere (nel link la prima volta, poi in un cookie)

    def log_message(self, *args):  # silenzioso
        pass

    def _authorized(self) -> bool:
        if self.token is None:
            return True
        if parse_qs(urlparse(self.path).query).get("k", [""])[0] == self.token:
            self._set_cookie = True
            return True
        jar = SimpleCookie(self.headers.get("Cookie", ""))
        return "mk" in jar and secrets.compare_digest(jar["mk"].value, self.token)

    def _send(self, body: bytes, content_type: str = "application/json", status: int = 200, cache: str = "no-store"):
        self.send_response(status)
        if getattr(self, "_set_cookie", False):
            self.send_header("Set-Cookie", f"mk={self.token}; Path=/; HttpOnly; SameSite=Strict")
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", cache)
        self.end_headers()
        self.wfile.write(body)

    def _json(self, data, status: int = 200):
        self._send(json.dumps(data, ensure_ascii=False).encode("utf-8"), "application/json; charset=utf-8", status)

    def _body(self) -> dict:
        length = int(self.headers.get("Content-Length") or 0)
        return json.loads(self.rfile.read(length).decode("utf-8")) if length else {}

    def do_GET(self):
        if not self._authorized():
            return self._send("Serve il link completo, con il codice (lo stampa il programma all'avvio).".encode("utf-8"), "text/plain; charset=utf-8", 403)
        url = urlparse(self.path)
        query = parse_qs(url.query)
        try:
            if url.path == "/":
                return self._send(HTML.read_bytes(), "text/html; charset=utf-8")
            if url.path == "/api/meta":
                try:
                    wording, grammar_error = default_wording(), ""
                except ValueError as error:  # grammatica.json scritto male: si dice, ma la pagina si apre lo stesso
                    wording, grammar_error = "automatico", str(error)
                return self._json(
                    {
                        "objectTypes": draft.object_types(),
                        "edgeTypes": draft.edge_types(),
                        "unsupported": {code: text for code, (text, _) in UNSUPPORTED.items()},
                        "defaultWording": wording,
                        "grammarError": grammar_error,
                        "cases": [{"number": c["number"], "title": c["title"], "status": status_of(c["number"])} for c in manifest()["cases"]],
                    }
                )
            if url.path.startswith("/api/case/"):
                number = int(url.path.rsplit("/", 1)[1])
                entry = entry_for(number)
                if entry is None:
                    return self._json({"error": f"caso {number} non nel manifest"}, 404)
                with _lock:
                    current = draft.load_draft(number)
                    if current is None:
                        current = draft.auto_draft(entry)
                        draft.save_draft(current)
                photos = [{**p, "size": image_size(p["file"])} for p in photo_list(entry)]
                warm_images([p["file"] for p in photos])
                return self._json({"draft": current, "photos": photos, "status": status_of(number)})
            if url.path == "/img":
                name = Path(query["file"][0]).name
                if not any(name in p for e in manifest()["cases"] for p in (e["personaggi"], e["mappa"], e["passaggi"])):
                    return self._json({"error": "foto sconosciuta"}, 404)
                # le foto non cambiano mentre si corregge: il browser le tiene (solo per chi ha il codice), così cambiare scheda non le riscarica
                return self._send(jpeg(name, int(query.get("w", ["1800"])[0])), "image/jpeg", cache="private, max-age=3600")
            self._json({"error": "non trovato"}, 404)
        except Exception as error:  # al browser arriva il motivo, non una pagina vuota
            self._json({"error": f"{type(error).__name__}: {error}"}, 500)

    def do_POST(self):
        if not self._authorized():
            return self._json({"error": "non autorizzato: riapri il link col codice"}, 403)
        url = urlparse(self.path)
        try:
            body = self._body()
            with _lock:
                if url.path == "/api/save":
                    draft.save_draft(body)
                    return self._json({"ok": True})
                if url.path == "/api/parse":  # veloce, senza solver: l'analisi delle schede e i problemi
                    _, _, problems, analysis = draft.assemble(body)
                    return self._json({"problems": problems, "cards": analysis})
                if url.path == "/api/check":
                    draft.save_draft(body)
                    return self._json(draft.check(body))
                if url.path == "/api/accept":
                    draft.save_draft(body)
                    return self._json(draft.accept(body))
                if url.path == "/api/readsolution":  # solo assassino e posizioni, senza toccare schede e mappa già corrette
                    entry = entry_for(int(body["number"]))
                    issues = draft.read_solution(body, entry)
                    draft.save_draft(body)
                    return self._json({"draft": body, "issues": issues})
                if url.path == "/api/refine":  # il solver sceglie fra caselle vicine per le pedine dubbie
                    outcome = draft.refine_with_solver(body)
                    draft.save_draft(body)
                    return self._json({"draft": body, **outcome})
                if url.path == "/api/reread":
                    entry = entry_for(int(body["number"]))
                    fresh = draft.auto_draft(entry)
                    draft.save_draft(fresh)
                    return self._json({"draft": fresh})
            self._json({"error": "non trovato"}, 404)
        except Exception as error:
            self._json({"error": f"{type(error).__name__}: {error}"}, 500)


def lan_address() -> str:
    """L'indirizzo di questo computer sulla rete locale (nessun pacchetto parte: serve solo a scegliere l'interfaccia)."""
    probe = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        probe.connect(("10.255.255.255", 1))
        return probe.getsockname()[0]
    except OSError:
        return "127.0.0.1"
    finally:
        probe.close()


def main() -> None:
    argv = config.take_data_option(sys.argv[1:])
    lan = "--lan" in argv
    tunnel = "--tunnel" in argv  # solo sul computer, ma col codice: per un tunnel (ssh -R, cloudflared) che lo porta fuori
    argv = [a for a in argv if a not in ("--lan", "--tunnel")]
    port = int(argv[0]) if argv else 8765
    if lan or tunnel:
        Handler.token = os.environ.get("MURDOKU_TOKEN") or secrets.token_urlsafe(9)  # MURDOKU_TOKEN: riavviare senza cambiare link
    server = ThreadingHTTPServer(("0.0.0.0" if lan else "127.0.0.1", port), Handler)
    if tunnel:
        print(f"Pagina di correzione col codice (per il tunnel): http://127.0.0.1:{port}/?k={Handler.token}  (Ctrl+C per fermare)")
    elif lan:
        print(f"Pagina di correzione per il telefono (stessa rete Wi-Fi): http://{lan_address()}:{port}/?k={Handler.token}")
        print("Il codice cambia a ogni avvio; chi non ha il link non entra. Se non si apre, controlla il firewall di Windows (consenti Python sulla rete privata).")
        print(f"Dal computer: http://127.0.0.1:{port}/?k={Handler.token}  (Ctrl+C per fermare)\nDati: {config.data_dir()}")
    else:
        print(f"Pagina di correzione: http://127.0.0.1:{port}  (Ctrl+C per fermare)\nDati: {config.data_dir()}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
