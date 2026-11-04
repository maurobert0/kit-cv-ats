# Templates disponibles

| Archivo | Estilo | Para quién |
|---|---|---|
| `clasico.html` | Sobrio, una columna, acento azul | Cualquier rol de IT. Es el template por defecto. |

## Contrato que cumplen todos los templates

Cualquier template nuevo tiene que respetar esto para que el skill lo pueda usar sin cambios:

1. Una sola columna, sin tablas, imágenes ni íconos con significado.
2. Las mismas secciones con los mismos marcadores: `INICIO:encabezado`, `INICIO:resumen`, `INICIO:habilidades`, `INICIO:experiencia`, `INICIO:educacion`, `INICIO:certificaciones`, `INICIO:proyectos`, `INICIO:idiomas`, cada uno con su `FIN:` correspondiente.
3. Las mismas clases de contenido (`.nombre`, `.titular`, `.contacto`, `.puesto`, `.puesto-encabezado`, `.cargo`, `.fechas`, `.empresa`, `.nota`, `.entrada`, `.entrada-encabezado`, `.entrada-titulo`, `.detalle`, `ul.compacta`). Así el contenido se puede pasar de un template a otro sin reescribirlo.
4. Variables personalizables solo en `:root`, comentadas como `PERSONALIZABLE`.
5. `<meta charset="UTF-8">`, comentario de instrucciones al inicio y contenido de ejemplo de una persona ficticia.
6. Al imprimir a PDF desde Chrome, el texto se puede seleccionar y copiar en el orden correcto.

## Cambiar de template

Si la persona quiere otro estilo para un CV ya generado, copia el contenido entre marcadores del CV actual dentro del nuevo template. No hace falta volver a redactar.
