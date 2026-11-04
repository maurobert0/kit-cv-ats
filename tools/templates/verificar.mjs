// Verificación de templates de CV para ATS.
//
// Para cada template de skills/generador-cv-ats/templates:
//   1. Revisa el HTML y el CSS sin renderizar (propiedades prohibidas, contrato contra clasico.html).
//   2. Genera PDF en A4 y en Carta con el motor de impresión de Chromium (medio print).
//   3. Extrae el texto con pdfjs-dist y revisa orden, caracteres, contacto, fechas y páginas.
//   4. Repite la generación sin red, para probar las fuentes alternativas del sistema.
//   5. Prueba de intercambio: pega el contenido de clasico.html entre los marcadores del
//      template y repite las pruebas.
// Guarda en preview/ (en la raíz del repo, ignorada por git) el PDF, un PNG por página y el texto extraído de cada formato.
//
// Uso: node verificar.mjs [nombre | ruta/archivo.html ...]
// Sin argumentos revisa todos los templates. Sale con código 1 si alguno tiene errores.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { renderizarPng } from './png.mjs';
import { MARCADORES, listarMarcadores, extraerBloques, reemplazarBloques } from './bloques.mjs';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const raiz = path.resolve(aqui, '../..');
const dirTemplates = path.join(raiz, 'skills/generador-cv-ats/templates');
const dirPreview = path.join(raiz, 'preview');
const dirIntercambio = path.join(dirPreview, 'intercambio');

const TITULOS = [
  'Perfil Profesional',
  'Habilidades',
  'Experiencia Profesional',
  'Educación',
  'Certificaciones y Formación',
  'Proyectos',
  'Idiomas',
];
const FORMATOS = [
  { id: 'a4', formato: 'A4' },
  { id: 'carta', formato: 'Letter' },
];
const MAX_PAGINAS = 2;
const ESCALA_PNG = 1.6;

// ---------------------------------------------------------------------------
// Utilidades de texto

const normalizar = (s) => s.normalize('NFC').replace(/\s+/g, ' ').trim();
const minus = (s) => normalizar(s).toLocaleLowerCase('es');

