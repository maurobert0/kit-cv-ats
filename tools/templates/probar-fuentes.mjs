// Prueba de extracción de texto por fuente.
// Imprime un texto de muestra con cada fuente @fontsource usada en los templates (o las que
// se pasen como argumento, con el formato paquete:peso), genera el PDF con Chromium y
// compara el texto extraído con pdfjs-dist contra el original.
// Sirve para descartar fuentes cuyos glifos no se mapean bien a Unicode antes de usarlas.
// Uso: node probar-fuentes.mjs [gloock:400 inter:700 ...]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const dirTemplates = path.resolve(aqui, '../../skills/generador-cv-ats/templates');
const VERSION = '5.3.0';

let muestras = process.argv.slice(2).map((a) => a.split(':'));
if (!muestras.length) {
  const vistas = new Set();
  for (const f of fs.readdirSync(dirTemplates).filter((x) => x.endsWith('.html'))) {
    const html = fs.readFileSync(path.join(dirTemplates, f), 'utf8');
    for (const m of html.matchAll(/@fontsource\/([a-z0-9-]+)@[\d.]+\/(\d{3})\.css/g)) vistas.add(`${m[1]}:${m[2]}`);
  }
  muestras = [...vistas].sort().map((v) => v.split(':'));
}

const texto =
  'Lucía Fernández | Perfil Profesional | Experiencia Profesional | Educación | Certificaciones y Formación | ' +
  'Proyectos | Idiomas | Diseñadora UI Junior | office fi fl ffi | Mar 2022 - Presente | +598 99 000 000 | ' +
  'linkedin.com/in/luciafernandez | WCAG 2.1 | 400.000 | 0123456789';
const esperado = `${texto} ${texto.toLocaleUpperCase('es')}`.replace(/\s+/g, ' ');

const navegador = await chromium.launch();
let fallas = 0;
for (const [paquete, peso] of muestras) {
  const familia = paquete.split('-').map((p) => p[0].toUpperCase() + p.slice(1)).join(' ');
  const pagina = await navegador.newPage();
  await pagina.setContent(
    `<!DOCTYPE html><html><head><meta charset="UTF-8">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@fontsource/${paquete}@${VERSION}/${peso}.css"></head>
    <body style="font-weight:${peso};font-size:12pt;font-variant-ligatures:none;font-feature-settings:'liga' 0,'clig' 0,'dlig' 0">
    <p class="f">${texto}</p><p class="f" style="text-transform:uppercase">${texto}</p></body></html>`,
    { waitUntil: 'networkidle' },
  );
  const familiaReal = await pagina.evaluate(() => [...document.fonts].map((f) => f.family.replace(/"/g, ''))[0] || '');
  await pagina.addStyleTag({ content: `.f { font-family: "${familiaReal || familia}", monospace; }` });
  await pagina.evaluate(() => document.fonts.ready);
  const buffer = await pagina.pdf({ format: 'A4' });
  await pagina.close();

  const doc = await pdfjs.getDocument({ data: new Uint8Array(buffer), verbosity: 0 }).promise;
  const contenido = await (await doc.getPage(1)).getTextContent();
  const extraido = contenido.items.map((i) => i.str + (i.hasEOL ? ' ' : '')).join('').replace(/\s+/g, ' ').trim();
  const ok = extraido === esperado;
  if (!ok) fallas++;
  console.log(`${ok ? 'OK   ' : 'MAL  '} ${paquete} ${peso}${ok ? '' : `\n       ${extraido.slice(0, 160)}`}`);
}
await navegador.close();
process.exit(fallas ? 1 : 0);
