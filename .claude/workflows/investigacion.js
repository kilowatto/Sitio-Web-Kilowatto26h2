export const meta = {
  name: 'investigacion',
  description: 'Produce una investigación completa de A Fondo con Kilowatto: 8-10 agentes de investigación en paralelo por ángulo, fact-check adversarial con corroboración cruzada, redacción en voz de Esteban, construcción de gráficas, y ensamblado del payload listo para insertar como pending_approval.',
  whenToUse: 'Cuando Esteban ya dio el tema/ángulo de una investigación larga (no columna) y autorizó explícitamente el despliegue de agentes ("investiga X con agentes" / "usa un workflow para X" / sesión con ultracode activo). Nunca se invoca sin ese opt-in explícito -- ver docs/investigacion-metodologia.md sección "0.5 Quién escribe".',
  phases: [
    { title: 'Investigar', detail: '8-10 agentes en paralelo, uno por ángulo temático, cada uno buscando fuentes reales' },
    { title: 'Verificar', detail: 'fact-check adversarial por ángulo, con la lista completa de hallazgos para detectar corroboración cruzada' },
    { title: 'Redactar', detail: 'un agente escribe el cuerpo completo en la voz de Esteban, decide dónde van las gráficas' },
    { title: 'Gráficas', detail: 'un agente por gráfica solicitada, construye el data_json exacto leyendo el componente real' },
    { title: 'Ensamblar', detail: 'un agente arma el payload y genera (sin ejecutar) el SQL de inserción para revisión humana' },
  ],
}

// args contract (pasado por quien invoca este Workflow desde el chat principal,
// después de que Esteban dio el tema y Claude decidió los ángulos -- ver
// docs/investigacion-metodologia.md):
//   {
//     slug: "string kebab-case, ej. 'vpns-marketing-vs-realidad'",
//     tema: "string -- el tema/ángulo que dio Esteban, en sus palabras",
//     angulo: "string -- qué variante aplica y por qué (profunda+contraparte / fondo+actualidad), decidido antes de invocar",
//     angles: ["string", ...] // 8-10 líneas de investigación por ángulo temático (a favor/en contra/neutral/técnico/mitos específicos)
//     wordCountMin: 4000, wordCountMax: 5000, // opcional, default investigación larga
//     minSources: 50, // opcional
//     forceProceed: false, // true = Esteban ya autorizó continuar con menos de minSources fuentes
//     continuacionDe: null, // slug de una investigación previa a ampliar, si aplica
//   }

const RESEARCH_SCHEMA = {
  type: 'object',
  properties: {
    angle: { type: 'string' },
    claims: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          url: { type: 'string' },
          label: { type: 'string' },
          sourceType: { type: 'string', enum: ['primary', 'secondary_reliable', 'secondary_other', 'opinion'] },
        },
        required: ['text', 'url', 'label', 'sourceType'],
      },
    },
    sourcesConsulted: { type: 'array', items: { type: 'string' } },
  },
  required: ['angle', 'claims', 'sourcesConsulted'],
}

const FACTCHECK_SCHEMA = {
  type: 'object',
  properties: {
    angle: { type: 'string' },
    verifiedClaims: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          url: { type: 'string' },
          label: { type: 'string' },
          confidence: { type: 'string', enum: ['green', 'yellow', 'red'] },
          note: { type: 'string' },
        },
        required: ['text', 'url', 'label', 'confidence'],
      },
    },
  },
  required: ['angle', 'verifiedClaims'],
}

const WRITER_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    subtitle: { type: 'string' },
    hook: { type: 'string' },
    summary: { type: 'string' },
    methodologyHtml: { type: 'string' },
    bodyHtml: { type: 'string' },
    citationsUsed: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          url: { type: 'string' },
          label: { type: 'string' },
          confidence: { type: 'string', enum: ['green', 'yellow'] },
        },
        required: ['url', 'label', 'confidence'],
      },
    },
    chartRequests: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          chartKey: { type: 'string' },
          isRadar: { type: 'boolean' },
          suggestedType: { type: 'string' },
          title: { type: 'string' },
          whatItShows: { type: 'string' },
        },
        required: ['chartKey', 'suggestedType', 'title', 'whatItShows'],
      },
    },
  },
  required: ['title', 'summary', 'bodyHtml', 'citationsUsed', 'chartRequests'],
}

