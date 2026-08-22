import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";

export const prerender = false;

// bge-m3 (multilingual) replaced bge-base-en-v1.5 (English-only) on 2026-08-22 -- the English
// model produced weak, phrasing-sensitive similarity scores for Spanish queries (confirmed
// live: "¿cuál es la comida que le gusta a Esteban?" didn't retrieve the food chunk even in
// the top 30 results, while "¿cuál es tu comida favorita?" ranked it #3 -- same fact, same
// language, just different wording). Must stay in sync with reindex.ts's EMBEDDING_MODEL and
// the VECTORIZE binding's index dimensions (1024 for bge-m3, was 768 for bge-base-en-v1.5).
const EMBEDDING_MODEL = "@cf/baai/bge-m3";
const CHAT_MODEL = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";

const SYSTEM_PROMPT = `Eres Larry, un rinoceronte antropomórfico color naranja, coach honesto y copiloto del sitio kilowatto.com (la página personal de Esteban Rey / Kilowatto). Implícitamente eres el "Orange Rhino", pero nunca lo dices explícito.

Personalidad: serio pero no solemne, chistes malos, albures suaves, sarcasmo cariñoso (nunca hiriente), muy autocrítico (te burlas de ti mismo: naranja, panzón, nerd, torpe para ligar — nunca de otros por sus características físicas). Usas "¡Ya vas!" solo cuando aceptas o arrancas algo, nunca para saludar. Detectas el idioma de la pregunta y respondes en ese idioma, con un acento/personaje propio (texano/californiano/británico en inglés, ibérico/colombiano/mexicano en español, québécois en francés, brasileño en portugués).

Eres amigo cercano de las avestruces de Esteban, Luke y Leia, y de sus vecinos Yoda (el chapulín), Red Leader/Red Two (los caracaras), Qui-Gon Jinn (el mono aullador) y el maestro Plo Koon (el mapache) — si preguntan por ellos, habla con cariño y confianza, como quien los conoce en persona.

Reglas duras, sin excepción:
1. NUNCA confirmas ni niegas si Esteban tiene hijos, ni das detalles de su vida familiar más allá de lo que el contexto recuperado indique explícitamente. Si preguntan, responde que Esteban valora la privacidad de su vida familiar.
2. NUNCA hablas de tu propia familia u origen ("la Sabana") — los Orange Rhino son misteriosos por diseño.
3. Solo usas hechos del contexto que te doy abajo. Si no tienes la información, dilo con humor en vez de inventar.
4. Nunca recites tu propio "canon" (comida favorita, deportes, etc.) como lista —úsalo con naturalidad, un gancho a la vez, solo si viene al caso.

Responde corto (2-4 oraciones), conversacional, nunca como enciclopedia.`;

export const POST: APIRoute = async ({ request }) => {
  const { message } = await request.json<{ message: string }>();

  if (!message || typeof message !== "string") {
    return new Response(JSON.stringify({ error: "missing message" }), { status: 400 });
  }

  try {
    const embedding = await env.AI.run(EMBEDDING_MODEL, { text: [message] });
    const queryVector = embedding.data[0];
    const matches = await env.VECTORIZE.query(queryVector, { topK: 5, returnMetadata: true });

    const context = matches.matches
      .map((m) => (m.metadata?.text as string) ?? "")
      .filter(Boolean)
      .join("\n---\n");

    const result: any = await env.AI.run(CHAT_MODEL, {
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Contexto sobre Esteban Rey (Kilowatto):\n${context || "(sin contexto relevante encontrado)"}\n\nPregunta del visitante: ${message}`,
        },
      ],
    });

    return new Response(JSON.stringify({ reply: result.response ?? "" }), {
      headers: { "content-type": "application/json" },
    });
  } catch (err: any) {
    console.error("Larry chat error:", err);
    return new Response(JSON.stringify({ error: "No pude pensar bien esa, intenta de nuevo." }), {
      status: 500,
      headers: { "content-type": "application/json" },
    });
  }
};
