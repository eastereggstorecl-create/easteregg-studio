@echo off
title Instalar la IA de mascaras (SAM 2.1) - una sola vez
cd /d "%~dp0"
echo.
echo   Esto prepara la IA que recorta y sigue objetos en el video (SAM 2.1 de Meta).
echo   Descarga unos 150 MB del modelo oficial de Meta y el codigo libre
echo   github.com/smurley6/sam2-from-scratch (licencia Apache-2.0),
echo   y deja los archivos listos en esta carpeta. Tarda unos minutos.
echo.
pause
set WORK=%TEMP%\ee-sam2-build
if not exist "%WORK%" git clone --depth 1 https://github.com/smurley6/sam2-from-scratch.git "%WORK%"
cd /d "%WORK%"
if not exist .venv python -m venv --system-site-packages .venv
.venv\Scripts\python -m pip install -q onnx onnxruntime onnxslim onnxconverter-common onnxscript numpy pillow
.venv\Scripts\python -m pip install -q --no-deps -e .
if not exist checkpoints\sam2.1_hiera_tiny.pt curl -L -o checkpoints\sam2.1_hiera_tiny.pt https://dl.fbaipublicfiles.com/segment_anything_2/092824/sam2.1_hiera_tiny.pt
.venv\Scripts\python tools\export_onnx.py --model tiny --sizes 512 --out "%~dp0."
echo.
echo   Listo. Recarga el editor (F5) y usa la pestana Mascara ^> Mascara automatica con IA.
echo.
pause