const CHART_SCHEMA = {
  type: 'object',
  properties: {
    chartKey: { type: 'string' },
    chartType: {
      type: 'string',
      enum: ['bar', 'timeline', 'radar', 'cards', 'table', 'donut', 'line', 'heatmap', 'scatter', 'funnel', 'dumbbell', 'gauge', 'treemap'],
    },
    title: { type: 'string' },
    description: { type: 'string' },
    sourceNote: { type: 'string' },
    data: { type: 'object' },
  },
  required: ['chartKey', 'chartType', 'title', 'data'],
}

const ASSEMBLE_SCHEMA = {
  type: 'object',
  properties: {
    seedSqlPath: { type: 'string' },
    warnings: { type: 'array', items: { type: 'string' } },
    wordCount: { type: 'number' },
    sourceCount: { type: 'number' },
    chartTypeCount: { type: 'number' },
  },
  required: ['seedSqlPath', 'warnings'],
}

const wordCountMin = args?.wordCountMin ?? 4000
const wordCountMax = args?.wordCountMax ?? 5000
const minSources = args?.minSources ?? 50
const angles = args?.angles ?? []

log(`Arrancando investigación "${args.tema}" con ${angles.length} ángulos.`)

phase('Investigar')
const researchResults = (
  await parallel(
    angles.map((angle) => () =>
      agent(
        `Eres un investigador para una pieza de "A Fondo con Kilowatto" sobre: ${args.tema}\n` +
          `Tu ángulo específico es: ${angle}\n\n` +
          `Busca activamente en la web fuentes reales (WebSearch/WebFetch) que aporten datos concretos desde este ángulo. ` +
          `Prioriza: fuentes primarias (documentos oficiales, regulatorios, judiciales, estudios académicos), ` +
          `después medios reconocidos, think tanks y ONGs, después la fuente/empresa protagonista misma. ` +
          `Para cada afirmación que encuentres, registra el texto exacto del dato, la URL de la fuente, una etiqueta corta ` +
          `(estilo "Autor/Medio, Año") y el tipo de fuente. Reporta también TODAS las URLs que consultaste, ` +
          `aunque no hayan aportado un dato citable -- cuentan como "fuentes consultadas". ` +
          `Objetivo: al menos 5-8 fuentes reales solo desde este ángulo.`,
        { schema: RESEARCH_SCHEMA, phase: 'Investigar', label: `research:${angle.slice(0, 30)}` }
      )
    )
  )
).filter(Boolean)

const allClaimsForContext = researchResults.flatMap((r) => r.claims.map((c) => ({ ...c, angle: r.angle })))
const allSourcesConsulted = new Set([
  ...researchResults.flatMap((r) => r.sourcesConsulted ?? []),
  ...allClaimsForContext.map((c) => c.url),
])

log(`Investigación terminada: ${allSourcesConsulted.size} fuentes consultadas, ${allClaimsForContext.length} datos encontrados.`)

if (allSourcesConsulted.size < minSources && !args?.forceProceed) {
  log(`Menos de ${minSources} fuentes (${allSourcesConsulted.size}) y forceProceed no está activo -- deteniendo antes de escribir.`)
  return {
    status: 'insufficient_sources',
    sourcesConsulted: allSourcesConsulted.size,
    minSources,
    byAngle: researchResults.map((r) => ({ angle: r.angle, sourcesConsulted: (r.sourcesConsulted ?? []).length, claims: r.claims.length })),
  }
}

phase('Verificar')
const claimsSummaryForCrossCheck = allClaimsForContext
  .map((c, i) => `[${i}] (${c.angle}) "${c.text}" -- ${c.label} <${c.url}>`)
  .join('\n')

