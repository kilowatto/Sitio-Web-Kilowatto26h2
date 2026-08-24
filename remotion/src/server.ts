import { renderMedia, selectComposition } from "@remotion/renderer";
import express from "express";
import fs from "node:fs/promises";
import path from "node:path";

// The render service that runs inside the container.
//
// Adapted from Remotion's official Cloudflare Containers demo, which is explicit about being a
// reference rather than production: it has no authentication, no queue, no rate limiting and no
// way to report progress or errors back. The first two are added here; the Worker in front owns
// the rest.

const app = express();
// A clip's props carry the chart data and can run past express's default 100kb limit.
app.use(express.json({ limit: "4mb" }));
const port = Number(process.env.PORT ?? 8080);

// Shared secret. The container is only reachable through its Worker, but "only reachable
// through" is a topology claim and topologies change; a header check costs nothing.
const SECRET = process.env.RENDER_SECRET ?? "";

app.get("/health", (_req, res) => {
  res.status(200).json({ ok: true });
});

app.post("/render", async (req, res) => {
  if (SECRET && req.header("x-render-secret") !== SECRET) {
    res.status(401).json({ message: "unauthorized" });
    return;
  }

  const { compositionId, inputProps } = req.body ?? {};
  if (!compositionId) {
    res.status(400).json({ message: "compositionId es obligatorio" });
    return;
  }

  const outputLocation = path.join("/tmp", `out-${process.hrtime.bigint()}.mp4`);
  try {
    const composition = await selectComposition({ serveUrl: "./build", id: compositionId, inputProps });
    await renderMedia({
      composition,
      inputProps,
      codec: "h264",
      crf: 20,
      outputLocation,
      serveUrl: "./build",
    });
    const file = await fs.readFile(outputLocation);
    res.status(200).type("video/mp4").send(file);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "el render falló", error: (err as Error).message });
  } finally {
    // The container's disk is 16 GB and it survives between requests, so a leaked file per
    // render adds up long before anyone notices.
    await fs.unlink(outputLocation).catch(() => {});
  }
});

app.listen(port, () => console.log(`render listo en :${port}`));
