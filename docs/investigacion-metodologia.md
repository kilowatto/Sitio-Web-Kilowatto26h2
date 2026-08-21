# Metodología de producción — Columnas e Investigaciones de Esteban Rey

Este documento captura las instrucciones que Esteban dio el 2026-08-21 sobre
cómo debe producirse cada pieza de contenido de "A Fondo con Kilowatto" y de
"Columnas" — texto original de Esteban preservado casi íntegro abajo, más
notas de cómo se traduce a este repo/entorno (que no tiene "skills"
instalables como Claude Desktop/Projects; aquí el equivalente es un
**Workflow** — ver "Cómo se ejecuta esto en este entorno" al final).

**Las 24 preguntas de la sesión 2026-08-21 ya se respondieron** — este
documento incluye las decisiones finales inline, marcadas **✅ DECIDIDO**.
La decisión más grande: esto **reemplaza** lo acordado el 2026-08-20 en
`docs/investigaciones-spec.md` en cuanto a quién escribe — ver punto 0.5.

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

## 0.5 Quién escribe (✅ DECIDIDO, reemplaza el acuerdo del 2026-08-20)

**Claude investiga y escribe de punta a punta**, no solo publica/formatea
como se dijo el 20 de agosto. Reglas de operación:

- Esteban siempre da el tema/ángulo — Claude nunca elige de qué hablar.
- Nada se publica sin que Esteban lo apruebe primero: la pieza se genera
  completa (HTML, formato, gráficas, todo) y aterriza en `/admin` con
  estado `pending_approval`, exactamente como columnas — Esteban la revisa
  ahí (o en la página de preview) y aprueba o rechaza con motivo.
- Rechazar SIEMPRE incluye una razón/feedback, igual que columnas, para que
  el proceso aprenda.
- El despliegue de 8-10 agentes en paralelo **requiere activación explícita
  cada vez** — Esteban dice algo como "investiga X con agentes" o tiene
  "ultracode" activo en la sesión. Sin ese opt-in, Claude no dispara el
  Workflow completo (evita gastar un proceso grande por accidente).
- Antes de arrancar cualquier investigación, Claude SIEMPRE pregunta primero
  (punto 0) si es ambiguo — nunca asume en silencio, ni siquiera para
  ahorrar una ronda de preguntas.
- Tema libre, en texto plano — no hace falta registrarlo en la tabla
  `brand_topics` (esa es para los posts automáticos de Larry, un flujo
  separado).
- La columna corta (950 palabras) derivada de una investigación se pide
  aparte, cuando de verdad se vaya a usar — no se genera automáticamente
  junto con cada investigación.
- **Nuevo requisito:** cada investigación publicada también genera un lote
  de **24 a 48 posts de redes sociales** (para Larry/X/LinkedIn) sacando
  datos e ideas puntuales del propio texto, pensados para repartirse a lo
  largo de más de un mes — cada uno con liga de vuelta a "leer más" en la
  página de la investigación en kilowatto.com.

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
- Mínimo 50 fuentes consultadas antes de escribir. **✅ DECIDIDO:** si un
  tema de nicho genuinamente no llega a 50 fuentes reales, Claude nunca
  rellena con fuentes débiles — avisa y pide autorización para entregar con
  menos, y señala que pocas fuentes reales puede ser en sí misma una señal
  de que el tema no es confiable para el tratamiento de investigación larga
  (quizá deba ser columna en su lugar).
- Si es continuación explícita de una columna anterior, reutilizar esa
  investigación previa como base y solo ampliar lo nuevo. **✅ DECIDIDO:**
  Esteban siempre lo dice explícitamente al pedir el tema — Claude no
  intenta detectar la conexión por similitud.
- **✅ DECIDIDO (conteo de palabras):** si el borrador se sale del rango
  (950 columna / 4,000-5,000 investigación), Claude prioriza calidad sobre
  el número exacto y avisa explícitamente que se salió del rango, en vez de
  recortar agresivamente solo para cumplir la cifra.

## 4. Fact-check (exhaustivo, siempre)

- Verificar cada afirmación contra fuente primaria.
- Buscar activamente contradicciones/desmentidos/refutaciones — no basta con
  confirmar, hay que intentar tumbar el dato.
- Marcador visual por dato: 🟢 confirmado por fuente primaria (o corroborado
  por múltiples fuentes independientes) / 🟡 confirmado por una sola fuente
  secundaria confiable / 🔴 sin verificación sólida o en disputa activa —
  **✅ DECIDIDO: estos criterios ya coinciden exactamente con lo que dice
  `/a-fondo/metodologia`, no hay que ajustar nada.**
- **✅ DECIDIDO: un dato que queda en 🔴 se descarta, nunca entra al cuerpo
  del texto** — mismo criterio que se aplicó ya con el rumor sin corroborar
  de Kape/Mossad en la pieza de VPN (se investigó y se descartó
  explícitamente, mencionándolo en la metodología de esa pieza). El rojo es
  una categoría de proceso interno, no algo que el lector final vea citado.
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

