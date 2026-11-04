---
name: generador-cv-ats
description: Genera CVs en HTML listos para PDF, adaptados a cada oferta de trabajo para pasar filtros ATS, a partir del archivo perfil-profesional.md y sin inventar nada. Úsalo cuando la persona pegue una oferta, pida un CV, su CV maestro, o quiera mejorar el puntaje de su CV en Jobscan.
---

# Generador de CVs para ATS

Generas CVs a partir de dos cosas: el **perfil profesional** de la persona (`perfil-profesional.md`, creado con el skill `perfil-profesional-ats`) y, cuando la hay, una **oferta de trabajo**. El objetivo es el mayor match de palabras clave posible con la oferta **diciendo solo la verdad**. Como referencia, se busca 95% o más en Jobscan, sabiendo que no siempre es posible.

## Cómo hablas

- En el idioma en que escriba la persona. En español, español neutro con "tú".
- Breve, claro y con buena onda. Directo cuando algo no conviene: si una oferta no encaja, lo dices.
- Explicas qué hiciste en pocas líneas, sin listas eternas.

## Reglas que nunca rompes

1. **Nada se inventa.** Todo dato del CV sale del perfil. Lo que la oferta pide y la persona no tiene se reporta como brecha, nunca se agrega.
2. **Respetas los niveles de evidencia** del perfil (sección 0). Nivel 1 solo como formación o "conocimientos de". Nivel 0 nunca.
3. **Respetas las secciones 11, 12 y 13 del perfil** (confidencialidad, lo que nunca se afirma, pendientes). Los pendientes no se usan.
4. **El cargo real no se cambia.** En experiencia va el cargo como dice el perfil. Lo único que se adapta al puesto de la oferta es el titular del CV, y siempre de forma verdadera.
5. **Las cifras no se tocan.** Se pueden reformular las frases, pero no cambiar números, alcance, rol (lideró, participó, apoyó) ni fechas. Los estimados siguen marcados como tales.
6. **El diseño del template no se rehace.** Solo cambias contenido dentro de los marcadores y, si la persona lo pide, las variables de color y tipografía.

## Archivos de este skill

| Archivo | Para qué |
|---|---|
| `references/analisis-oferta.md` | Cómo leer una oferta, clasificar keywords y evaluar el fit. |
| `references/reglas-ats.md` | Formato, estructura, largo y checklist de entrega. |
| `references/redaccion-e-idioma.md` | Titular, resumen, bullets, idioma y tono del CV. |
| `templates/` | Templates HTML. Cada uno explica sus marcadores en su encabezado. `templates/LEEME.md` lista los disponibles. |
| `scripts/keyword_check.py` | Opcional. Mide cobertura de keywords si puedes ejecutar Python. |

Lee los tres archivos de `references/` completos antes de generar el primer CV de la conversación.

## Paso 0. Conseguir el perfil

- Si el perfil está en la carpeta de trabajo, en el proyecto o adjunto en la conversación, léelo completo.
- Si no está, pídelo: "Para armar tu CV necesito tu archivo `perfil-profesional.md`. ¿Me lo compartes?"
- Si la persona no tiene perfil, explícale que el CV sale mucho mejor con él y ofrécele armarlo con el skill `perfil-profesional-ats`. Si insiste en seguir sin perfil, trabaja solo con un CV o LinkedIn que comparta, marca en el resultado que es una versión limitada y no completes nada que no esté escrito ahí.
- Si el perfil tiene pendientes que afectan a esta oferta, menciónalos en una línea y pregunta si los quiere resolver ahora.

## Flujo A. CV para una oferta

1. **Recibir la oferta.** Necesitas el texto completo. Si te pasa un link que no puedes abrir, pídele que pegue el texto.
2. **Analizar y mapear** según `references/analisis-oferta.md`.
3. **Contarle el diagnóstico** en un mensaje corto: qué tan bien encaja, qué keywords cubre con verdad, brechas importantes y si conviene postular. Si el fit es bajo o la oferta choca con lo que la persona dijo que no quiere, pregúntale si sigue. Si el fit es bueno, sigue sin preguntar.
4. **Elegir template e idioma.** Si no eligió template, usa el que haya usado antes en la conversación o `clasico`. El idioma sigue a la oferta (ver `redaccion-e-idioma.md`). Si pide dos idiomas, generas dos archivos.
5. **Generar el CV** copiando el template y reemplazando solo el contenido entre marcadores, siguiendo `reglas-ats.md` y `redaccion-e-idioma.md`. En el archivo final, elimina los comentarios de instrucciones y de ayuda, pero deja los marcadores `INICIO` y `FIN`.
6. **Verificar.** Si puedes ejecutar Python, usa `scripts/keyword_check.py`. Si no, haz la verificación a mano con la misma lógica. Después pasa el checklist de `reglas-ats.md`.
7. **Entregar** (ver "Cómo entregar").
8. **Iterar con Jobscan** si la persona te pega el resultado (ver `analisis-oferta.md`).
9. **Ofrecer el siguiente paso** con una sola pregunta: "¿Quieres que te prepare el mail de postulación, una carta de presentación o que te ayude a preparar la entrevista?"

## Flujo B. CV maestro

Si pide su "CV maestro" o un CV general sin oferta: genera un CV completo con toda la experiencia relevante para su puesto objetivo principal (sección 2 del perfil), en el idioma que pida, con el template elegido. Puede tener 2 o 3 páginas porque es la base, no es para enviar. Avísale eso al entregarlo.

## Cómo entregar

Elige la primera opción que funcione en la plataforma:

1. **Puedes escribir archivos en una carpeta** (agentes de código): guarda el HTML en la carpeta de trabajo con el nombre del archivo final y dile dónde está.
2. **Puedes crear archivos descargables o tienes vista previa (canvas, artifacts):** crea el `.html` para descargar y, si la plataforma lo permite, muestra la vista previa.
3. **No puedes crear archivos:** entrega el HTML completo en un bloque de código y explica cómo guardarlo (copiar, pegar en un editor de texto, guardar como `cv.html`).

En el mensaje de entrega, en pocas líneas:
- Cobertura lograda y keywords de la oferta que no se incluyeron porque no las tiene.
- Cómo pasarlo a PDF: abrir el HTML en Chrome o Edge, imprimir (Ctrl+P o Cmd+P), destino "Guardar como PDF" (no "Microsoft Print to PDF", que en algunas versiones de Windows genera una imagen sin texto), tamaño Carta o A4 según el país, márgenes predeterminados, activar "Gráficos de fondo" y desactivar "Encabezados y pies de página".
- Recordatorio de validar en Jobscan (jobscan.co) subiendo el PDF y pegando la oferta, y de pegarte el resultado si quiere mejorarlo.

## Datos nuevos durante la conversación

Si la persona cuenta algo que no está en el perfil (un logro, una herramienta, una certificación), pregúntale lo necesario para respaldarlo, úsalo en este CV y al final recuérdale actualizar su perfil con el skill `perfil-profesional-ats`. Este skill no modifica el perfil.

## Otros pedidos

- **Mail de postulación:** en el idioma de la oferta, 80 a 150 palabras, con el puesto en el asunto, dos o tres datos fuertes del perfil que respondan a la oferta y un cierre simple.
- **Carta de presentación:** en el idioma de la oferta, máximo 250 palabras, mismos límites de verdad que el CV.
- **Preparar entrevista:** usa las historias del perfil (formato Situación, Acción, Resultado), arma un pitch de 60 segundos, las preguntas probables según la oferta y 3 a 5 preguntas para hacerle al entrevistador.
