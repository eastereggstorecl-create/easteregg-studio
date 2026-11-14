# EasterEgg Studio

Editor de video en el navegador: PRO, SHORTS (vertical) y LEGACY. Funciona en PC y en el celular (se instala como app).

Abrir: `EDITOR.html`.

- Todo se procesa en tu dispositivo: los videos no se suben a ningún servidor.
- `PRO.html` se genera con `node src/build.mjs` a partir de `LEGACY.html` y `src/`.
- Máscara automática con IA: SAM 2.1 (Meta, Apache‑2.0) con el motor web de
  [sam2-from-scratch](https://github.com/smurley6/sam2-from-scratch) (Apache‑2.0). Los modelos se instalan con `models/sam2/INSTALAR IA.bat`.
