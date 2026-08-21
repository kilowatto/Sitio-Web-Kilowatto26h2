# Metodología de producción — Columnas e Investigaciones de Esteban Rey

Este documento captura las instrucciones que Esteban dio el 2026-08-21 sobre
cómo debe producirse cada pieza de contenido de "A Fondo con Kilowatto" y de
"Columnas" — texto original de Esteban preservado casi íntegro abajo, más
notas de cómo se traduce a este repo/entorno (que no tiene "skills"
instalables como Claude Desktop/Projects; aquí el equivalente es un
**Workflow** — ver "Cómo se ejecuta esto en este entorno" al final).

**Hay tensiones reales entre esto y lo decidido el 2026-08-20** (ver
`docs/investigaciones-spec.md`) — señaladas inline con **⚠️ CONFLICTO** — que
se resuelven con las 24 preguntas de la sesión del 2026-08-21 (pendiente
completar este documento con las respuestas).

---

## Los 7 "skills" → mapeados a fases/agentes de un Workflow

En Claude Desktop/Projects, un "skill" es un módulo de instrucciones
instalable. En este repo (Claude Code + herramienta `Workflow`), el
equivalente funcional es una **fase de un script de Workflow**, cada una
ejecutada por uno o más agentes:

| # | Skill (nombre original) | Fase / agente en este entorno |
|---|---|---|
| 1 | `alcance-interactivo-kilowatto` | Preguntas interactivas (`AskUserQuestion`) antes de investigar — el propio Claude en el hilo principal, no un sub-agente. |
| 2 | `investigacion-agentes-kilowatto` | Fase "Investigar": 8-10 `agent()` en paralelo (`parallel()`), uno por ángulo temático. |
| 3 | `fact-check-exhaustivo-kilowatto` | Fase "Verificar": agentes adversariales que intentan refutar cada dato antes de asignarle 🟢🟡🔴. |
| 4 | `voz-columna-kilowatto` | Fase "Redactar": un agente que escribe el cuerpo final en la voz de Esteban, usando `buildVoiceContext()`. |
| 5 | `radar-chart-kilowatto` | Parte de la fase "Gráficas": decide y justifica las 5+ dimensiones del radar. |
| 6 | `formato-tres-archivos-kilowatto` | Fase "Ensamblar": genera PDF + MD + HTML autocontenido. |
| 7 | `checklist-firma-kilowatto` | Fase final: checklist de cumplimiento visible antes de entregar. |

## 0. Arranque de cada conversación (obligatorio)

Si el usuario no especifica **Investigación** (4,000-5,000 palabras) o
**Columna** (950 palabras), Claude debe preguntarlo interactivamente antes de
investigar o escribir nada — nunca asumir en silencio. Preguntas mínimas:

1. ¿Investigación larga o columna de 950 palabras?
2. Tema y ángulo.
3. ¿Es continuación explícita de una columna anterior? (si sí, reutilizar esa
   investigación como base).

## 1. Voz y estilo

- Primera persona, tono de director de tecnología/CEO reflexionando sobre su
  propia experiencia.
- Abre con anécdota o dato concreto, nunca con generalidades.
- Cifras duras y específicas ("$845 dólares en 48 horas").
- Subtítulos temáticos como gancho de sección.
- Explica términos técnicos brevemente, sin condescendencia.
- Mezcla crítica de negocio con detalle técnico real.
- Cierra siempre invitando al lector a opinar con una pregunta directa.
- Español (es-MX), siempre, sin excepción.

## 2. Tipos de documento

**Investigación (4,000-5,000 palabras):**
- Dos variantes posibles (profunda+contraparte, o fondo/contexto+actualidad) —
  Claude decide cuál aplica caso por caso y explica brevemente por qué.
- Resumen ejecutivo de 100-150 palabras al inicio.
- Sección de metodología al final (qué se buscó, cuántas fuentes, cuántos
  agentes, criterios de fact-check).
- Sirve de base para derivar la columna corta.

**Columna (950 palabras):**
- Se deriva de la investigación larga cuando aplica.
- Sin resumen ejecutivo, sin metodología.
- Formato idéntico sin importar el medio de destino — el ajuste por medio lo
  hace Esteban después, no Claude.

Fuentes y ligas de fact-check nunca cuentan para el conteo de palabras; van
siempre al final.

## 3. Proceso de investigación (siempre antes de escribir)

- 8-10 agentes investigadores en paralelo.
- Repartidos por ángulo temático: mínimo a favor / en contra / neutral /
  técnico, escalando agentes adicionales dentro de cada ángulo si el tema lo
  requiere.
- Investigar tanto la fuente/empresa protagonista como estudios, reportajes
  de medios reconocidos, think tanks y ONGs.
- Mínimo 50 fuentes consultadas antes de escribir.
- Si es continuación explícita de una columna anterior, reutilizar esa
  investigación previa como base y solo ampliar lo nuevo.

## 4. Fact-check (exhaustivo, siempre)

- Verificar cada afirmación contra fuente primaria.
- Buscar activamente contradicciones/desmentidos/refutaciones — no basta con
  confirmar, hay que intentar tumbar el dato.
- Marcador visual por dato: 🟢 confirmado por fuente primaria / 🟡 confirmado
  por fuente secundaria o parcialmente contradicho / 🔴 sin verificación
  sólida o en disputa activa.
- Citación combinada: hipervínculo directo sobre el dato **y** referencia
  estilo académico (autor, año), ambos apuntando a la lista de fuentes final.
- Lista final de fuentes: simple, en orden de aparición, sin categorizar.

## 5. Estructura fija del documento