const factCheckResults = (
  await parallel(
    researchResults.map((r) => () =>
      agent(
        `Eres un verificador adversarial de datos para una pieza de "A Fondo con Kilowatto". Tu trabajo es intentar ` +
          `REFUTAR cada uno de los siguientes datos del ángulo "${r.angle}", no confirmarlos por default:\n\n` +
          r.claims.map((c, i) => `${i}. "${c.text}" -- ${c.label} <${c.url}> (tipo declarado: ${c.sourceType})`).join('\n') +
          `\n\nPara cada uno: busca activamente contraevidencia, desmentidos o refutaciones (WebSearch/WebFetch) antes de ` +
          `aceptarlo. Además, aquí está la lista COMPLETA de datos encontrados por todos los ángulos de esta investigación ` +
          `--úsala para detectar si un dato de tu lista está corroborado independientemente por otro ángulo (eso lo sube a verde ` +
          `aunque tu fuente individual sea secundaria):\n\n${claimsSummaryForCrossCheck}\n\n` +
          `Asigna a cada uno de TUS datos (los de tu ángulo, "${r.angle}") un color:\n` +
          `🟢 verde: fuente primaria, O corroborado independientemente por otra fuente (incluyendo un dato equivalente ` +
          `de otro ángulo en la lista completa).\n` +
          `🟡 amarillo: una sola fuente secundaria confiable, sin corroboración independiente encontrada.\n` +
          `🔴 rojo: no resistió la búsqueda de contraevidencia, está en disputa activa, o no alcanza el estándar -- explica por qué en "note".`,
        { schema: FACTCHECK_SCHEMA, phase: 'Verificar', label: `factcheck:${r.angle.slice(0, 30)}` }
      )
    )
  )
).filter(Boolean)

const verified = factCheckResults.flatMap((r) => r.verifiedClaims)
const usable = verified.filter((c) => c.confidence !== 'red')
const discarded = verified.filter((c) => c.confidence === 'red')

log(`Fact-check terminado: ${usable.length} datos utilizables (${verified.filter((c) => c.confidence === 'green').length} verde / ${verified.filter((c) => c.confidence === 'yellow').length} amarillo), ${discarded.length} descartados en rojo.`)

phase('Redactar')
const writerResult = await agent(
  `Escribe una investigación completa para "A Fondo con Kilowatto" sobre: ${args.tema}\n` +
    `Ángulo/variante de la pieza: ${args.angulo}\n\n` +
    `ANTES de escribir, lee estos archivos para calibrar voz, estructura y reglas exactas:\n` +
    `- docs/investigacion-metodologia.md (secciones 1, 2, 5, 6, 7 -- voz, estructura fija, gráficas, firma)\n` +
    `- src/lib/brand-voice.ts (busca "investigacionSamples" -- ejemplos reales de la voz de Esteban)\n\n` +
    `Datos verificados disponibles (usa SOLO estos, no inventes ni agregues datos que no estén en esta lista):\n` +
    usable.map((c, i) => `[${i}] "${c.text}" -- ${c.label} <${c.url}> (confianza: ${c.confidence})`).join('\n') +
    `\n\nReglas de salida obligatorias:\n` +
    `- Extensión objetivo ${wordCountMin}-${wordCountMax} palabras en bodyHtml (sin contar fuentes/metodología). Si el borrador ` +
    `se sale del rango, prioriza calidad sobre el número exacto pero avísalo en tu respuesta.\n` +
    `- Resumen ejecutivo de 100-150 palabras en "summary" (texto plano, sin HTML).\n` +
    `- "bodyHtml": HTML con <h2> por sección temática, <p> por párrafo. Cada vez que uses uno de los datos verificados, ` +
    `cita inline con exactamente este formato: <a class="cite cite--{confidence}" href="__CITE__{n}__" target="_blank" ` +
    `rel="noopener">{label}<span class="cite__flag" aria-hidden="true"></span></a> -- donde {confidence} es "green" o ` +
    `"yellow" y {n} es el índice (0-based, en orden de PRIMERA aparición en el texto) dentro del array "citationsUsed" que tú ` +
    `mismo devuelves (debe listar cada fuente citada exactamente una vez, en ese mismo orden de primera aparición).\n` +
    `- Termina el cuerpo narrativo con una pregunta directa al lector, y justo después este bloque de firma EXACTO, sin ` +
    `modificar nada:\n<p>Esteban Rey<br>X: <a href="https://x.com/kilowatto" target="_blank" rel="noopener">@Kilowatto</a><br>` +
    `LinkedIn: <a href="https://www.linkedin.com/in/kilowatto" target="_blank" rel="noopener">https://www.linkedin.com/in/kilowatto</a><br>` +
    `Wikidata: <a href="https://www.wikidata.org/wiki/Q140672978" target="_blank" rel="noopener">https://www.wikidata.org/wiki/Q140672978</a></p>\n` +
    `- "methodologyHtml": HTML corto (2-4 párrafos) explicando cuántas fuentes/ángulos/agentes se usaron en esta pieza ` +
    `específica, y si algún dato relevante fue descartado en rojo y por qué (sin nombrar "agentes" en tono técnico -- ` +
    `escríbelo como Esteban describiría su propio proceso de investigación).\n` +
    `- "chartRequests": decide dónde van las gráficas. SIEMPRE incluye exactamente una con isRadar:true, chartKey EXACTAMENTE ` +
    `"radar-comparativo", suggestedType "radar" (esta NO lleva placeholder en el texto, se renderiza aparte). Para las demás, ` +
    `pide al menos 6 gráficas de tipos DISTINTOS entre sí (bar/timeline/cards/table/donut/line/heatmap/scatter/funnel/` +
    `dumbbell/gauge/treemap) más al menos 1 de tipo "table" -- y por cada una, inserta en el bodyHtml, en el lugar exacto ` +
    `donde debería aparecer, el comentario <!--chart:{chartKey}--> (chartKey único en kebab-case).\n\n` +
    (args.redactorGuidance ?? ''),
  { schema: WRITER_SCHEMA, phase: 'Redactar' }
)

