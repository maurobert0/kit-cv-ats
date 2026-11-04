# Reglas de formato y estructura para ATS

Un ATS (Applicant Tracking System) convierte el CV en texto y lo ordena por coincidencia con la oferta antes de que lo lea una persona. Estas reglas buscan que el texto se extraiga limpio y que las keywords se encuentren.

## Estructura

- **Una sola columna.** El orden del HTML es el orden de lectura.
- **Sin tablas, cuadros de texto, columnas, íconos con significado, barras de nivel, gráficos ni foto.**
- **Datos de contacto en el cuerpo del documento**, nunca en encabezados o pies de página de impresión.
- **Orden cronológico inverso** en experiencia y educación.
- **Títulos de sección estándar**, porque son los que reconocen los ATS:

| Inglés | Español |
|---|---|
| Professional Summary | Perfil Profesional |
| Skills | Habilidades |
| Professional Experience | Experiencia Profesional |
| Education | Educación |
| Certifications | Certificaciones |
| Projects | Proyectos |
| Languages | Idiomas |

Puedes usar "Certifications & Training" / "Certificaciones y Formación" si mezclas certificaciones y cursos.

## Orden de secciones

Por defecto: titular, resumen, habilidades, experiencia, educación, certificaciones, proyectos (si suman), idiomas.

Cambia el orden solo con motivo:
- Persona junior o en transición de carrera, con formación más fuerte que su experiencia en el área: educación y proyectos antes de experiencia.
- Diseño de producto, UX o frontend con portfolio: el link al portfolio siempre en el contacto.

## Fechas

- Inglés: `Mon YYYY - Mon YYYY` y `Present` (por ejemplo `Mar 2021 - Present`).
- Español: `Mes AAAA - Mes AAAA` abreviado y `Presente` (por ejemplo `Mar 2021 - Presente`).
- Siempre mes y año. Solo el año puede leerse como dato incompleto.
- El mismo formato en todo el CV.

## Keywords

- El **título exacto de la oferta** aparece en el titular y en la primera frase del resumen, dicho con verdad (ver `redaccion-e-idioma.md`).
- Cada keyword importante aparece en habilidades **y** al menos una vez dentro de un bullet o del resumen. Una keyword dentro de un logro pesa más que en una lista.
- Las keywords centrales, 2 a 4 veces en total. Más de 5 se lee como relleno.
- Siglas con su forma larga la primera vez, si la oferta usa una de las dos: "Search Engine Optimization (SEO)", "Continuous Integration (CI)".
- Usa la grafía exacta de la oferta cuando es la misma herramienta: "Node.js" y no "NodeJS" si la oferta dice "Node.js".

## Largo

- **1 página:** perfiles junior, ofertas con pocos requisitos o cuando la oferta lo pide.
- **2 páginas:** la mayoría de los perfiles con experiencia. Es el caso más común.
- **Nunca más de 2 páginas** en un CV para una oferta. El CV maestro puede tener 3.
- Si no entra, se recorta contenido (bullets menos relevantes, experiencias antiguas, cursos menores). Nunca se achica la tipografía ni se reducen márgenes por debajo de lo que define el template.
- Referencia aproximada: 450 a 600 palabras por página.

## Técnico

- `<meta charset="UTF-8">` en el HTML. Las tildes y la ñ se escriben normalmente, no hace falta convertirlas a entidades.
- El `<title>` del HTML es el nombre que propone el navegador al guardar el PDF. Formato: `Nombre_Apellido_CV_Empresa_Puesto`, sin tildes, sin espacios.
- Fuentes del sistema o de Google Fonts con alternativa segura. El PDF tiene que tener texto seleccionable, no imagen.
- Links visibles como texto completo (`linkedin.com/in/usuario`), nunca escondidos detrás de una palabra como "LinkedIn" o "Portfolio".
- Nada de símbolos decorativos en el texto (★, ✓, →, emojis) ni guiones largos (—). Separadores permitidos: barra vertical (|), coma o guion simple.
- Meses abreviados sin punto (`Mar 2022`, no `Mar. 2022`) y sin apóstrofes (`2022`, no `'22`).
- Prueba final: seleccionar todo el PDF, pegarlo en un editor de texto plano y confirmar que se lee en orden, sin letras separadas ni palabras cortadas.

## Nunca va en el CV

- Foto, documento de identidad, fecha de nacimiento, edad, estado civil, nacionalidad (salvo que la oferta pida permiso de trabajo y la persona quiera aclararlo), dirección exacta, religión, datos de salud.
- Referencias o "referencias a solicitud".
- Promedio, salvo que el perfil diga que se muestra.
- Escuela secundaria, salvo que no haya otra formación.
- Motivos de salida de trabajos anteriores.
- Expectativa salarial.
- Emojis.
- Nada de las secciones 11, 12 y 13 del perfil.

## Checklist antes de entregar

- [ ] El título exacto de la oferta está en el titular y en la primera frase del resumen, dicho con verdad.
- [ ] Los cargos en experiencia son los del perfil, sin inflar.
- [ ] Todas las keywords ✅ de la oferta aparecen al menos una vez en contexto.
- [ ] Las keywords 🎓 aparecen solo como formación o "conocimientos de".
- [ ] Ninguna keyword ❌ aparece.
- [ ] Cada cifra coincide con el perfil, con su calificador (~, estimado, +).
- [ ] Fechas con mes y año, formato consistente.
- [ ] Sin keyword repetida más de 5 veces.
- [ ] Sin clichés de la lista de `redaccion-e-idioma.md` y sin guiones largos (—).
- [ ] Ortografía y tildes revisadas.
- [ ] Largo dentro del límite.
- [ ] `<title>` con el nombre de archivo correcto.
- [ ] El bloque de estilos del template no cambió, salvo las variables que la persona pidió cambiar.
- [ ] Sin comentarios de instrucciones en el archivo final.
