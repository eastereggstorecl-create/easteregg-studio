@echo off
title EasterEgg Studio (no cierres esta ventana mientras editas)
cd /d "%~dp0"
echo.
echo   EasterEgg Studio esta abierto en tu navegador.
echo   No cierres esta ventana mientras editas. Cuando termines, cierrala.
echo.
start "" "http://localhost:8765/EDITOR.html"
python -m http.server 8765 --bind 127.0.0.1