function componentNameFor(type) {
  const map = {
    bar: 'BarChart', timeline: 'TimelineChart', cards: 'ComparisonCards', table: 'TableChart',
    donut: 'DonutChart', line: 'LineChart', heatmap: 'HeatmapChart', scatter: 'ScatterChart',
    funnel: 'FunnelChart', dumbbell: 'DumbbellChart', gauge: 'GaugeChart', treemap: 'TreemapChart',
  }
  return map[type] ?? 'BarChart'
}

phase('Gráficas')
const chartResults = (
  await parallel(
    writerResult.chartRequests.map((req) => () =>
      agent(
        `Construye el data_json exacto para una gráfica de "A Fondo con Kilowatto".\n` +
          `Primero LEE el componente real en src/components/charts/${req.isRadar ? 'RadarChart' : componentNameFor(req.suggestedType)}.astro ` +
          `para conocer la forma exacta del prop "data" que espera (no inventes una forma distinta).\n\n` +
          `chartKey: "${req.chartKey}"\n` +
          `Tipo sugerido: "${req.suggestedType}"${req.isRadar ? ' (OBLIGATORIO: usa exactamente chartType "radar")' : ''}\n` +
          `Título: "${req.title}"\n` +
          `Qué debe mostrar: ${req.whatItShows}\n\n` +
          `Usa SOLO estos datos verificados como fuente de las cifras (no inventes números):\n` +
          usable.map((c, i) => `[${i}] "${c.text}" -- ${c.label} <${c.url}>`).join('\n') +
          `\n\nDevuelve chartKey (igual a "${req.chartKey}"), chartType, title, description breve, sourceNote (de dónde ` +
          `salen las cifras, en texto), y "data" con la forma exacta que requiere el componente.`,
        { schema: CHART_SCHEMA, phase: 'Gráficas', label: `chart:${req.chartKey}` }
      )
    )
  )
).filter(Boolean)

phase('Ensamblar')
// Built here in plain JS (not left to the agent to retype from pieces) specifically to
// keep the agent's own prompt/response as small as possible -- this payload can be huge
// for a long piece with many charts, and asking the agent to regenerate it via a tool-call
// argument is exactly the kind of giant single-turn output that failed live 2026-08-21
// ("the response stopped arriving"). The agent's only job now is to save this already-
// final string to a file and run the insert script -- no re-typing of content.
//
// The radar-comparativo chart is stripped from bodyHtml defensively (not just told not to
// appear there) -- the writer was explicitly instructed never to add a placeholder for it
// and did anyway on the first real run, duplicating that chart on the page.
const assembledPayload = JSON.stringify(
  {
    slug: args.slug,
    title: writerResult.title,
    subtitle: writerResult.subtitle,
    hook: writerResult.hook,
    summary: writerResult.summary,
    bodyHtml: writerResult.bodyHtml.replace('<!--chart:radar-comparativo-->', ''),
    methodologyHtml: writerResult.methodologyHtml,
    readMinutes: Math.max(3, Math.round(writerResult.bodyHtml.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length / 220)),
    sources: writerResult.citationsUsed,
    charts: chartResults.map((c, i) => ({ ...c, position: c.chartKey === 'radar-comparativo' ? 999 : i })),
  },
  null,
  0
)

