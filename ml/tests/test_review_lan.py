"""Con --lan la pagina di correzione si apre alla rete locale, ma solo con il link che porta il codice."""

import threading
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer

import pytest

from reader import review


@pytest.fixture
def server():
    review.Handler.token = "segreto123"
    httpd = ThreadingHTTPServer(("127.0.0.1", 0), review.Handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    yield f"http://127.0.0.1:{httpd.server_address[1]}"
    httpd.shutdown()
    review.Handler.token = None


def fetch(url, headers=None, data=None):
    request = urllib.request.Request(url, headers=headers or {}, data=data)
    try:
        with urllib.request.urlopen(request) as response:
            return response.status, response.headers
    except urllib.error.HTTPError as error:
        return error.code, error.headers


def test_senza_codice_non_si_entra(server):
    assert fetch(server + "/")[0] == 403
    assert fetch(server + "/?k=sbagliato")[0] == 403
    assert fetch(server + "/api/save", data=b"{}")[0] == 403  # nemmeno per scrivere


def test_col_codice_si_entra_e_resta_il_cookie(server):
    status, headers = fetch(server + "/?k=segreto123")
    assert status == 200 and "mk=segreto123" in headers["Set-Cookie"]
    assert fetch(server + "/qualcosa", headers={"Cookie": "mk=segreto123"})[0] == 404  # passa il controllo: la pagina non esiste
    assert fetch(server + "/qualcosa", headers={"Cookie": "mk=altro"})[0] == 403


def test_senza_lan_non_serve_nessun_codice():
    review.Handler.token = None
    httpd = ThreadingHTTPServer(("127.0.0.1", 0), review.Handler)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    try:
        assert fetch(f"http://127.0.0.1:{httpd.server_address[1]}/")[0] == 200
    finally:
        httpd.shutdown()
