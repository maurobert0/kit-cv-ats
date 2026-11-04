#!/usr/bin/env python3
"""Genera los prompts planos de prompts/ a partir de los skills.
Uso: python3 tools/generar_prompts.py  (desde la raíz del repo)
No edites prompts/ a mano: edita los skills y vuelve a correr esto."""
import re, pathlib
R = pathlib.Path(__file__).resolve().parent.parent
S = R / "skills"

def cuerpo(p):
    t = (S / p).read_text(encoding="utf-8")
    return re.sub(r"^---\n.*?\n---\n", "", t, flags=re.S).strip()

def bajar(t, n=1):
    return re.sub(r"^(#+)", lambda m: "#" * min(6, len(m.group(1)) + n), t, flags=re.M)

COMUN = [
    ("con el skill `generador-cv-ats`", "con el prompt del generador de CVs, `02-generador-cv.md`"),
    ("el skill `generador-cv-ats`", "el prompt del generador de CVs"),
    ("con el skill `perfil-profesional-ats`", "con el prompt de perfil profesional, `01-perfil-profesional.md`"),
    ("el skill `perfil-profesional-ats`", "el prompt de perfil profesional"),
    ("Si no tiene ese skill, le indicas que lo descargue del mismo lugar donde consiguió este.", "Si no lo tiene, le indicas que lo copie del mismo lugar donde consiguió este."),
    ("Este skill no genera CVs.", "Este prompt no genera CVs."),
    ("Este skill no modifica el perfil.", "Este prompt no modifica el perfil."),
    ("que entrega el skill", "que entregas"),
    ("El skill `generador-cv-ats` lee este formato", "El generador de CVs lee este formato"),
]

def aplicar(t, extra):
    for a, b in COMUN + extra:
        t = t.replace(a, b)
    return t

ENC = """# {titulo}

> **Cómo usarlo.** Copia todo desde la línea "INICIO DEL PROMPT" hasta el final y pégalo como primer mensaje en una conversación nueva de cualquier IA (ChatGPT, Gemini, Claude, Copilot, DeepSeek, etc.). Si el chat no te deja pegar un texto tan largo, adjunta este archivo y escribe "Sigue las instrucciones de este archivo". {extra}
>
> Parte del Kit CV ATS de Mauro Berteri (mauroberteri.com/recursos/kit-cv-ats). Licencia CC BY 4.0. Este archivo se genera automáticamente a partir de los skills del repositorio.

---

INICIO DEL PROMPT

"""

# 1. Perfil
p = cuerpo("perfil-profesional-ats/SKILL.md")
p = aplicar(p, [
    ("con la estructura de `references/plantilla-perfil.md`", "con la estructura de la sección \"Plantilla del perfil\" de este prompt"),
    ("Sigue el orden de `references/guion-entrevista.md`.", "Sigue el orden de la sección \"Guion de entrevista\" de este prompt."),
    ("de `references/preguntas-por-rol.md`", "de la sección \"Preguntas por área\" de este prompt"),
])
anexos = [("Guion de entrevista", "perfil-profesional-ats/references/guion-entrevista.md"),
          ("Preguntas por área", "perfil-profesional-ats/references/preguntas-por-rol.md"),
          ("Plantilla del perfil", "perfil-profesional-ats/references/plantilla-perfil.md")]
out = ENC.format(titulo="Prompt 1. Perfil profesional", extra="Cuando termines, guarda el archivo `perfil-profesional.md` que te entrega. Lo vas a necesitar para el prompt 2.") + p
for titulo, f in anexos:
    c = re.sub(r"^# .*\n+", "", cuerpo(f), count=1)
    out += f"\n\n---\n\n# {titulo}\n\n" + bajar(aplicar(c, []), 0 if c.lstrip().startswith("##") else 0)
out += "\n\n---\n\nFIN DEL PROMPT. Empieza ahora con la bienvenida.\n"
(R / "prompts/01-perfil-profesional.md").write_text(out, encoding="utf-8")

