@echo off
cd /d "%~dp0"

where python >nul 2>nul
if %errorlevel%==0 (
    set PYCMD=python
) else (
    where py >nul 2>nul
    if %errorlevel%==0 (
        set PYCMD=py
    ) else (
        echo Python non trovato. Installa Python da https://www.python.org/downloads/ e riprova.
        pause
        exit /b 1
    )
)

start "Murdoku Server" /min cmd /c "%PYCMD% -m http.server 8123"

timeout /t 1 /nobreak >nul

start "" "http://localhost:8123/index.html"

echo Murdoku e' avviato. Non chiudere la finestra "Murdoku Server" finche' lo usi.
echo Puoi chiudere questa finestra.
pause
