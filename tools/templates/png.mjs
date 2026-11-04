// Renderiza cada página de un PDF a PNG con pdfjs-dist dentro de Chromium.
// Uso como script: node png.mjs archivo.pdf [escala]  (guarda archivo-1.png, archivo-2.png, ...)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const dirPdfjs = path.join(aqui, 'node_modules/pdfjs-dist/build');

export async function renderizarPng(navegador, buffer, escala = 1.6) {
  const contexto = await navegador.newContext();
  const pagina = await contexto.newPage();
  await pagina.route('http://verificar.local/**', (ruta) => {
    const url = new URL(ruta.request().url());
    if (url.pathname === '/') return ruta.fulfill({ contentType: 'text/html', body: '<!DOCTYPE html><html><body></body></html>' });
    if (url.pathname === '/doc.pdf') return ruta.fulfill({ contentType: 'application/pdf', body: buffer });
    const archivo = path.join(dirPdfjs, path.basename(url.pathname));
    return ruta.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(archivo) });
  });
  await pagina.goto('http://verificar.local/');
  const imagenes = await pagina.evaluate(async (escala) => {
    const pdfjsLib = await import('/pdf.mjs');
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.mjs';
    const doc = await pdfjsLib.getDocument('/doc.pdf').promise;
    const salida = [];
    for (let n = 1; n <= doc.numPages; n++) {
      const p = await doc.getPage(n);
      const vista = p.getViewport({ scale: escala });
      const lienzo = document.createElement('canvas');
      lienzo.width = vista.width;
      lienzo.height = vista.height;
      const ctx = lienzo.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, lienzo.width, lienzo.height);
      await p.render({ canvasContext: ctx, viewport: vista }).promise;
      salida.push(lienzo.toDataURL('image/png').split(',')[1]);
    }
    return salida;
  }, escala);
  await contexto.close();
  return imagenes.map((b64) => Buffer.from(b64, 'base64'));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { chromium } = await import('playwright');
  const [archivo, escala] = process.argv.slice(2);
  const navegador = await chromium.launch();
  const pngs = await renderizarPng(navegador, fs.readFileSync(archivo), escala ? Number(escala) : 1.6);
  pngs.forEach((png, i) => fs.writeFileSync(archivo.replace(/\.pdf$/, `-${i + 1}.png`), png));
  await navegador.close();
  console.log(`${pngs.length} páginas`);
}
