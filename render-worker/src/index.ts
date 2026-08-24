import { Container, getContainer } from "@cloudflare/containers";

interface Env {
  RENDER_CONTAINER: DurableObjectNamespace<RenderContainer>;
  MEDIA: R2Bucket;
  RENDER_SECRET: string;
}

export class RenderContainer extends Container<Env> {
  defaultPort = 8080;

  // 30 seconds, not the 10 minutes the demo uses. Containers bill by GiB-hour while awake, and
  // at five clips a week an idle instance sleeping ten minutes after each one would spend most
  // of its billed life doing nothing. The cost is a cold start per render, which is seconds
  // against a render that takes minutes.
  sleepAfter = "30s";

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    // The container checks the secret too. It is only reachable through this Worker today, but
    // "only reachable through" is a claim about topology and topologies change. Set here rather
    // than as a class field because a field initializer cannot see env.
    this.envVars = { RENDER_SECRET: env.RENDER_SECRET ?? "" };
  }

  onError(error: unknown): void {
    console.error("render container error:", error);
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return Response.json({ ok: true });
    }

    if (url.pathname !== "/render" || request.method !== "POST") {
      return new Response("POST /render", { status: 404 });
    }

    // Shared secret rather than an open endpoint: this Worker has no other authentication and a
    // render is expensive enough that anyone finding the URL could run up a bill.
    if (!env.RENDER_SECRET || request.headers.get("x-render-secret") !== env.RENDER_SECRET) {
      return new Response("unauthorized", { status: 401 });
    }

    const body = await request
      .json<{ compositionId?: string; inputProps?: unknown; key?: string; instance?: string }>()
      .catch(() => null);
    if (!body?.compositionId || !body?.key) {
      return Response.json({ error: "compositionId y key son obligatorios" }, { status: 400 });
    }

    // El nombre elige la instancia. Por omisión, una sola llamada "renderer" -- barato, porque
    // los renders son secuenciales y de todos modos van uno a la vez.
    //
    // Es seleccionable porque una instancia viva NO recoge una imagen nueva: tras desplegar la
    // imagen con las fuentes correctas, la instancia de siempre siguió rindiendo con la anterior
    // y siguió viva diez minutos sin trabajo, con sleepAfter en 30 s. Un nombre distinto arranca
    // una instancia nueva, que sí toma la imagen nueva.
    const container = getContainer(env.RENDER_CONTAINER, body.instance || "renderer");
    const res = await container.fetch(
      new Request("http://container/render", {
        method: "POST",
        headers: { "content-type": "application/json", "x-render-secret": env.RENDER_SECRET },
        body: JSON.stringify({ compositionId: body.compositionId, inputProps: body.inputProps }),
      })
    );

    if (!res.ok) {
      return Response.json({ error: "el render falló", detail: (await res.text()).slice(0, 500) }, { status: 502 });
    }

    // Buffered, not streamed. Streaming was the first attempt and R2 rejected it outright:
    // "Provided readable stream must have a known length (request/response body or readable half
    // of FixedLengthStream)". It could be made to work by piping through a FixedLengthStream
    // built from the container's Content-Length, but the whole benefit would be avoiding a
    // buffer that is a few megabytes -- a 90-second 1080x1920 clip lands around 5 MB, against an
    // isolate limit of 128 MB. Not worth the extra moving part.
    const bytes = await res.arrayBuffer();
    await env.MEDIA.put(body.key, bytes, { httpMetadata: { contentType: "video/mp4" } });
    const head = await env.MEDIA.head(body.key);
    return Response.json({ key: body.key, bytes: head?.size ?? null });
  },
};