function luminancia([r, g, b]) {
  const c = [r, g, b].map((v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function contraste(a, b) {
  const [x, y] = [luminancia(a), luminancia(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

// ---------------------------------------------------------------------------
// Revisión estática del archivo

function extraerCss(html) {
  const estilos = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]);
  return { cantidad: estilos.length, css: estilos.join('\n').replace(/\/\*[\s\S]*?\*\//g, '') };
}

function reglasCss(css) {
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => ({
    selector: normalizar(m[1]),
    cuerpo: m[2],
  }));
}

function aPt(valor) {
  const m = String(valor).trim().match(/^(-?[\d.]+)(pt|px)$/);
  if (!m) return null;
  return m[2] === 'pt' ? parseFloat(m[1]) : parseFloat(m[1]) * 0.75;
}

function revisarCss(html) {
  const errores = [];
  const { cantidad, css } = extraerCss(html);
  if (cantidad !== 1) errores.push(`Debe haber un único <style> y hay ${cantidad}`);

  const prohibidos = [
    [/position\s*:\s*(absolute|fixed|relative|sticky)/, 'position distinto de static'],
    [/(^|[;{\s])float\s*:\s*(left|right|inline-start|inline-end)/, 'float'],
    [/(^|[;{\s])order\s*:/, 'order'],
    [/column-count\s*:/, 'column-count'],
    [/(^|[;{\s])columns\s*:/, 'columns'],
    [/column-width\s*:/, 'column-width'],
    [/grid-template-areas\s*:/, 'grid-template-areas'],
    [/grid-template-columns\s*:/, 'grid-template-columns'],
    [/grid-(row|column|area)\s*:/, 'grid-row, grid-column o grid-area'],
    [/display\s*:\s*(inline-)?table/, 'display: table'],
    [/display\s*:\s*table-(cell|row)/, 'display: table-cell o table-row'],
    [/flex-direction\s*:\s*(row-reverse|column-reverse)/, 'flex-direction invertido'],
    [/word-spacing\s*:/, 'word-spacing'],
    [/content\s*:\s*(["'])(?!\1)/, 'content: con texto'],
    [/content\s*:\s*(attr|counter)/, 'content: generado'],
    [/@import/, '@import'],
    [/url\s*\(/, 'url() (imágenes o recursos dentro del CSS)'],
  ];
  for (const [patron, nombre] of prohibidos) {
    if (patron.test(css)) errores.push(`CSS prohibido: ${nombre}`);
  }

  for (const { selector, cuerpo } of reglasCss(css)) {
    const ls = cuerpo.match(/letter-spacing\s*:\s*([^;]+)/);
    if (ls) {
      const v = ls[1].trim();
      let em = null;
      if (/em$/.test(v)) em = parseFloat(v);
      else if (v === 'normal' || v === '0') em = 0;
      else {
        const fs_ = cuerpo.match(/font-size\s*:\s*([^;]+)/);
        const base = (fs_ && aPt(fs_[1])) || 10.5;
        const pt = aPt(v);
        em = pt === null ? Infinity : pt / base;
      }
      if (em > 0.03 + 1e-9) {
        errores.push(`letter-spacing ${v} en "${selector}" equivale a ${em.toFixed(3)}em (máximo 0.03em)`);
      }
      if (em < 0) {
        const fs_ = cuerpo.match(/font-size\s*:\s*([^;]+)/);
        const grande = /(^|[\s,>])(h1|\.nombre)\b/.test(selector) || (fs_ && aPt(fs_[1]) >= 16);
        if (!grande) errores.push(`letter-spacing negativo en "${selector}": solo se permite en el nombre y en textos de 16pt o más`);
        else if (em < -0.02 - 1e-9) errores.push(`letter-spacing ${v} en "${selector}" (mínimo -0.02em)`);
      }
    }
    if (/text-transform\s*:\s*uppercase/.test(cuerpo) && !/(^|[\s,>])h2\b/.test(selector)) {
      errores.push(`text-transform: uppercase fuera de los títulos de sección ("${selector}")`);
    }
    // Márgenes de página: arriba y abajo entre 12 y 20mm. Los laterales pueden ser 0 cuando el
    // margen del texto lo da el padding de .cv (encabezado de borde a borde); la distancia real
    // del texto al borde se mide después en el PDF. @page :first solo puede anular el margen
    // superior para que el encabezado llegue al borde de la hoja.
    if (/^@page(\s*:first)?$/.test(selector)) {
      const primera = selector !== '@page';
      if (/(^|[;\s])size\s*:/.test(cuerpo)) errores.push('@page no puede fijar size');
      const margen = cuerpo.match(/(^|[;\s])margin\s*:\s*([^;]+)/);
      const propiedades = [...cuerpo.matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1]);
      if (primera && propiedades.some((p) => !/^margin(-top)?$/.test(p))) {
        errores.push('@page :first solo puede cambiar el margen superior');
      }
      const mm = (v) => (v === '0' ? 0 : (v.match(/^([\d.]+)mm$/) || [])[1]);
      const enRango = (v, cero) => {
        const n = mm(v);
        return n !== undefined && ((cero && +n === 0) || (+n >= 12 && +n <= 20));
      };
      if (primera) {
        const arriba = (cuerpo.match(/margin-top\s*:\s*([^;]+)/) || [])[1];
        if (arriba && !enRango(arriba.trim(), true)) errores.push(`Margen superior de @page :first fuera de rango: ${arriba}`);
      } else if (!margen) errores.push('@page sin margen');
      else {
        const v = margen[2].trim().split(/\s+/);
        const [arriba, lado = arriba, abajo = arriba, izq = lado] = v;
        if (!enRango(arriba, false) || !enRango(abajo, false)) errores.push(`Márgenes superior e inferior de @page fuera de 12 a 20mm: ${margen[2]}`);
        if (!enRango(lado, true) || !enRango(izq, true)) errores.push(`Márgenes laterales de @page fuera de 12 a 20mm (o 0): ${margen[2]}`);
      }
    } else if (/^@page/.test(selector) || /@(top|bottom|left|right)-/.test(selector)) {
      errores.push(`@page con cajas de margen o páginas especiales: ${selector}`);
    }
  }

  const body = reglasCss(css).find((r) => r.selector === 'body');
  if (!body || !/font-variant-ligatures\s*:\s*none/.test(body.cuerpo)) {
    errores.push('body sin font-variant-ligatures: none');
  }
  if (!body || !/font-feature-settings\s*:[^;]*"liga"\s*0[^;]*"clig"\s*0[^;]*"dlig"\s*0/.test(body.cuerpo)) {
    errores.push('body sin font-feature-settings "liga" 0, "clig" 0, "dlig" 0');
  }
  if (!body || !/print-color-adjust\s*:\s*exact/.test(body.cuerpo)) {
    errores.push('body sin print-color-adjust: exact');
  }
  return errores;
}

function clasesDe(html) {
  const clases = new Set();
  for (const m of html.matchAll(/class="([^"]+)"/g)) m[1].split(/\s+/).forEach((c) => clases.add(c));
  return clases;
}

// Clases del contrato: las del marcado de clasico.html más la lista "CLASES DISPONIBLES" de su comentario.
function clasesContrato(clasico) {
  const lista = (clasico.match(/CLASES DISPONIBLES([\s\S]*?)-->/) || [])[1] || '';
  return new Set([...clasesDe(clasico), ...[...lista.matchAll(/\.([a-z-]+)/g)].map((m) => m[1])]);
}

function revisarHtml(html, nombre) {
  const errores = [];
  const avisos = [];
  if (html.includes('\u2014')) errores.push('El archivo contiene guiones largos');
  if (!/<meta charset="UTF-8">/i.test(html)) errores.push('Falta <meta charset="UTF-8">');
  if (/<script/i.test(html)) errores.push('El template contiene JavaScript');
  for (const t of ['table', 'img', 'svg', 'canvas', 'iframe', 'object', 'picture']) {
    if (new RegExp(`<${t}[\\s>]`, 'i').test(html)) errores.push(`Etiqueta prohibida: <${t}>`);
  }
  const entidades = html.match(/&(?!amp;|lt;|gt;|quot;|#39;)[a-zA-Z]+;/g);
  if (entidades) errores.push(`Entidades HTML en lugar de caracteres directos: ${[...new Set(entidades)].join(' ')}`);
  for (const m of html.matchAll(/<link[^>]*>/g)) {
    const href = (m[0].match(/href="([^"]+)"/) || [])[1] || '';
    if (/rel="preconnect"/.test(m[0])) continue;
    const okGoogle = href.startsWith('https://fonts.googleapis.com/');
    const okJsdelivr = /^https:\/\/cdn\.jsdelivr\.net\/npm\/@fontsource\/[a-z0-9-]+@\d+\.\d+\.\d+\/\d{3}\.css$/.test(href);
    if (!okGoogle && !okJsdelivr) errores.push(`Dependencia externa no permitida: ${href}`);
  }
  if (!html.includes(`TEMPLATE: ${nombre}`) || !html.includes('INSTRUCCIONES PARA EL AGENTE')) {
    errores.push('Falta el comentario de instrucciones para el agente con el nombre del template');
  }
  return { errores, avisos };
}

// En modo estricto (templates) los marcadores tienen que ser exactamente los de clasico.html.
// En modo no estricto (un CV ya completado) se aceptan secciones borradas con sus dos marcadores.
function revisarContrato(html, clasico, estricto = true) {
  const errores = [];
  const esperados = listarMarcadores(clasico);
  const encontrados = listarMarcadores(html);
  const iguales = esperados.join(' ') === encontrados.join(' ');
  const pares = MARCADORES.flatMap((m) => [`INICIO:${m}`, `FIN:${m}`]);
  const subsecuencia =
    encontrados.length % 2 === 0 &&
    encontrados.every((m, i) => (i % 2 === 0 ? m.startsWith('INICIO:') && encontrados[i + 1] === m.replace('INICIO', 'FIN') : true)) &&
    encontrados.every((m, i) => i === 0 || pares.indexOf(m) > pares.indexOf(encontrados[i - 1]));
  if (!iguales && (estricto || !subsecuencia)) {
    errores.push(`Marcadores distintos a clasico.html. Esperado: ${esperados.join(' ')}. Encontrado: ${encontrados.join(' ')}`);
  }

  const clasesClasico = clasesDe(clasico);
  const clasesTemplate = clasesDe(html);
  for (const c of clasesClasico) {
    if (estricto && !clasesTemplate.has(c)) errores.push(`Falta la clase del contrato .${c}`);
  }
  const permitidas = clasesContrato(clasico);
  const { css: cssTemplate } = extraerCss(html);
  for (const c of permitidas) {
    if (estricto && !clasesTemplate.has(c) && !new RegExp(`\\.${c}(?![a-z-])`).test(cssTemplate)) {
      errores.push(`La clase .${c} del contrato no tiene estilo en el template`);
    }
  }
  const contenido = Object.values(extraerBloques(html)).join('\n');
  for (const c of clasesDe(contenido)) {
    if (!permitidas.has(c)) errores.push(`Clase de contenido que no está en el contrato de clasico.html: .${c}`);
  }

  const { css } = extraerCss(html);
  const cssConComentarios = (html.match(/<style[^>]*>([\s\S]*?)<\/style>/) || [])[1] || '';
  const root = (cssConComentarios.match(/:root\s*\{([\s\S]*?)\}/) || [])[1] || '';
  if (!/PERSONALIZABLE/.test(root)) errores.push(':root sin variables marcadas como PERSONALIZABLE');
  if (!/FIJO/.test(root)) errores.push(':root sin la sección FIJO');
  const requeridas = ['--acento', '--tamano-base', '--interlineado'];
  for (const v of requeridas) {
    if (!new RegExp(`${v}\\s*:`).test(root)) errores.push(`:root sin la variable ${v}`);
  }
  if (!/--fuente\s*:/.test(root) && !(/--fuente-texto\s*:/.test(root) && /--fuente-titulos\s*:/.test(root))) {
    if (!/--fuente-texto\s*:/.test(root)) errores.push(':root sin --fuente ni --fuente-texto');
  }
  const fueraDeRoot = css.replace(/:root\s*\{[\s\S]*?\}/, '');
  if (/(^|[;{\s])--[a-z0-9-]+\s*:/.test(fueraDeRoot)) errores.push('Variables CSS definidas fuera de :root');

  if (!/<h1 class="nombre">/.test(html)) errores.push('El nombre no está en <h1 class="nombre">');
  const h2 = (html.match(/<h2>/g) || []).length;
  const secciones = (html.match(/<section class="seccion/g) || []).length;
  if (h2 !== secciones) errores.push(`Cada sección necesita un <h2>: ${secciones} secciones y ${h2} títulos`);
  return errores;
}

// ---------------------------------------------------------------------------
// Revisión del DOM renderizado (medio print)

// El rango del nombre de clasico.html es el original (18 a 26pt); el de 28 a 44pt es para los
// templates nuevos.
async function revisarDom(pagina, clasesPermitidas, rangoNombre) {
  return pagina.evaluate(([clasesPermitidas, rangoNombre]) => {
    const errores = [];
    const avisos = [];
    const pt = (el) => parseFloat(getComputedStyle(el).fontSize) * 0.75;
    const rgb = (s) => (s.match(/[\d.]+/g) || []).map(Number);
    const mezclar = ([r, g, b, a], fondo) => [r, g, b].map((v, i) => v * a + fondo[i] * (1 - a));
    // Compone los fondos de los ancestros (con su transparencia) sobre papel blanco y devuelve
    // el color real detrás del elemento y la opacidad acumulada.
    const fondo = (el) => {
      const capas = [];
      let opacidad = 1;
      for (let e = el; e; e = e.parentElement) {
        const cs = getComputedStyle(e);
        opacidad *= parseFloat(cs.opacity);
        const c = rgb(cs.backgroundColor);
        const a = c.length === 4 ? c[3] : 1;
        if (c.length >= 3 && a > 0) capas.push([...c.slice(0, 3), a]);
        if (c.length >= 3 && a >= 1) break;
      }
      let color = [255, 255, 255];
      for (const capa of capas.reverse()) color = mezclar(capa, color);
      return { color, opacidad };
    };

    const textos = [];
    const caminar = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    while (caminar.nextNode()) {
      const n = caminar.currentNode;
      if (n.textContent.trim()) textos.push(n.parentElement);
    }
    const unicos = [...new Set(textos)];
    const pares = [];
    for (const el of unicos) {
      const cs = getComputedStyle(el);
      const muestra = el.textContent.trim().slice(0, 40);
      const { color: b, opacidad } = fondo(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || opacidad < 0.05) errores.push(`Texto oculto: "${muestra}"`);
      if (pt(el) < 9 - 0.01) errores.push(`Texto por debajo de 9pt (${pt(el).toFixed(2)}pt): "${muestra}"`);
      const c = rgb(cs.color);
      const texto = mezclar([c[0], c[1], c[2], (c.length === 4 ? c[3] : 1) * opacidad], b);
      pares.push({ texto: muestra, clase: el.className || el.tagName.toLowerCase(), colores: [texto, b] });

      const ls = parseFloat(cs.letterSpacing);
      if (!Number.isNaN(ls) && ls !== 0) {
        const em = ls / parseFloat(cs.fontSize);
        const grande = el.tagName === 'H1' || pt(el) >= 16 - 0.01;
        if (em > 0.03 + 1e-3) errores.push(`Espaciado entre letras de ${em.toFixed(3)}em en "${muestra}" (máximo 0.03em)`);
        if (em < 0 && !grande) errores.push(`Espaciado negativo en "${muestra}": solo en el nombre y en textos de 16pt o más`);
        if (em < -0.02 - 1e-3) errores.push(`Espaciado entre letras de ${em.toFixed(3)}em en "${muestra}" (mínimo -0.02em)`);
      }
    }

    // Elementos con clases fuera del contrato: solo pueden ser decorativos y vacíos.
    for (const el of document.querySelectorAll('[class]')) {
      const ajenas = [...el.classList].filter((c) => !clasesPermitidas.includes(c));
      if (ajenas.length && el.textContent.trim()) {
        errores.push(`Elemento con clase fuera del contrato (.${ajenas.join(', .')}) que contiene texto`);
      }
    }

    const h1 = document.querySelector('h1.nombre');
    const fuera = (v, min, max) => v < min - 0.01 || v > max + 0.01;
    const [nMin, nMax] = rangoNombre;
    if (h1 && fuera(pt(h1), nMin, nMax)) errores.push(`Nombre de ${pt(h1).toFixed(1)}pt (rango ${nMin} a ${nMax}pt)`);
    const titular = document.querySelector('.titular');
    if (titular && fuera(pt(titular), 11, 16)) errores.push(`Titular de ${pt(titular).toFixed(1)}pt (rango 11 a 16pt)`);
    for (const h2 of document.querySelectorAll('h2')) {
      if (fuera(pt(h2), 11, 18)) errores.push(`Título "${h2.textContent}" de ${pt(h2).toFixed(1)}pt (rango 11 a 18pt)`);
    }
    for (const el of document.querySelectorAll('.resumen p, .puesto li')) {
      const t = pt(el);
      if (t < 10 - 0.01 || t > 11 + 0.01) errores.push(`Cuerpo de ${t.toFixed(2)}pt (rango 10 a 11pt)`);
      const lh = parseFloat(getComputedStyle(el).lineHeight) * 0.75 / t;
      if (lh < 1.25 - 0.005 || lh > 1.5 + 0.005) errores.push(`Interlineado ${lh.toFixed(2)} (rango 1,25 a 1,5)`);
    }
    const sinSalto = (selector, prop) => {
      const el = document.querySelector(selector);
      if (el && getComputedStyle(el)[prop] !== 'avoid') errores.push(`Falta ${prop === 'breakInside' ? 'break-inside' : 'break-after'}: avoid en ${selector}`);
    };
    ['.puesto', '.entrada', 'li'].forEach((s) => sinSalto(s, 'breakInside'));
    ['h2', '.puesto-encabezado', '.entrada-encabezado'].forEach((s) => sinSalto(s, 'breakAfter'));
    const ligaduras = getComputedStyle(document.body).fontVariantLigatures;
    if (ligaduras !== 'none') errores.push(`font-variant-ligatures del body es ${ligaduras}`);
    for (const ul of document.querySelectorAll('ul')) {
      const tipo = getComputedStyle(ul).listStyleType;
      if (!['disc', 'circle', 'square', 'none'].includes(tipo)) errores.push(`Marcador de lista no permitido: ${tipo}`);
    }
    for (const a of document.querySelectorAll('a')) {
      const visible = a.textContent.trim();
      const destino = a.getAttribute('href').replace(/^https?:\/\//, '').replace(/^mailto:/, '').replace(/\/$/, '');
      if (visible !== destino) errores.push(`Link con texto distinto al href: "${visible}" y "${a.getAttribute('href')}"`);
    }
    const simbolos = document.body.innerText.match(/[\u2190-\u21FF\u2600-\u27BF\u2B00-\u2BFF\u{1F300}-\u{1FAFF}]/gu);
    if (simbolos) errores.push(`Símbolos decorativos en el texto: ${[...new Set(simbolos)].join(' ')}`);

    const contacto = document.querySelector('.contacto')?.textContent || '';
    const datos = {
      nombre: h1?.textContent.trim() || '',
      email: (contacto.match(/[\w.+-]+@[\w-]+\.[\w.-]+/) || [''])[0],
      telefono: (contacto.match(/\+?\d[\d ().-]{6,}\d/) || [''])[0],
      linkedin: (contacto.match(/linkedin\.com\/in\/[\w-]+/) || [''])[0],
    };
    const norm = (s) => s.replace(/\s+/g, ' ').trim();
    const puestos = [...document.querySelectorAll('.puesto')].map((p) => ({
      titulo: norm(p.querySelector('.cargo')?.textContent || ''),
      fechas: norm(p.querySelector('.fechas')?.textContent || ''),
      empresa: norm(p.querySelector('.empresa')?.textContent || ''),
    }));
    const entradas = [...document.querySelectorAll('.entrada')].map((e) => ({
      titulo: norm(e.querySelector('.entrada-titulo')?.textContent || ''),
      fechas: norm(e.querySelector('.fechas')?.textContent || ''),
    }));
    const formatoFecha = /^((Ene|Feb|Mar|Abr|May|Jun|Jul|Ago|Sep|Oct|Nov|Dic|Jan|Apr|Aug|Dec) )?\d{4}( - (((Ene|Feb|Mar|Abr|May|Jun|Jul|Ago|Sep|Oct|Nov|Dic|Jan|Apr|Aug|Dec) )?\d{4}|Presente|Present))?$/;
    for (const f of document.querySelectorAll('.fechas')) {
      if (!formatoFecha.test(norm(f.textContent))) avisos.push(`Fecha con formato no estándar: "${norm(f.textContent)}"`);
    }
    const bloques = [
      { id: 'encabezado', texto: norm(document.querySelector('header')?.textContent || '') },
      ...[...document.querySelectorAll('section.seccion')].map((s) => ({
        id: s.querySelector('h2')?.textContent.trim() || '',
        texto: norm(s.textContent),
      })),
    ];
    const fuentesCargadas = [...document.fonts].filter((f) => f.status === 'loaded').map((f) => `${f.family.replace(/"/g, '')} ${f.weight}`);
    return { errores, avisos, pares, datos, puestos, entradas, bloques, fuentesCargadas: [...new Set(fuentesCargadas)] };
  }, [clasesPermitidas, rangoNombre]);
}

async function revisarMovil(contexto, url) {
  const pagina = await contexto.newPage({ viewport: { width: 375, height: 812 } });
  await pagina.setViewportSize({ width: 375, height: 812 });
  await pagina.goto(url, { waitUntil: 'networkidle' });
  const anchos = await pagina.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
  await pagina.close();
  return anchos[0] > anchos[1] ? [`Scroll horizontal en móvil: ${anchos[0]}px de contenido en ${anchos[1]}px`] : [];
}

// ---------------------------------------------------------------------------
// Extracción de texto del PDF

async function extraerPdf(buffer) {
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    fontExtraProperties: true,
    disableFontFace: true,
    useSystemFonts: false,
    verbosity: 0,
  }).promise;
  const lineas = [];
  const visual = [];
  const fuentes = new Map();
  let tamanoMinimo = Infinity;
  let ocupacionUltima = 0;
  const margenes = { izq: Infinity, der: Infinity, arriba: Infinity, abajo: Infinity };

  for (let n = 1; n <= doc.numPages; n++) {
    const pagina = await doc.getPage(n);
    const alto = pagina.getViewport({ scale: 1 }).height;
    const contenido = await pagina.getTextContent();
    await pagina.getOperatorList();
    const items = contenido.items.filter((it) => typeof it.str === 'string');

    const vista = pagina.getViewport({ scale: 1 });
    const aMm = (v) => (v / 72) * 25.4;
    for (const it of items) {
      if (it.str.trim()) {
        const t = Math.hypot(it.transform[2], it.transform[3]);
        const x = it.transform[4];
        const y = it.transform[5];
        margenes.izq = Math.min(margenes.izq, aMm(x));
        margenes.der = Math.min(margenes.der, aMm(vista.width - x - it.width));
        margenes.arriba = Math.min(margenes.arriba, aMm(vista.height - y - t));
        margenes.abajo = Math.min(margenes.abajo, aMm(y - t * 0.25));
      }
      if (!fuentes.has(it.fontName)) {
        let info = { nombre: it.fontName, incrustada: false };
        try {
          const f = pagina.commonObjs.get(it.fontName);
          info = { nombre: f.name || it.fontName, incrustada: !f.missingFile };
        } catch {
          info.incrustada = null;
        }
        fuentes.set(it.fontName, info);
      }
      if (it.str.trim()) {
        const t = Math.hypot(it.transform[2], it.transform[3]);
        tamanoMinimo = Math.min(tamanoMinimo, t);
      }
    }

    // Orden de flujo: el orden en que el PDF guarda el texto, que es el que leen los parsers.
    const armar = (lista) => {
      const salida = [];
      let actual = null;
      for (const it of lista) {
        const y = it.transform[5];
        const x = it.transform[4];
        const t = Math.hypot(it.transform[2], it.transform[3]) || 10;
        if (!it.str && !it.hasEOL) continue;
        if (!actual || Math.abs(y - actual.y) > t * 0.4) {
          if (actual) salida.push(actual);
          actual = { y, texto: '', finX: x, pagina: n };
        }
        if (it.str) {
          const hueco = x - actual.finX;
          if (actual.texto && hueco > t * 0.15 && !/\s$/.test(actual.texto) && !/^\s/.test(it.str)) actual.texto += ' ';
          actual.texto += it.str;
          actual.finX = x + it.width;
        }
      }
      if (actual) salida.push(actual);
      return salida
        .map((l) => ({ ...l, texto: normalizar(l.texto) }))
        .filter((l) => l.texto);
    };
    const flujo = armar(items);
    lineas.push(...flujo);
    const ordenados = [...items].sort((a, b) => b.transform[5] - a.transform[5] || a.transform[4] - b.transform[4]);
    visual.push(...armar(ordenados));
    if (n === doc.numPages && flujo.length) {
      const minY = Math.min(...flujo.map((l) => l.y));
      ocupacionUltima = (alto - minY) / alto;
    }
  }
  return {
    paginas: doc.numPages,
    lineas,
    visual,
    fuentes: [...fuentes.values()],
    tamanoMinimo,
    ocupacionUltima,
    margenes,
  };
}

// Pruebas que dependen del orden de lectura. Se corren sobre las líneas de cada extractor.
function revisarOrden(textos, dom, extractor) {
  const errores = [];
  const e = (m) => errores.push(`[${extractor}] ${m}`);

  // Títulos de sección en orden.
  const orden = textos
    .map((t) => minus(t))
    .filter((t) => TITULOS.some((x) => minus(x) === t))
    .map((t) => TITULOS.find((x) => minus(x) === t));
  const esperados = TITULOS.filter((t) => dom.bloques.some((b) => minus(b.id) === minus(t)));
  if (orden.join('|') !== esperados.join('|')) {
    e(`Títulos de sección fuera de orden o ausentes. Esperado: ${esperados.join(', ')}. Extraído: ${orden.join(', ')}`);
  }

  // Datos de contacto exactos en una sola línea.
  for (const [campo, valor] of Object.entries(dom.datos)) {
    if (!valor) e(`No se encontró ${campo} en el HTML`);
    else if (!textos.some((t) => t.includes(valor))) e(`${campo} no aparece exacto en el texto extraído: "${valor}"`);
  }

  // Encabezados de puestos y entradas: el título completo en una línea, y las fechas en esa
  // misma línea o en la inmediatamente siguiente, siempre antes de la línea de empresa.
  const indiceTitulo = (t) => textos.findIndex((x) => minus(x) === minus(t));
  const revisarEncabezado = (lista, tipo, seccion) => {
    let desde = Math.max(0, indiceTitulo(seccion));
    for (const p of lista) {
      const i = textos.findIndex((t, k) => k > desde && t.startsWith(p.titulo));
      if (i < 0) {
        e(`${tipo} "${p.titulo}" no aparece completo en una línea (encabezado partido)`);
        continue;
      }
      desde = i;
      const misma = textos[i].includes(p.fechas) && textos[i].indexOf(p.fechas) > textos[i].indexOf(p.titulo);
      const siguiente = textos[i + 1] && textos[i + 1].startsWith(p.fechas);
      if (!misma && !siguiente) {
        const k = textos.findIndex((t, j) => j > i && t.includes(p.fechas));
        const donde = k > i ? `aparecen ${k - i} líneas después, tras "${textos[i + 1].slice(0, 50)}"` : 'no aparecen';
        e(`Las fechas de "${p.titulo}" (${p.fechas}) no están en su línea ni en la siguiente: ${donde}`);
      }
      if (p.empresa && !textos.some((t) => t.includes(p.empresa))) {
        e(`La línea de empresa de "${p.titulo}" ocupa más de una línea: "${p.empresa}"`);
      }
    }
  };
  revisarEncabezado(dom.puestos, 'El cargo', 'Experiencia Profesional');
  revisarEncabezado(dom.entradas, 'El estudio', 'Educación');

  const bloques = dom.bloques.map((b) => ({ ...b, texto: minus(b.texto) }));
  errores.push(...revisarIntercalado(textos, bloques, extractor));
  return errores;
}

// Líneas de secciones distintas intercaladas.
function revisarIntercalado(lineas, bloques, extractor) {
  const errores = [];
  let ultimo = -1;
  for (const t of lineas) {
    const lt = minus(t);
    const coincide = bloques.map((b, i) => (b.texto.includes(lt) ? i : -1)).filter((i) => i >= 0);
    if (!coincide.length) {
      errores.push(`[${extractor}] Línea que no corresponde a ninguna sección (posible mezcla de bloques): "${t.slice(0, 70)}"`);
      continue;
    }
    if (coincide.length > 1) continue;
    if (coincide[0] < ultimo) {
      errores.push(`[${extractor}] Línea de "${bloques[coincide[0]].id}" aparece después de "${bloques[ultimo].id}": "${t.slice(0, 70)}"`);
    }
    ultimo = Math.max(ultimo, coincide[0]);
  }
  return errores;
}

function revisarTexto(ext, dom) {
  const errores = [];
  const avisos = [];
  const textos = ext.lineas.map((l) => l.texto);
  const todo = textos.join('\n');

  const lig = todo.match(/[\uFB00-\uFB06]/g);
  if (lig) errores.push(`Caracteres de ligadura en el texto extraído: ${[...new Set(lig)].join(' ')}`);
  const pua = todo.match(/[\uE000-\uF8FF]/g);
  if (pua) errores.push(`Caracteres de uso privado en el texto extraído (${pua.length})`);
  const control = todo.match(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFD]/g);
  if (control) errores.push(`Caracteres de control o de reemplazo en el texto extraído (${control.length}): glifos sin equivalente Unicode`);
  const sueltas = todo.match(/(?:^|[\s(|])(\p{L} ){3,}\p{L}(?=$|[\s,.)|:])/gmu);
  if (sueltas) errores.push(`Letras separadas por espacios: ${sueltas.map((s) => `"${s.trim()}"`).join(', ')}`);
  if (todo.includes('\u2014')) errores.push('Guion largo en el texto extraído');
  if (ext.paginas > MAX_PAGINAS) errores.push(`${ext.paginas} páginas (máximo ${MAX_PAGINAS})`);
  if (ext.tamanoMinimo < 8.95) errores.push(`Texto de ${ext.tamanoMinimo.toFixed(2)}pt en el PDF (mínimo 9pt)`);
  const m = ext.margenes;
  if (m.izq < 12 || m.der < 12) errores.push(`Texto a menos de 12mm del borde lateral (izquierda ${m.izq.toFixed(1)}mm, derecha ${m.der.toFixed(1)}mm)`);
  if (m.arriba < 10 || m.abajo < 10) errores.push(`Texto a menos de 10mm del borde superior o inferior (arriba ${m.arriba.toFixed(1)}mm, abajo ${m.abajo.toFixed(1)}mm)`);

  for (const f of ext.fuentes) {
    if (f.incrustada === false) errores.push(`Fuente no incrustada: ${f.nombre}`);
    if (f.incrustada === null) avisos.push(`No se pudo verificar la incrustación de ${f.nombre}`);
  }

  errores.push(...revisarOrden(textos, dom, 'pdfjs'));
  const bloques = dom.bloques.map((b) => ({ ...b, texto: minus(b.texto) }));
  errores.push(...revisarIntercalado(ext.visual.map((l) => l.texto), bloques, 'pdfjs por posición'));
  const esperados = TITULOS.filter((t) => dom.bloques.some((b) => minus(b.id) === minus(t)));
  if (esperados.length !== TITULOS.length) {
    avisos.push(`Secciones ausentes en el contenido: ${TITULOS.filter((t) => !esperados.includes(t)).join(', ')}`);
  }

  // Palabras con guion partidas al final de línea: el ATS puede leerlas como dos palabras.
  textos.forEach((t, i) => {
    const m = t.match(/(\S*\p{L}-)$/u);
    if (m && textos[i + 1] && /^\p{L}/u.test(textos[i + 1])) {
      avisos.push(`Palabra con guion partida entre líneas: "${m[1]}${textos[i + 1].split(' ')[0]}"`);
    }
  });

  // Segundo orden de lectura: por posición en la página, como hacen los extractores de layout.
  const flujo = ext.lineas.map((l) => minus(l.texto)).join('\n');
  const visual = ext.visual.map((l) => minus(l.texto)).join('\n');
  if (flujo !== visual) {
    const a = flujo.split('\n');
    const b = visual.split('\n');
    const k = a.findIndex((x, i) => x !== b[i]);
    avisos.push(`El orden de flujo y el orden por posición difieren desde la línea ${k + 1}: "${a[k]}" y "${b[k]}"`);
  }
  return { errores, avisos };
}

// Segundo extractor obligatorio: pdftotext (poppler) en modo normal, sin -layout.
let pdftotextDisponible = null;
function revisarPdftotext(archivoPdf, ext, dom) {
  if (pdftotextDisponible === null) {
    try {
      execFileSync('pdftotext', ['-v'], { stdio: 'ignore' });
      pdftotextDisponible = true;
    } catch {
      pdftotextDisponible = false;
    }
  }
  if (!pdftotextDisponible) {
    return { errores: ['pdftotext no está instalado y es obligatorio (brew install poppler o apt install poppler-utils)'], avisos: [], texto: '' };
  }
  const texto = execFileSync('pdftotext', ['-enc', 'UTF-8', archivoPdf, '-']).toString();
  let lineas = texto.split(/[\n\f]/).map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const avisos = [];
  // pdftotext une las palabras con guion partidas al final de línea ("e-" + "commerce" da
  // "ecommerce") y junta las dos líneas. Se separan de nuevo y queda como aviso.
  const pdfjsLineas = ext.lineas.map((l) => l.texto.replace(/\s+/g, ' ').trim());
  lineas = lineas.flatMap((l) => {
    for (let i = 0; i < pdfjsLineas.length - 1; i++) {
      const a = pdfjsLineas[i];
      const b = pdfjsLineas[i + 1];
      if (/\p{L}-$/u.test(a) && l === `${a.slice(0, -1)}${b}`) {
        const palabra = `${a.split(' ').pop()}${b.split(' ')[0]}`;
        avisos.push(`pdftotext lee la palabra partida "${palabra}" como "${palabra.replace('-', '')}"`);
        return [a, b];
      }
    }
    return [l];
  });
  const errores = revisarOrden(lineas, dom, 'pdftotext');
  const palabras = (s) => minus(s).split(' ').filter(Boolean);
  const a = palabras(ext.lineas.map((l) => l.texto).join(' '));
  const b = palabras(lineas.join(' '));
  const k = a.findIndex((x, i) => x !== b[i]);
  if (k >= 0 || a.length !== b.length) {
    avisos.push(`pdftotext y pdfjs difieren en el orden desde la palabra ${k + 1}: "${a.slice(k, k + 6).join(' ')}" y "${b.slice(k, k + 6).join(' ')}"`);
  }
  return { errores, avisos, texto };
}

// ---------------------------------------------------------------------------
// Proceso de un archivo HTML en un modo (con red o sin red)

async function procesar(navegador, { archivoHtml, base, dirSalida, conRed, guardar }) {
  const fuentesWeb = [...fs.readFileSync(archivoHtml, 'utf8').matchAll(/@fontsource\/([a-z0-9-]+)@/g)]
    .map((m) => m[1].replace(/-/g, ''))
    .filter((v, i, a) => a.indexOf(v) === i);
  const contexto = await navegador.newContext();
  if (!conRed) {
    await contexto.route('**/*', (ruta) => (ruta.request().url().startsWith('file:') ? ruta.continue() : ruta.abort()));
  }
  const url = pathToFileURL(archivoHtml).href;
  const pagina = await contexto.newPage();
  await pagina.goto(url, { waitUntil: 'networkidle' });
  await pagina.emulateMedia({ media: 'print' });
  await pagina.evaluate(() => document.fonts.ready);
  const esClasico = /TEMPLATE: clasico\b/.test(fs.readFileSync(archivoHtml, 'utf8'));
  const dom = await revisarDom(pagina, [...clasesContrato(clasico)], esClasico ? [18, 26] : [28, 44]);

  const errores = [...dom.errores];
  const avisos = [...dom.avisos];
  for (const { texto, clase, colores } of dom.pares) {
    const r = contraste(colores[0], colores[1]);
    if (r < 4.5) errores.push(`Contraste ${r.toFixed(2)}:1 en .${clase} ("${texto}")`);
  }
  if (conRed) errores.push(...(await revisarMovil(contexto, url)));

  const formatos = {};
  for (const { id, formato } of FORMATOS) {
    const buffer = await pagina.pdf({ format: formato, printBackground: true });
    const ext = await extraerPdf(buffer);
    const r = revisarTexto(ext, dom);
    const resultado = {
      paginas: ext.paginas,
      ocupacionUltima: Math.round(ext.ocupacionUltima * 100),
      margenesTextoMm: Object.fromEntries(Object.entries(ext.margenes).map(([k, v]) => [k, +v.toFixed(1)])),
      fuentes: [...new Set(ext.fuentes.map((f) => f.nombre.replace(/^[A-Z]{6}\+/, '')))],
      errores: r.errores,
      avisos: r.avisos,
    };
    if (conRed) {
      const enPdf = resultado.fuentes.map((f) => f.toLowerCase().replace(/[^a-z0-9]/g, ''));
      for (const web of fuentesWeb) {
        if (!enPdf.some((f) => f.startsWith(web))) resultado.errores.push(`La fuente web ${web} no llegó al PDF (no cargó o no se usa)`);
      }
    }
    if (guardar) {
      const pdf = path.join(dirSalida, `${base}-${id}.pdf`);
      fs.writeFileSync(pdf, buffer);
      const txt = [];
      let pag = 1;
      for (const l of ext.lineas) {
        if (l.pagina !== pag) {
          txt.push('\f');
          pag = l.pagina;
        }
        txt.push(l.texto);
      }
      fs.writeFileSync(path.join(dirSalida, `${base}-${id}.txt`), txt.join('\n') + '\n');
      for (const f of fs.readdirSync(dirSalida)) {
        if (new RegExp(`^${base}-${id}-\\d+\\.png$`).test(f)) fs.unlinkSync(path.join(dirSalida, f));
      }
      const pngs = await renderizarPng(navegador, buffer, ESCALA_PNG);
      pngs.forEach((png, i) => fs.writeFileSync(path.join(dirSalida, `${base}-${id}-${i + 1}.png`), png));
    }
    const pdfTemporal = path.join(os.tmpdir(), `verificar-cv-${process.pid}-${base}-${id}.pdf`);
    fs.writeFileSync(pdfTemporal, buffer);
    const p2 = revisarPdftotext(pdfTemporal, ext, dom);
    fs.unlinkSync(pdfTemporal);
    resultado.errores.push(...p2.errores);
    resultado.avisos.push(...p2.avisos);
    resultado.extractores = {
      pdfjs: r.errores.some((x) => x.startsWith('[pdfjs')) ? 'falla' : 'pasa',
      pdftotext: !pdftotextDisponible ? 'no instalado' : p2.errores.length ? 'falla' : 'pasa',
    };
    if (guardar && p2.texto) fs.writeFileSync(path.join(dirSalida, `${base}-${id}.pdftotext.txt`), p2.texto);
    formatos[id] = resultado;
  }
  await contexto.close();
  return { errores, avisos, fuentesCargadas: dom.fuentesCargadas, formatos };
}

// ---------------------------------------------------------------------------
// Programa principal

// Los argumentos pueden ser nombres de templates del skill o rutas a archivos .html.
// Los archivos sueltos se revisan igual, pero su salida va a una carpeta temporal.
const clasico = fs.readFileSync(path.join(dirTemplates, 'clasico.html'), 'utf8');
const pedidos = process.argv.slice(2);
const sueltos = pedidos.filter((p) => p.endsWith('.html'));
const nombres = fs
  .readdirSync(dirTemplates)
  .filter((f) => f.endsWith('.html'))
  .map((f) => f.replace(/\.html$/, ''))
  .filter((n) => (!pedidos.length ? true : pedidos.includes(n)))
  .sort((a, b) => (a === 'clasico' ? -1 : b === 'clasico' ? 1 : a.localeCompare(b)));
const dirTemporal = path.join(os.tmpdir(), 'verificar-cv');
const trabajos = [
  ...nombres.map((nombre) => ({ nombre, archivo: path.join(dirTemplates, `${nombre}.html`), salida: dirPreview, inter: dirIntercambio })),
  ...sueltos.map((p) => ({
    nombre: path.basename(p, '.html'),
    archivo: path.resolve(p),
    salida: dirTemporal,
    inter: path.join(dirTemporal, 'intercambio'),
    suelto: true,
  })),
];

const navegador = await chromium.launch();
const archivoResultados = path.join(dirPreview, 'resultados.json');
const resultados = fs.existsSync(archivoResultados) ? JSON.parse(fs.readFileSync(archivoResultados, 'utf8')) : {};
let hayErrores = false;

const juntar = (r) => [
  ...r.errores,
  ...Object.entries(r.formatos).flatMap(([f, x]) => x.errores.map((e) => `[${f}] ${e}`)),
];

for (const { nombre, archivo, salida, inter, suelto } of trabajos) {
  fs.mkdirSync(inter, { recursive: true });
  const html = fs.readFileSync(archivo, 'utf8');
  const nombreTemplate = (html.match(/TEMPLATE: ([a-z0-9-]+)/) || [])[1] || nombre;
  const estatico = [...revisarCss(html), ...revisarHtml(html, nombreTemplate).errores, ...revisarContrato(html, clasico, !suelto)];

  const web = await procesar(navegador, { archivoHtml: archivo, base: nombre, dirSalida: salida, conRed: true, guardar: true });
  const sinRed = await procesar(navegador, { archivoHtml: archivo, base: nombre, dirSalida: salida, conRed: false, guardar: false });

  let intercambio = null;
  if (nombre !== 'clasico' && !suelto) {
    const archivoIntercambio = path.join(inter, `${nombre}.html`);
    try {
      fs.writeFileSync(archivoIntercambio, reemplazarBloques(html, clasico));
      intercambio = await procesar(navegador, {
        archivoHtml: archivoIntercambio,
        base: nombre,
        dirSalida: inter,
        conRed: true,
        guardar: true,
      });
    } catch (e) {
      intercambio = { errores: [`No se pudo hacer el intercambio: ${e.message}`], avisos: [], formatos: {} };
    }
  }

  const resultado = { estatico, web, sinRed, intercambio };
  if (!suelto) resultados[nombre] = resultado;
  const fallas = [
    ...estatico.map((e) => `[estático] ${e}`),
    ...juntar(web).map((e) => `[con red] ${e}`),
    ...juntar(sinRed).map((e) => `[sin red] ${e}`),
    ...(intercambio ? juntar(intercambio).map((e) => `[intercambio] ${e}`) : []),
  ];
  resultado.aprobado = fallas.length === 0;
  if (fallas.length) hayErrores = true;

  const paginas = FORMATOS.map(({ id }) => `${id} ${web.formatos[id].paginas}p (${web.formatos[id].ocupacionUltima}%)`).join(', ');
  console.log(`\n${resultado.aprobado ? 'PASA' : 'FALLA'}  ${nombre}  [${paginas}]`);
  console.log(`  Fuentes en el PDF: ${web.formatos.a4.fuentes.join(', ')}`);
  console.log(`  Fuentes sin red:   ${sinRed.formatos.a4.fuentes.join(', ')}`);
  const modos = [web, sinRed, intercambio].filter(Boolean).flatMap((m) => Object.values(m.formatos));
  const estadoDe = (x) => {
    const estados = modos.map((f) => f.extractores && f.extractores[x]).filter(Boolean);
    return estados.includes('no instalado') ? 'no instalado' : estados.includes('falla') ? 'falla' : 'pasa';
  };
  resultado.extractores = { pdfjs: estadoDe('pdfjs'), pdftotext: estadoDe('pdftotext') };
  console.log(`  Extractores:       pdfjs ${resultado.extractores.pdfjs} | pdftotext ${resultado.extractores.pdftotext}`);
  for (const f of fallas) console.log(`  ERROR ${f}`);
  const avisos = [
    ...web.avisos,
    ...Object.entries(web.formatos).flatMap(([f, x]) => x.avisos.map((a) => `[${f}] ${a}`)),
  ];
  for (const a of [...new Set(avisos)]) console.log(`  AVISO ${a}`);
}

await navegador.close();
fs.writeFileSync(archivoResultados, JSON.stringify(resultados, null, 2));
console.log(hayErrores ? '\nHay templates con errores.' : '\nTodos los templates pasan las pruebas.');
process.exit(hayErrores ? 1 : 0);
