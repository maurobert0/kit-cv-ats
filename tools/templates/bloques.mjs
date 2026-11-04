// Utilidades para leer y reemplazar los bloques de contenido entre marcadores.

export const MARCADORES = [
  'encabezado',
  'resumen',
  'habilidades',
  'experiencia',
  'educacion',
  'certificaciones',
  'proyectos',
  'idiomas',
];

const patronBloque = (nombre) =>
  new RegExp(`<!-- INICIO:${nombre} -->[\\s\\S]*?<!-- FIN:${nombre} -->`);

// Devuelve los marcadores INICIO y FIN en el orden en que aparecen en el archivo.
export function listarMarcadores(html) {
  return [...html.matchAll(/<!-- (INICIO|FIN):([a-z]+) -->/g)].map((m) => `${m[1]}:${m[2]}`);
}

// Devuelve un objeto { nombre: bloqueCompleto } con cada bloque, marcadores incluidos.
export function extraerBloques(html) {
  const bloques = {};
  for (const nombre of MARCADORES) {
    const m = html.match(patronBloque(nombre));
    if (m) bloques[nombre] = m[0];
  }
  return bloques;
}

// Reemplaza en `destino` cada bloque presente en `origen`.
// Falla si el destino no tiene algún bloque que el origen sí tiene.
export function reemplazarBloques(destino, origen) {
  const bloques = extraerBloques(origen);
  let salida = destino;
  for (const [nombre, bloque] of Object.entries(bloques)) {
    if (!patronBloque(nombre).test(salida)) {
      throw new Error(`El destino no tiene el bloque ${nombre}`);
    }
    salida = salida.replace(patronBloque(nombre), () => bloque);
  }
  return salida;
}
