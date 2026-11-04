# Templates de CV

Familia de templates HTML para CVs que se convierten a PDF desde Chrome y que priorizan la lectura correcta por parte de un ATS. Todos comparten la misma estructura (la de `clasico.html`) y cambian solo la piel: tipografía, color, escala, espaciado y detalles gráficos.

## Templates

| Template | Estilo | Para quién | Fuentes |
| --- | --- | --- | --- |
| `clasico` | Sobrio y universal. Azul, títulos en mayúscula con filete. Versión 1.1 | Cualquier perfil. Es la referencia de la estructura y el estilo por defecto | Calibri, con Carlito, Segoe UI, Helvetica Neue o Arial |
| `editorial` | Cálido y editorial. Papel crema, encabezado verde de borde a borde con una esquina redondeada, barras y viñetas rosa | Product designers, UX/UI, content designers, UX writers | Gloock, DM Sans |
| `grotesk` | Grotesca de alto contraste. Encabezado negro con franja lima, secciones enmarcadas con filetes de 1px | Backend, DevOps, cloud, design engineers, creative developers, DevRel, growth técnico | Archivo Black, Archivo, IBM Plex Mono |
| `analitico` | Informe de datos. Papel marfil, titular resaltado en naranja, títulos con línea punteada | Data science, machine learning e IA, analytics, BI, product managers con foco en métricas | Spectral, Arial, DM Mono |
| `suizo` | Tipográfico suizo. Blanco y negro, nombre y titular en dos tonos, un cuadrado rojo junto a cada título | Frontend, fullstack, mobile, ingeniería de producto SaaS. Opción segura para cualquier perfil | Inter |
| `cercano` | Amable y redondeado. Bloque verde bosque, títulos en píldora, cada puesto en un contenedor verde claro | QA, soporte técnico, customer success técnico, Scrum masters, perfiles junior y trainee | Plus Jakarta Sans |

Las fuentes web se cargan desde jsdelivr (paquetes `@fontsource` con versión fija y pesos estáticos). Si no cargan, cada template cae en fuentes del sistema y sigue pasando las mismas pruebas.

## Contrato

Todos los templates cumplen este contrato. Gracias a eso, el contenido entre marcadores de cualquier template se puede pegar en otro sin tocar nada.

**Marcadores.** Exactamente estos, en este orden, cada uno con su par `INICIO` y `FIN`:

```
<!-- INICIO:encabezado -->      <!-- FIN:encabezado -->
<!-- INICIO:resumen -->         <!-- FIN:resumen -->
<!-- INICIO:habilidades -->     <!-- FIN:habilidades -->
<!-- INICIO:experiencia -->     <!-- FIN:experiencia -->
<!-- INICIO:educacion -->       <!-- FIN:educacion -->
<!-- INICIO:certificaciones --> <!-- FIN:certificaciones -->
<!-- INICIO:proyectos -->       <!-- FIN:proyectos -->
<!-- INICIO:idiomas -->         <!-- FIN:idiomas -->
```

**Clases de contenido.** Solo estas: `.cv`, `.nombre`, `.titular`, `.contacto`, `.seccion`, `.habilidades`, `.puesto`, `.puesto-encabezado`, `.cargo`, `.fechas`, `.empresa`, `.nota`, `.entrada`, `.entrada-encabezado`, `.entrada-titulo`, `.detalle`, `ul.compacta`, más las clases de sección (`resumen`, `experiencia`, `educacion`, `certificaciones`, `proyectos`, `idiomas`). Ningún template agrega clases ni elementos de decoración: toda la decoración sale del CSS aplicado a esas clases.

**Etiquetas.** `h1.nombre` para el nombre, `h2` para cada título de sección, `ul` y `li` para viñetas, `header` para el encabezado y `section.seccion` para cada sección.

**Títulos de sección.** Perfil Profesional, Habilidades, Experiencia Profesional, Educación, Certificaciones y Formación, Proyectos, Idiomas. Se escriben en formato normal; algunos templates los muestran en mayúscula con CSS.

**Estructura de cada puesto.**

```html
<div class="puesto">
  <div class="puesto-encabezado">
    <span class="cargo">Cargo</span> | <span class="fechas">Mar 2022 - Presente</span>
  </div>
  <p class="empresa">Empresa, Ciudad, País <span class="nota">| Nota breve</span></p>
  <ul>
    <li>Logro.</li>
  </ul>
</div>
```

**Cargo y fechas.** Van en la misma línea, separados por ` | ` escrito en el contenido. Lo mismo para el título de un estudio y su fecha. No alinees la fecha a la derecha: `pdftotext` y los parsers que leen parecido la separan del cargo y la leen después de la empresa.

**Variables.** Solo en `:root`. Las marcadas como `PERSONALIZABLE` se pueden cambiar si la persona lo pide; las marcadas como `FIJO`, no. Todos los templates nuevos tienen como mínimo `--acento`, `--fuente` (o `--fuente-texto` y `--fuente-titulos`), `--tamano-base`, `--tamano-nombre` e `--interlineado`. Si el nombre ocupa dos líneas, baja `--tamano-nombre` (mínimo 28pt). Cuando `--acento` va detrás de texto claro (`editorial`, `cercano`), tiene que seguir siendo oscuro; cuando un color va detrás de texto oscuro (`--fondo-titulo` en `grotesk`), tiene que seguir siendo claro.

**Archivo.** Un solo HTML con un único `<style>`, sin JavaScript y sin dependencias locales. Las únicas dependencias externas permitidas son hojas de fuentes de fonts.googleapis.com o de jsdelivr con versión fija.

**Encabezado de borde a borde.** En `editorial` y `grotesk`, `@page` tiene márgenes laterales en 0 y la primera página no tiene margen superior; el margen del texto lo da el `padding` de `.cv`. No cambies esos márgenes: el verificador mide que el texto quede a 12mm o más de los bordes laterales. Al imprimir en papel, muchas impresoras dejan un filo blanco de 3 a 5mm alrededor del bloque de color.

**Para imprimir a PDF desde Chrome.** Destino "Guardar como PDF", márgenes "Predeterminados" y la opción "Encabezados y pies de página" desmarcada. Si queda marcada, Chrome agrega la fecha, el título y la ruta del archivo en los márgenes, y eso termina como texto en el PDF.

**Verificación.** El verificador no forma parte de este skill. Está en `tools/templates/` del repositorio y requiere `pdftotext` (`brew install poppler` en macOS, `apt install poppler-utils` en Linux). Con `npm install` hecho, `node verificar.mjs` revisa estos seis templates y `node verificar.mjs ruta/al/cv.html` revisa un CV ya completado.
