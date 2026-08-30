import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { figurasDeGrafica, renderInfografia } from "../../../lib/infografia";

export const prerender = false;

// Genera las infografías cuadradas de una pieza, una por cifra de su gráfica.
export const POST: APIRoute = async ({ url }) => {
  const t = url.searchParams.get("token");
  if (t !== env.ADMIN_TOKEN && t !== env.SCRATCH_TOKEN) return new Response("unauthorized", { status: 401 });

  const tipo = url.searchParams.get("type") === "columna" ? "columna" : "investigacion";
  const id = Number(url.searchParams.get("id") ?? 0);
  if (!id) return new Response("id requerido", { status: 400 });

  const tabla = tipo === "columna" ? "column_charts" : "investigacion_charts";
  const col = tipo === "columna" ? "column_id" : "investigacion_id";
  const pieza = await env.DB.prepare(
    `SELECT title, slug FROM ${tipo === "columna" ? "columns" : "investigaciones"} WHERE id = ?`
  )
    .bind(id)
    .first<any>();
  if (!pieza) return Response.json({ error: "pieza no encontrada" }, { status: 404 });

  const charts = await env.DB.prepare(
    `SELECT chart_key, data_json, source_note FROM ${tabla} WHERE ${col} = ? ORDER BY position ASC`
  )
    .bind(id)
    .all<any>();

  const eyebrow = `${tipo === "columna" ? "Columna" : "A fondo"} · ${pieza.title}`.slice(0, 70);
  const hechas: string[] = [];
  const errores: string[] = [];

  for (const ch of charts.results ?? []) {
    const figuras = figurasDeGrafica(ch.data_json, eyebrow, ch.source_note);
    for (let i = 0; i < figuras.length; i++) {
      const key = `media/infografias/${tipo}-${id}-${ch.chart_key}-${i}.png`;
      try {
        await renderInfografia(figuras[i], key);
        hechas.push(key);
      } catch (err: any) {
        errores.push(`${key}: ${err?.message ?? err}`);
      }
    }
  }

  return Response.json({ ok: errores.length === 0, pieza: pieza.slug, hechas: hechas.length, keys: hechas, errores });
};