let assembled = null
for (let attempt = 1; attempt <= 2 && !assembled; attempt++) {
  assembled = await agent(
    `Ya tienes el payload final de una investigación de "A Fondo con Kilowatto", completo y listo, como un string JSON ` +
      `abajo -- NO lo reconstruyas, NO lo vuelvas a escribir a mano, solo guárdalo tal cual:\n\n` +
      `1. Guarda este string EXACTO (es JSON válido) en un archivo nuevo dentro del directorio scratchpad de esta sesión, ` +
      `por ejemplo con Write directamente:\n${assembledPayload}\n\n` +
      `2. Corre: node scripts/insert-investigacion.mjs <ese archivo> > <ruta seed.sql en el mismo directorio temporal>\n` +
      `3. Lee el stderr de ese comando -- si imprime líneas "WARNING" sobre el conteo de tipos de gráfica o el radar, ` +
      `repórtalas tal cual (no las corrijas regenerando el JSON -- ese contenido ya fue decidido en fases anteriores).\n` +
      `4. Devuelve seedSqlPath (ruta absoluta del .sql generado), warnings (array de las que haya, vacío si ninguna), ` +
      `wordCount (cuenta de palabras del bodyHtml sin tags), sourceCount, chartTypeCount -- NUNCA ejecutes ` +
      `wrangler d1 execute --remote tú mismo.` +
      (attempt > 1 ? `\n\n(Reintento ${attempt}: el intento anterior no completó su respuesta. Sé breve en tu respuesta final -- el contenido ya está guardado en el archivo, no hace falta repetirlo.)` : ''),
    { schema: ASSEMBLE_SCHEMA, phase: 'Ensamblar' }
  )
}
if (!assembled) {
  throw new Error(
    'La fase Ensamblar falló dos veces seguidas. El payload completo (título, cuerpo, fuentes, gráficas) ya está ' +
      'listo en memoria de este run -- revisa journal.jsonl de este workflow para recuperarlo manualmente si hace falta, ' +
      'en vez de volver a correr todo desde el principio.'
  )
}

const wordCount = assembled.wordCount ?? writerResult.bodyHtml.replace(/<[^>]+>/g, ' ').split(/\s+/).filter(Boolean).length
const distinctChartTypes = new Set(chartResults.map((c) => c.chartType))
const hasRadar = chartResults.some((c) => c.chartKey === 'radar-comparativo')
const hasTable = chartResults.some((c) => c.chartType === 'table')
const hasSignOff = /wikidata\.org\/wiki\/Q140672978/.test(writerResult.bodyHtml)

const checklist = {
  wordCountInRange: wordCount >= wordCountMin * 0.85 && wordCount <= wordCountMax * 1.15,
  wordCount,
  sourcesConsulted: allSourcesConsulted.size,
  sourcesConsultedOk: allSourcesConsulted.size >= minSources || !!args?.forceProceed,
  usableSources: usable.length,
  discardedRed: discarded.length,
  distinctChartTypes: distinctChartTypes.size,
  distinctChartTypesOk: distinctChartTypes.size >= 6,
  hasRadar,
  hasTable,
  hasSignOff,
  hasHookAndSubtitle: !!writerResult.hook && !!writerResult.subtitle,
  assemblerWarnings: assembled.warnings ?? [],
  seedSqlPath: assembled.seedSqlPath,
}

log(`Checklist: ${JSON.stringify(checklist)}`)

return { status: 'ready_for_review', slug: args.slug, checklist, seedSqlPath: assembled.seedSqlPath }
