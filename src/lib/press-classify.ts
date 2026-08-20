import { env } from "cloudflare:workers";

const MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

const CLASSIFY_PROMPT = `Estás ayudando a filtrar menciones de prensa para el sitio personal de Esteban Rey Ortega, un CEO/inversionista tecnológico mexicano conocido como "Kilowatto", fundador de Ignia Cloud, DeSiCi, OnCloud (vendida), y del Yucatech Festival.

IMPORTANTE — estos NO son la misma persona/entidad, descarta cualquier artículo sobre ellos:
- Un cantautor/músico de rock y mariachi también llamado Esteban Rey (proyectos "Frida", "Chamito Sound"), también con handle @kilowatto en Spotify/YouTube — ojo, la coincidencia de handle NO significa que sea él.
- IGNIA (ignia.vc), un fondo de venture capital fundado en 2007 — sin relación con Ignia Cloud.
- Cualquier otro "Esteban Rey" (hay varios en LinkedIn: diseñador gráfico en Mediaset España, desarrollador de software, un asesor en Movistar Ecuador, un Head of Technology en KOIBANX, etc).
- Octapus (Esteban ya no tiene ninguna relación con esa empresa) — incluyendo el uso de "Súbete a la Nube S. de R.L. de C.V." como vehículo legal por los fundadores reales de Octapus en 2023, que NO es él.
- Finsus como inversión: Esteban NO es inversionista de Finsus — descarta cualquier artículo que lo describa como tal. SÍ es Director de Infraestructura Digital ahí, así que menciones reales sobre él en ese rol (o como ponente de Yucatech junto a gente de Finsus) SÍ son válidas, no las descartes.

Dado este título y el texto real del artículo (puede venir vacío si no se pudo descargar — en ese caso decide solo con el título), responde SOLO un objeto JSON con este formato exacto, sin texto adicional:
{"about_him": "yes" | "no" | "unsure", "summary": "resumen de una oración en español si about_him es yes, si no cadena vacía"}`;

// Shared between the Google News RSS pipeline (news/check.ts) and the broader web-search
// pipeline (press-web-search.ts) — same identity-disambiguation rules either way. Classifying
// on the title alone missed real mentions where his name only appears in the body/byline, not
// the headline (confirmed live 2026-07-23: an El Heraldo op-ed genuinely bylined by him, titled
// about AI in general, got silently rejected on title-only signal).
export async function classifyPressCandidate(title: string, bodyText: string): Promise<{ about_him: "yes" | "no" | "unsure"; summary: string }> {
  const result: any = await env.AI.run(MODEL, {
    messages: [
      { role: "system", content: CLASSIFY_PROMPT },
      { role: "user", content: `Título: ${title}\n\nTexto del artículo:\n${bodyText.slice(0, 3000)}` },
    ],
    max_tokens: 200,
  });
  if (result?.response && typeof result.response === "object") return result.response;
  const raw = typeof result?.response === "string" ? result.response : "";
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return { about_him: "unsure", summary: "" };
  try {
    return JSON.parse(match[0]);
  } catch {
    return { about_him: "unsure", summary: "" };
  }
}