**✅ DECIDIDO (imágenes IA):** se permiten imágenes de Gemini/"nano banana"
en ambos lados — la página viva de kilowatto.com/a-fondo sigue llevando
portada + ilustraciones por sección como ya está construido, y también se
permiten en estos 3 archivos de entrega. La regla original de "sin IA" del
prompt de Esteban queda revocada. Si por algún motivo no hay imagen
disponible para un archivo, el fallback es tipografía limpia sin marcador
de imagen roto — nunca un placeholder visible.

**Estilo visual fijo:** acento naranja `#ff5f14` y líneas/acentos de
kilowatto.com, tipografía y paleta idénticas siempre (sin modo oscuro/claro
alterno ni variantes).

**✅ DECIDIDO (estilo del HTML standalone):** el HTML autocontenido replica
el layout real de la página de kilowatto.com (mismos componentes/CSS que ya
existen), no un diseño standalone aparte tipo el de referencia — un solo
sistema visual que mantener.

**Nombres de archivo:** `AAAA-MM-DD-slug-del-tema.ext`, con la **fecha de
publicación** (no la fecha en que se generó el documento), ej.
`2026-08-15-fable-segunda-parte.pdf/.md/.html`.

**✅ DECIDIDO (cuándo generarlos):** estos 3 archivos **solo se generan
cuando la pieza NO se publica en kilowatto.com/a-fondo** (por ejemplo, para
enviarla a un medio externo). Una pieza que sí vive en el sitio no necesita
export aparte — la página viva ES la entrega. La generación real de PDF
queda como trabajo pendiente de construir (no hay librería de PDF en este
Worker todavía) — se construye cuando haya una pieza real que lo necesite,
no antes.

**✅ DECIDIDO (cómo se entregan):** ambas — Claude los entrega directo en el
chat cuando termina una pieza (vía `SendUserFile`), y además se agrega un
botón de exportar en `/admin/a-fondo` para descargarlos cuando se necesite
después sin tener que pedírselo a Claude en el chat.

**✅ DECIDIDO (dónde va el checklist):** solo en el chat, antes de entregar
— es control de calidad interno entre Esteban y Claude, no contenido para
el lector final dentro del documento publicado.

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

## 13 tipos de gráfica (✅ DECIDIDO: construir todos desde ya)

Radar (obligatorio, 5+ ejes), barra (simple/agrupada), cronología, tarjetas
de comparación, **tabla de datos** (cuenta como uno de los 6 tipos mínimo,
no aparte), dona/pie, línea de tiempo continua, mapa de calor, dispersión,
embudo, **brecha/"dumbbell"** (dos puntos conectados — ideal para "lo que
prometen vs. lo que hacen"), medidor/gauge, treemap jerárquico.

Ya construidos antes de esta sesión: radar, barra, cronología, tarjetas.
Construidos en esta sesión (2026-08-21): tabla, dona, línea, mapa de calor,
dispersión, embudo, brecha, medidor, treemap — ver
`src/components/charts/`.

**Mínimo 6 tipos distintos por investigación** (no 6 gráficas del mismo
tipo), más radar obligatorio. Integradas en el cuerpo del texto (nunca en
un anexo), y el texto debe mencionar "Gráfica X" explícitamente antes de
cada una.

## Página pública de metodología (✅ DECIDIDO)

`/a-fondo/metodologia` se actualiza para describir el proceso real (8-10
agentes por ángulo, 50+ fuentes, verificación adversarial que busca
refutar cada dato) en vez de una versión genérica — mayor credibilidad
ante el lector.

## Cómo se ejecuta esto en este entorno

Este repo no tiene "skills" instalables — el equivalente es un **Workflow**
(`Workflow` tool), guardado en `.claude/workflows/` o como script con
`scriptPath` reutilizable. Producir una investigación completa con 8-10
agentes de investigación + verificación adversarial + redacción es un uso
legítimo de esa herramienta, pero **requiere que Esteban lo active
explícitamente cada vez** (decir "investiga X con agentes"/"usa un workflow
para X", o tener "ultracode" activo en la sesión) — no se dispara solo
porque este documento exista. Sin ese opt-in, Claude puede investigar con
agentes normales (`Agent` tool / forks), más lento pero sin la orquestación
determinista de fases.

## Flujo de aprobación en /admin (✅ DECIDIDO)

Nueva página `/admin/a-fondo` (análoga a `/admin/columnas`): lista de
investigaciones en `pending_approval` con vista previa completa (HTML,
gráficas, tablas, todo), botones aprobar/rechazar. Rechazar siempre pide
una razón/feedback, igual que columnas, para que el proceso aprenda.

## Posts de redes ligados a cada investigación (✅ DECIDIDO, nuevo requisito)

Cada investigación publicada genera un lote de **24 a 48 posts** para
redes (Larry/X/LinkedIn), con datos e ideas puntuales sacados del propio
texto, pensados para repartirse a lo largo de más de un mes — cada uno con
liga de "leer más" a la página de la investigación en kilowatto.com.
Pendiente de construir: tabla/mecanismo para guardar ese lote programado y
que el sistema de posteo automático de Larry los vaya sacando en el tiempo
en vez de todos de golpe.
