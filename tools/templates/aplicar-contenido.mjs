// Copia el contenido de ejemplo entre los marcadores de cada template nuevo.
// Uso: node aplicar-contenido.mjs [nombre ...]
// Sin argumentos, aplica el contenido a todos los templates salvo clasico.html.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { reemplazarBloques } from './bloques.mjs';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const dirTemplates = path.resolve(aqui, '../../skills/generador-cv-ats/templates');
const contenido = fs.readFileSync(path.join(aqui, 'contenido-ejemplo.html'), 'utf8');

const nombres = process.argv.slice(2).length
  ? process.argv.slice(2)
  : fs
      .readdirSync(dirTemplates)
      .filter((f) => f.endsWith('.html') && f !== 'clasico.html')
      .map((f) => f.replace(/\.html$/, ''));

for (const nombre of nombres) {
  const archivo = path.join(dirTemplates, `${nombre}.html`);
  const html = fs.readFileSync(archivo, 'utf8');
  fs.writeFileSync(archivo, reemplazarBloques(html, contenido));
  console.log(`Contenido aplicado: ${nombre}.html`);
}
