@echo off
title EasterEgg Studio para el celular (no cierres esta ventana)
cd /d "%~dp0"
for /f %%i in ('python -c "import socket;s=socket.socket(2,2);s.connect(('10.255.255.255',1));print(s.getsockname()[0])"') do set IP=%%i
echo.
echo   ================================================================
echo    EasterEgg Studio en tu celular (misma red Wi-Fi que este PC)
echo   ================================================================
echo.
echo    1. En el celular abre Chrome y entra a:
echo.
echo          http://%IP%:8766/EDITOR.html
echo.
echo    2. SOLO LA PRIMERA VEZ (para que Chrome deje usar el microfono
echo       y exportar): en Chrome del celular entra a
echo          chrome://flags/#unsafely-treat-insecure-origin-as-secure
echo       activalo (Enabled), escribe en la caja:  http://%IP%:8766
echo       y pulsa "Relaunch".
echo.
echo    Si Windows pregunta por el Firewall, pulsa "Permitir" (red privada).
echo    No cierres esta ventana mientras uses el editor en el celular.
echo.
python -m http.server 8766 --bind 0.0.0.0
