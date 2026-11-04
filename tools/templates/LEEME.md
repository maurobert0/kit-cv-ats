# Verificador de templates

Revisa que los seis templates de `skills/generador-cv-ats/templates/` se lean bien como PDF, con pdfjs y con `pdftotext`.

## Qué necesitas

- Node.js
- `pdftotext`, que viene con poppler (`brew install poppler` en macOS, `apt install poppler-utils` en Linux)
- Chromium de Playwright, que se descarga la primera vez

## Cómo correrlo

Desde esta carpeta:

```
npm install
npx playwright install chromium
node verificar.mjs
```

Sin argumentos revisa los seis templates, en A4 y en Carta, con red, sin red y con la prueba de intercambio de contenido. Sale con código 1 si alguno falla.

`node verificar.mjs editorial` revisa uno solo. `node verificar.mjs ruta/al/cv.html` revisa un CV ya completado (permite secciones borradas y no hace el intercambio).

`node probar-verificador.mjs` genera versiones rotas a propósito y confirma que el verificador las detecta.

Los PDF, las imágenes y el texto extraído quedan en `preview/` en la raíz del repo. Esa carpeta está en `.gitignore`.

`aplicar-contenido.mjs` vuelve a pegar el contenido de ejemplo (`contenido-ejemplo.html`) en los templates que no son `clasico`. Úsalo solo si vas a regenerar el ejemplo.
