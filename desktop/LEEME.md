# EasterEgg Studio · app de Windows

Programa de escritorio (Electron + FFmpeg) con el mismo editor de la web, más:

- **Proxies 720p con la GPU** (NVIDIA NVENC → Intel QuickSync → AMD AMF → procesador).
- **Abre cualquier formato** (webm de OBS, mkv, mov ProRes, avi…). Si Chrome no puede verlo, la app hace sola una copia compatible.
- **Videos de 4 GB o más**: FFmpeg lee directo del disco; nada se carga entero en memoria.
- **Exportar con FFmpeg** (opción «🚀 FFmpeg con tu GPU»): el editor dibuja cada fotograma (filtros, texto, zoom, upscaler) y la GPU lo codifica **directo al archivo**. CutDrop guarda cada corte en la carpeta que elijas.

## Instalar en otra PC
Copia `dist\EasterEgg-Studio-Instalador-1.0.1.exe` y ábrelo. Windows mostrará
«Windows protegió su PC» (SmartScreen) porque el programa no tiene firma de pago:
pulsa **Más información → Ejecutar de todas formas**.

## Para programar (no hace falta para usarlo)
- `npm install` (una vez) · `npm start` abre la app con el editor de la carpeta de arriba.
- `npm run dist` copia el editor a `editor\` y arma el instalador en `dist\`.
- Proxies y audio temporales: `%APPDATA%\easteregg-studio\cache` (se pueden borrar).

## Tiempos medidos (GTX 1070, 14-11-2026)
| Prueba | Resultado |
|---|---|
| Proxy 720p de un 4K60 H.264 de 11 min (4,7 GB) | 194 s (antes del ajuste CUDA: 409 s) |
| Proxy de un ProRes 1080p de 8 s | 1,5 s |
| Exportar 10 s a 4K60 con FFmpeg/NVENC | 121 s (4,9 fps) · PSNR 49,8 dB vs original |
| Exportar 10 s a 1080p60 desde 4K con FFmpeg/NVENC | 40 s (15 fps) · PSNR 41 dB |
| Exportar 10 s a 4K60 con WebCodecs (archivo de 1,5 GB) | 184 s (3,3 fps) |

Prueba automática: `test/harness.js` (variables EE_TEST, EE_FILES, EE_OUT, EE_SECS, EE_FROM, EE_RES, EE_ENGINE).