# 2. Generador
g = cuerpo("generador-cv-ats/SKILL.md")
g = re.sub(r"## Archivos de este skill.*?(?=\n## Paso 0)", """## Material de este prompt

Debajo de estas instrucciones tienes cinco secciones: "Análisis de la oferta", "Reglas ATS", "Redacción e idioma", "Template clasico" y "Otros estilos". Léelas completas antes de generar el primer CV de la conversación.

""", g, flags=re.S)
g = aplicar(g, [
    ("según `references/analisis-oferta.md`", "según la sección \"Análisis de la oferta\""),
    ("(ver `redaccion-e-idioma.md`)", "(ver la sección \"Redacción e idioma\")"),
    ("siguiendo `reglas-ats.md` y `redaccion-e-idioma.md`", "siguiendo las secciones \"Reglas ATS\" y \"Redacción e idioma\""),
    ("Si puedes ejecutar Python, usa `scripts/keyword_check.py`. Si no, haz la verificación a mano con la misma lógica. Después pasa el checklist de `reglas-ats.md`.", "Revisa a mano la cobertura de keywords (cada keyword que la persona tiene aparece al menos una vez en contexto y ninguna más de 5 veces) y pasa el checklist de la sección \"Reglas ATS\"."),
    ("(ver `analisis-oferta.md`)", "(ver la sección \"Análisis de la oferta\")"),
    ("Si la persona no eligió estilo y es su primer CV de la conversación, ofrécele los seis con una línea de descripción cada uno (sacadas de `templates/LEEME.md`) y usa `clasico` si no tiene preferencia. Después usa siempre el mismo salvo que pida cambiarlo.",
     "Si la persona no eligió estilo y es su primer CV de la conversación, ofrécele los de la sección \"Otros estilos\" con una línea cada uno y usa el template clasico si no tiene preferencia. Después usa siempre el mismo salvo que pida cambiarlo. Si te pega el HTML de uno de esos estilos, úsalo en lugar del template clasico."),
])
anexos = [("Análisis de la oferta", "generador-cv-ats/references/analisis-oferta.md"),
          ("Reglas ATS", "generador-cv-ats/references/reglas-ats.md"),
          ("Redacción e idioma", "generador-cv-ats/references/redaccion-e-idioma.md")]
out = ENC.format(titulo="Prompt 2. Generador de CVs", extra="Después pega tu archivo `perfil-profesional.md` (o adjúntalo) y, si tienes una, el texto completo de la oferta.") + g
for titulo, f in anexos:
    c = re.sub(r"^# .*\n+", "", cuerpo(f), count=1)
    c = c.replace("(ver `redaccion-e-idioma.md`)", "(ver la sección \"Redacción e idioma\")").replace("de `redaccion-e-idioma.md`", "de la sección \"Redacción e idioma\"")
    out += f"\n\n---\n\n# {titulo}\n\n" + aplicar(c, [])
tpl = (S / "generador-cv-ats/templates/clasico.html").read_text(encoding="utf-8")
out += "\n\n---\n\n# Template clasico\n\nCopia este HTML completo para cada CV y reemplaza solo el contenido entre marcadores, siguiendo el comentario de instrucciones que trae adentro.\n\n```html\n" + tpl.strip() + "\n```\n"
otros = [
    ("editorial", "Cálido y editorial, con papel crema, encabezado verde y nombre en serif."),
    ("grotesk", "Alto contraste, con encabezado negro, franja lima y secciones enmarcadas."),
    ("analitico", "Informe de datos, con papel marfil, nombre en serif liviana y titular resaltado en naranja."),
    ("suizo", "Blanco y negro, con el nombre y el titular en dos tonos y un cuadrado rojo junto a cada título."),
    ("cercano", "Amable y redondeado, con bloque verde bosque, nombre en menta y títulos en píldora."),
]
out += "\n---\n\n# Otros estilos\n\nSi la persona no eligió estilo, descríbele estas cinco opciones en una línea cada una y usa el template clasico si no tiene preferencia. Si pega el HTML de uno de estos templates, úsalo en lugar del template clasico.\n\n"
for nombre, desc in otros:
    url = f"https://raw.githubusercontent.com/maurobert0/kit-cv-ats/main/skills/generador-cv-ats/templates/{nombre}.html"
    out += f"- **{nombre}.** {desc} HTML: {url}\n"
out += "\n---\n\nFIN DEL PROMPT. Saluda en una línea y pide el perfil profesional y la oferta.\n"
(R / "prompts/02-generador-cv.md").write_text(out, encoding="utf-8")
print("ok")
