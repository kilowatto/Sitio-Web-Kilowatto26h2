import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { propsKeyFor } from "../../../lib/clip-post";

export const prerender = false;

// Vuelve a renderizar un clip que ya existe, con sus props exactos y sobre la misma clave.
//
// Existe por un cambio de diseño: el primer cuadro de la composición estaba en blanco, que es
// justo el cuadro que X y LinkedIn usan de miniatura. Arreglar eso no debería costar otra
// narración de ElevenLabs ni un guion nuevo del modelo -- y si lo costara, el resultado sería
// otro clip, no el mismo clip corregido.
//
// El post en la cola no se toca: apunta a la misma clave de R2, así que se actualiza solo.
export const POST: APIRoute = async ({ url }) => {
  const t = url.searchParams.get("token");
  if (t !== env.ADMIN_TOKEN && t !== env.SCRATCH_TOKEN) return new Response("unauthorized", { status: 401 });

  const key = url.searchParams.get("key");
  if (!key) return Response.json({ error: "key requerido" }, { status: 400 });

  const stored = await env.MEDIA.get(propsKeyFor(key));
  if (!stored) {
    return Response.json(
      { error: `no hay props guardados para ${key}; ese clip se renderizó antes de que se guardaran` },
      { status: 404 }
    );
  }

  const binding = (env as any).RENDER;
  if (!binding) return Response.json({ error: "falta el service binding RENDER" }, { status: 503 });

  const inputProps = JSON.parse(await stored.text());
  const res = await binding.fetch("https://render/render", {
    method: "POST",
    headers: { "content-type": "application/json", "x-render-secret": String((env as any).RENDER_SECRET ?? "") },
    body: JSON.stringify({ compositionId: "Clip", key, inputProps }),
  });
  if (!res.ok) {
    return Response.json({ error: `render ${res.status}`, detail: (await res.text()).slice(0, 400) }, { status: 502 });
  }
  return Response.json({ ok: true, ...(await res.json<any>()) });
};
