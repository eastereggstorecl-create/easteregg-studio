// Copia el editor (EDITOR/PRO/LEGACY, íconos, modelos de IA) dentro de desktop/editor para el instalador.
// Uso: node copy-editor.mjs   (lo hace solo «npm run dist»)
import {cpSync,rmSync,mkdirSync,existsSync,copyFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
const here=dirname(fileURLToPath(import.meta.url)),root=join(here,'..'),out=join(here,'editor');
rmSync(out,{recursive:true,force:true});mkdirSync(out,{recursive:true});
for(const f of ['EDITOR.html','PRO.html','LEGACY.html','index.html','manifest.json','sw.js'])copyFileSync(join(root,f),join(out,f));
cpSync(join(root,'icons'),join(out,'icons'),{recursive:true});
const models=join(root,'models','sam2');
if(existsSync(models))cpSync(models,join(out,'models','sam2'),{recursive:true,filter:s=>!/\.bat$/i.test(s)});
mkdirSync(join(here,'build'),{recursive:true});
copyFileSync(join(root,'icons','icon-512.png'),join(here,'build','icon.png'));
console.log('Editor copiado en',out);
