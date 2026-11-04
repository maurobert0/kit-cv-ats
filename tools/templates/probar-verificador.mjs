// Prueba del verificador: genera versiones rotas a propósito de un template y confirma que
// verificar.mjs detecta cada problema. Incluye un control positivo (un CV con una sección
// borrada, que está permitido) que tiene que pasar.
// Uso: node probar-verificador.mjs

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const base = fs.readFileSync(path.join(aqui, '../../skills/generador-cv-ats/templates/suizo.html'), 'utf8');
const dir = path.join(os.tmpdir(), 'verificar-cv-negativo');
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir, { recursive: true });

const conCss = (css) => base.replace('</style>', `  ${css}\n</style>`);

const variantes = [
  {
    nombre: 'dos-columnas',
    html: conCss('.cv { display: flex; flex-wrap: wrap; gap: 0 6mm; } .cv > header { width: 100%; } .cv > section { width: calc(50% - 3mm); }'),
    espera: '[pdfjs por posición] Línea de',
  },
  {
    nombre: 'css-prohibido',
    html: conCss('.fechas { position: absolute; } .habilidades { column-count: 2; }'),
    espera: 'CSS prohibido: position distinto de static',
  },
  {
    nombre: 'letras-espaciadas',
    html: conCss('h2 { letter-spacing: 0.4em; }'),
    espera: 'Letras separadas por espacios',
  },
  {
    nombre: 'cifras-tabulares',
    html: conCss('.fechas { font-variant-numeric: tabular-nums; }'),
    espera: 'Caracteres de control o de reemplazo',
  },
  {
    nombre: 'sin-ligaduras-apagadas',
    html: base.replace(/font-variant-ligatures: none;\n\s*font-feature-settings: [^;]+;/, ''),
    espera: 'body sin font-variant-ligatures: none',
  },
  {
    nombre: 'guion-largo',
    html: base.replace('<span class="nota">| Billetera digital', '<span class="nota">\u2014 Billetera digital'),
    espera: 'guiones largos',
  },
  {
    nombre: 'tres-paginas',
    html: base.replace(/(<!-- INICIO:experiencia -->[\s\S]*?)(<\/section>\s*<!-- FIN:experiencia -->)/, (m, a, b) => {
      const puestos = a.slice(a.indexOf('<div class="puesto">'));
      return a + puestos + puestos + b;
    }),
    espera: 'páginas (máximo 2)',
  },
  {
    nombre: 'contrato-roto',
    html: base.replace('<!-- INICIO:idiomas -->', '').replace(/class="nota"/g, 'class="extra"'),
    espera: 'Marcadores distintos a clasico.html',
  },
  {
    nombre: 'contraste-bajo',
    html: base.replace('--gris: #6b6b6b;', '--gris: #a8a8a8;'),
    espera: 'Contraste',
  },
  {
    nombre: 'cv-sin-proyectos',
    html: base.replace(/<!-- INICIO:proyectos -->[\s\S]*?<!-- FIN:proyectos -->\s*/, ''),
    espera: null,
  },
  {
    nombre: 'encabezado-partido',
    html: conCss('.cargo { display: inline-block; max-width: 20mm; }'),
    espera: 'encabezado partido',
  },
  {
    nombre: 'fecha-a-la-derecha',
    html: conCss('.puesto-encabezado, .entrada-encabezado { display: flex; justify-content: space-between; align-items: baseline; } .fechas { font-size: 9pt; }'),
    espera: '[pdftotext] Las fechas',
  },
  {
    nombre: 'texto-al-borde',
    html: conCss('@page { margin: 16mm 0; }'),
    espera: 'Texto a menos de 12mm',
  },
  {
    nombre: 'adorno-con-texto',
    html: base.replace('<main class="cv">', '<main class="cv">\n<span class="adorno">Diseño</span>'),
    espera: 'fuera del contrato',
  },
  {
    nombre: 'nombre-apretado',
    html: conCss('.nombre { letter-spacing: -0.06em; }'),
    espera: 'mínimo -0.02em',
  },
];

for (const v of variantes) fs.writeFileSync(path.join(dir, `${v.nombre}.html`), v.html);

const r = spawnSync('node', ['verificar.mjs', ...variantes.map((v) => path.join(dir, `${v.nombre}.html`))], {
  cwd: aqui,
  encoding: 'utf8',
});
const salida = r.stdout;
const bloques = {};
let actual = null;
for (const linea of salida.split('\n')) {
  const m = linea.match(/^(PASA|FALLA)\s+(\S+)/);
  if (m) {
    actual = m[2];
    bloques[actual] = { estado: m[1], lineas: [] };
  } else if (actual) bloques[actual].lineas.push(linea);
}

let fallos = 0;
for (const v of variantes) {
  const b = bloques[v.nombre];
  if (v.espera === null) {
    const pasa = b && b.estado === 'PASA';
    if (!pasa) fallos++;
    console.log(`${pasa ? 'PASA        ' : 'FALSO ERROR '}  ${v.nombre}  (control positivo: tiene que pasar)`);
    if (!pasa && b) b.lineas.filter((l) => l.includes('ERROR')).forEach((l) => console.log(`    ${l.trim()}`));
    continue;
  }
  const detectado = b && b.estado === 'FALLA' && b.lineas.some((l) => l.includes(v.espera));
  if (!detectado) fallos++;
  console.log(`${detectado ? 'DETECTADO   ' : 'NO DETECTADO'}  ${v.nombre}  (se esperaba: ${v.espera})`);
}
console.log(fallos ? `\n${fallos} problemas no detectados.` : '\nEl verificador detectó todos los problemas.');
process.exit(fallos ? 1 : 0);
