#!/usr/bin/env python3
"""
Verificación de keywords y calidad de un CV en HTML contra una oferta.
Opcional: el skill funciona sin este script. Úsalo solo si puedes ejecutar Python.

Uso:
  python3 keyword_check.py --cv CV.html --keywords keywords.txt [--titulo "Product Designer"] [--max-repeticiones 5]

Formato de keywords.txt (una keyword por línea):
  - Sinónimos en la misma línea separados por "|". Cualquiera cuenta como coincidencia.
  - "!" al inicio marca una keyword excluyente (requisito obligatorio de la oferta).
  - Las líneas que empiezan con "#" se ignoran.

Ejemplo:
  !Figma
  Design System|design systems|sistema de diseño
  # habilidades blandas
  stakeholder management

Incluye solo las keywords que la persona tiene (con evidencia en su perfil).
Las que no tiene se reportan aparte, no se agregan al CV.

Solo usa la biblioteca estándar de Python 3.
"""
import argparse
import html
import re
import sys
import unicodedata

CLICHES = [
    "proactivo", "proactiva", "apasionado", "apasionada", "orientado a resultados",
    "orientada a resultados", "persona resolutiva", "perfil multitarea", "dinamico", "dinamica",
    "ganas de aprender", "proactive", "passionate", "results-driven", "results driven",
    "team player", "hard-working", "hard working", "go-getter", "synergy",
    "think outside the box",
]

DATOS_PROHIBIDOS = [
    "fecha de nacimiento", "date of birth", "estado civil", "marital status",
    "cedula", "dni", "pasaporte", "passport number", "referencias a solicitud",
    "references available", "referencias:", "references:",
]


def texto_plano(crudo: str) -> str:
    crudo = re.sub(r"<!--.*?-->", " ", crudo, flags=re.S)
    crudo = re.sub(r"<(style|script|head)[^>]*>.*?</\1>", " ", crudo, flags=re.S | re.I)
    crudo = re.sub(r"<[^>]+>", " ", crudo)
    return re.sub(r"\s+", " ", html.unescape(crudo)).strip()


def normalizar(texto: str) -> str:
    texto = unicodedata.normalize("NFKD", texto)
    texto = "".join(c for c in texto if not unicodedata.combining(c))
    return texto.lower()


def contar(termino: str, texto_n: str) -> int:
    t = normalizar(termino.strip())
    if not t:
        return 0
    patron = r"(?<![a-z0-9])" + re.escape(t).replace(r"\ ", r"[\s\-/]+") + r"(?![a-z0-9])"
    return len(re.findall(patron, texto_n))


def main() -> None:
    ap = argparse.ArgumentParser(description="Verifica keywords y calidad de un CV en HTML.")
    ap.add_argument("--cv", required=True, help="Ruta al CV en HTML")
    ap.add_argument("--keywords", required=True, help="Ruta al archivo de keywords")
    ap.add_argument("--titulo", help="Título exacto del puesto en la oferta")
    ap.add_argument("--max-repeticiones", type=int, default=5)
    a = ap.parse_args()

    with open(a.cv, encoding="utf-8") as f:
        crudo = f.read()
    texto = texto_plano(crudo)
    texto_n = normalizar(texto)

    filas = []
    with open(a.keywords, encoding="utf-8") as f:
        for linea in f:
            linea = linea.strip()
            if not linea or linea.startswith("#"):
                continue
            excluyente = linea.startswith("!")
            sinonimos = [s.strip() for s in linea.lstrip("!").split("|") if s.strip()]
            if not sinonimos:
                continue
            total = sum(contar(s, texto_n) for s in sinonimos)
            filas.append((sinonimos[0], excluyente, total))

    if not filas:
        print("El archivo de keywords está vacío.")
        sys.exit(1)

    print(f"{'KEYWORD':42} {'EXCL':5} {'VECES':>5}")
    print("-" * 62)
    for kw, exc, n in sorted(filas, key=lambda r: (r[2] > 0, not r[1], r[0].lower())):
        aviso = "FALTA" if n == 0 else ("¿RELLENO?" if n > a.max_repeticiones else "")
        print(f"{kw[:42]:42} {'sí' if exc else '':5} {n:>5}  {aviso}")

    encontradas = [r for r in filas if r[2] > 0]
    excluyentes = [r for r in filas if r[1]]
    exc_ok = [r for r in excluyentes if r[2] > 0]
    print(f"\nCobertura: {len(encontradas)}/{len(filas)} = {100 * len(encontradas) / len(filas):.0f}%")
    if excluyentes:
        print(f"Excluyentes cubiertas: {len(exc_ok)}/{len(excluyentes)}")
    faltan = [r[0] for r in filas if r[2] == 0]
    if faltan:
        print("Faltan: " + ", ".join(faltan))

    print("\nControles de calidad:")
    palabras = len(re.findall(r"\b\w+\b", texto))
    print(f"- Palabras: {palabras} (aprox. {palabras / 525:.1f} páginas)")
    problemas = []
    if a.titulo and contar(a.titulo, texto_n) == 0:
        problemas.append(f"El título exacto de la oferta ('{a.titulo}') no aparece en el CV.")
    if "—" in texto:
        problemas.append("Hay guiones largos (—). Reemplázalos por coma, dos puntos o paréntesis.")
    for c in CLICHES:
        if contar(c, texto_n):
            problemas.append(f"Cliché detectado: '{c}'.")
    for d in DATOS_PROHIBIDOS:
        if normalizar(d) in texto_n:
            problemas.append(f"Dato que no va en un CV: '{d}'.")
    if re.search(r"(?<![a-z0-9])(19|20)\d{2}\s*-\s*(19|20)\d{2}(?![a-z0-9])", texto_n):
        problemas.append("Hay rangos de fechas solo con años. Usa mes y año.")
    if "INSTRUCCIONES PARA EL AGENTE" in crudo:
        problemas.append("Quedó el comentario de instrucciones del template en el archivo final.")
    if problemas:
        for p in problemas:
            print("- CORREGIR: " + p)
    else:
        print("- Sin problemas detectados.")


if __name__ == "__main__":
    main()