1. Encabezado: fecha + firma + tiempo estimado de lectura.
2. Título + subtítulo-gancho obligatorio.
3. (Solo investigación) Resumen ejecutivo, 100-150 palabras.
4. Cuerpo con subtítulos temáticos.
5. Gráfica de radar (sección 6).
6. Cierre con pregunta directa al lector.
7. Firma estándar (sección 7).
8. (Solo investigación) Sección de metodología.
9. Lista de fuentes (no cuenta en el conteo de palabras).

## 6. Gráficas

- Siempre intentar al menos una gráfica de radar de 5+ dimensiones.
- Dimensiones variables según el tema, decididas por el agente investigador,
  justificadas brevemente.
- Interactivas y animadas en la versión HTML.
- **Nuevo (2026-08-21): mínimo 6 tipos diferentes de gráfica por
  investigación** (no 6 gráficas del mismo tipo — 6 tipos distintos), más
  radar obligatorio. Ver la lista de 12+ tipos propuestos más abajo.
- **Nuevo: siempre debe haber al menos una tabla** en la presentación de la
  investigación (además de las gráficas, no en vez de).
- Las gráficas deben ir integradas en el cuerpo del texto (no en un anexo al
  final), y el texto debe mencionar explícitamente "Gráfica X" para dirigir
  al lector a mirarla en el momento correcto.

## 7. Firma estándar (siempre igual)

```
Esteban Rey
X: @Kilowatto — https://x.com/kilowatto
LinkedIn: https://www.linkedin.com/in/kilowatto
Wikidata: https://www.wikidata.org/wiki/Q140672978
```

No existe versión corta de LinkedIn — siempre la URL completa.

## 8. Formato de entrega — tres archivos

Siempre tres archivos por pieza:

1. **PDF** — formato final, estilo visual de kilowatto.com.
2. **Markdown (.md)** — respaldo editable en texto plano.
3. **HTML autocontenido** — imágenes/JS/CSS embebidos, interactivo (gráficas
   animadas incl. radar, parallax, detalles del sitio), sin romper el estilo
   visual de kilowatto.com.

**⚠️ CONFLICTO con lo ya construido:** esta sección dice "sin imagen de
portada generada por IA — solo tipografía y gráficas" para estos 3 archivos.
El 2026-08-21 ya generamos portada + 6 ilustraciones con Gemini para la
pieza de VPN en la página viva de kilowatto.com/a-fondo. Falta decidir si
esa regla de "sin IA" aplica solo a los 3 archivos de entrega (documento
"archivable"/para medios externos) mientras la página viva sí puede llevar
imágenes de Gemini, o si debe quitarse de la página viva también para que
todo coincida. Pendiente de resolver — ver preguntas de la ronda 2.

**Estilo visual fijo:** acento naranja `#ff5f14` y líneas/acentos de
kilowatto.com, tipografía y paleta idénticas siempre (sin modo oscuro/claro
alterno ni variantes).

**Nombres de archivo:** `AAAA-MM-DD-slug-del-tema.ext`, ej.
`2026-08-15-fable-segunda-parte.pdf/.md/.html`.

**⚠️ Nota:** no está resuelto todavía si estos 3 archivos se generan siempre
además de publicar en kilowatto.com/a-fondo, o solo para piezas que no se
publican ahí (ej. para enviar a un medio externo) — ver preguntas de la
ronda 4.

## 9. Checklist final antes de entregar (siempre visible)

- [ ] Conteo de palabras exacto (950 columna / 4,000-5,000 investigación, sin
  contar fuentes)
- [ ] Mínimo 50 fuentes consultadas y listadas
- [ ] Fact-check exhaustivo con marcadores 🟢🟡🔴 aplicados
- [ ] Firma completa (nombre, X, LinkedIn, Wikidata)
- [ ] Gráfica de radar de 5+ dimensiones incluida y justificada
- [ ] Mínimo 6 tipos diferentes de gráfica + al menos 1 tabla
- [ ] Subtítulo-gancho y cierre con pregunta al lector presentes
- [ ] Los 3 formatos generados (PDF, MD, HTML) y nombrados con fecha+slug
- [ ] (Si aplica) Resumen ejecutivo y metodología presentes solo en
  investigación larga

## 12+ tipos de gráfica propuestos (disponibles para elegir 6+ por pieza)

Ver el mensaje de Claude del 2026-08-21 en la conversación para la lista
completa con descripciones — resumen: radar (obligatorio), barra
simple/agrupada, cronología, tarjetas de comparación, tabla de datos, dona,
líneas de tiempo continuo, mapa de calor, dispersión, embudo, brecha
("dumbbell": prometido vs. real — muy útil para el ángulo marketing vs.
realidad), medidor/gauge, treemap jerárquico.

Ya construidos como componentes reales: radar, barra, cronología, tarjetas.
Pendientes de construir según cuáles se elijan en las 24 preguntas.

## Cómo se ejecuta esto en este entorno

Este repo no tiene "skills" instalables — el equivalente es un **Workflow**
(`Workflow` tool). Producir una investigación completa con 8-10 agentes de
investigación + verificación adversarial + redacción es un uso legítimo de
esa herramienta, pero **requiere que Esteban lo active explícitamente cada
vez** (decir "usa un workflow para investigar X", o tener "ultracode" activo
en la sesión) — no se dispara solo porque este documento exista. Sin ese
opt-in, Claude puede hacer la investigación con agentes normales (`Agent`
tool / forks), más lento pero sin la orquestación determinista de fases.

## Pendiente de resolver (24 preguntas, sesión 2026-08-21)

Ver la conversación para las preguntas y respuestas — actualizar este
documento con las decisiones finales antes de producir la primera pieza con
este flujo.
