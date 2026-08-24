import { Container, getContainer } from "@cloudflare/containers";

interface Env {
  RENDER_CONTAINER: DurableObjectNamespace<Container>;
  MEDIA: R2Bucket;
  RENDER_SECRET: string;
}

export class RenderContainer extends Container {
  defaultPort = 8080;

  // 30 seconds, not the 10 minutes the demo uses. Containers bill by GiB-hour while awake, and
  // at five clips a week an idle instance sleeping ten minutes after each one would spend most
  // of its billed life doing nothing. The cost is a cold start per render, which is seconds
  // against a render that takes minutes.
  sleepAfter = "30s";

  envVars = { RENDER_SECRET: "" };

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

    const body = await request.json<{ compositionId?: string; inputProps?: unknown; key?: string }>().catch(() => null);
    if (!body?.compositionId || !body?.key) {
      return Response.json({ error: "compositionId y key son obligatorios" }, { status: 400 });
    }

    const container = getContainer(env.RENDER_CONTAINER, "renderer");
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

    // Streamed into R2 rather than buffered: a 75-second 1080x1920 clip is several megabytes and
    // the isolate has 128 MB shared across every concurrent request.
    await env.MEDIA.put(body.key, res.body, { httpMetadata: { contentType: "video/mp4" } });
    const head = await env.MEDIA.head(body.key);
    return Response.json({ key: body.key, bytes: head?.size ?? null });
  },
};
