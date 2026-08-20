// Builds a LinkedIn "document" (carousel) post for a published column: a short PDF deck
// (cover + a few pull-quote pages + a closing CTA page) uploaded via LinkedIn's Documents API
// and attached to a post whose commentary text carries the actual clickable link back to the
// site — LinkedIn's embedded document viewer doesn't reliably make in-PDF text clickable, so
// the CTA lives in both places: reinforced on the last page, functional in the commentary.
//
// NEVER TESTED LIVE — LINKEDIN_ACCESS_TOKEN/LINKEDIN_PERSON_URN aren't configured yet (see
// brand_api_settings). The Documents API request/response shapes below are built from LinkedIn's
// documented Posts/Documents API contract, not confirmed against a real response. Re-verify the
// exact field names once Esteban has real credentials and the first live post is attempted.
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { PhotonImage } from "@cf-wasm/photon/workerd";
import { getSetting } from "./social-publish";

const PAGE_W = 1080;
const PAGE_H = 1350;
const BG = rgb(0.06, 0.09, 0.13);
const EMBER = rgb(0.85, 0.35, 0.16);
const PAPER = rgb(0.96, 0.95, 0.92);

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&ldquo;/g, "“")
    .replace(/&rdquo;/g, "”")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function extractParagraphs(bodyHtml: string): string[] {
  const matches = Array.from(bodyHtml.matchAll(/<p(?:\s[^>]*)?>([\s\S]*?)<\/p>/g));
  return matches
    .map((m) => stripHtml(m[1]))
    .filter((t) => t.length > 40); // skip stray short/callout fragments
}

function wrapText(text: string, font: any, size: number, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

async function toEmbeddableJpeg(bytes: ArrayBuffer): Promise<Uint8Array> {
  const img = PhotonImage.new_from_byteslice(new Uint8Array(bytes));
  const out = img.get_bytes_jpeg(85);
  img.free?.();
  return out;
}

interface CarouselColumn {
  slug: string;
  title: string;
  subtitle: string | null;
  body_html: string;
}

export async function buildColumnCarouselPdf(
  env: any,
  column: CarouselColumn,
  coverBytes: ArrayBuffer | null
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);

  // --- Page 1: cover ---
  const cover = pdf.addPage([PAGE_W, PAGE_H]);
  cover.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: BG });
  if (coverBytes) {
    try {
      const jpeg = await toEmbeddableJpeg(coverBytes);
      const embedded = await pdf.embedJpg(jpeg);
      const imgH = PAGE_W * (embedded.height / embedded.width);
      cover.drawImage(embedded, { x: 0, y: PAGE_H - imgH, width: PAGE_W, height: imgH });
      // Gradient-ish scrim so title text stays legible over the photo
      cover.drawRectangle({
        x: 0,
        y: 0,
        width: PAGE_W,
        height: PAGE_H,
        color: BG,
        opacity: 0.45,
      });
    } catch {
      // fall through to plain background if the source image can't be decoded
    }
  }
  cover.drawText("COLUMNA · KILOWATTO", {
    x: 64,
    y: 220,
    size: 22,
    font: bold,
    color: EMBER,
  });
  const titleLines = wrapText(column.title, bold, 56, PAGE_W - 128);
  let ty = 150;
  for (const line of titleLines) {
    cover.drawText(line, { x: 64, y: ty, size: 56, font: bold, color: PAPER });
    ty -= 64;
  }
  if (column.subtitle) {
    const subLines = wrapText(column.subtitle, regular, 24, PAGE_W - 128).slice(0, 3);
    for (const line of subLines) {
      ty -= 8;
      cover.drawText(line, { x: 64, y: ty, size: 24, font: regular, color: rgb(0.82, 0.82, 0.82) });
      ty -= 32;
    }
  }
  cover.drawText("Por Esteban Rey", { x: 64, y: 60, size: 20, font: regular, color: rgb(0.7, 0.7, 0.7) });

  // --- Middle pages: pull quotes ---
  const paragraphs = extractParagraphs(column.body_html);
  const picks = [paragraphs[1], paragraphs[Math.floor(paragraphs.length / 2)], paragraphs[paragraphs.length - 3]].filter(
    Boolean
  ) as string[];
  for (const quote of picks.slice(0, 3)) {
    const page = pdf.addPage([PAGE_W, PAGE_H]);
    page.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: PAPER });
    page.drawRectangle({ x: 64, y: PAGE_H / 2 - 6, width: 60, height: 12, color: EMBER });
    const lines = wrapText(quote, bold, 34, PAGE_W - 128).slice(0, 12);
    const startY = PAGE_H / 2 + (lines.length * 46) / 2 - 40;
    lines.forEach((line, i) => {
      page.drawText(line, { x: 64, y: startY - i * 46, size: 34, font: bold, color: rgb(0.12, 0.12, 0.12) });
    });
  }

  // --- Last page: CTA ---
  const cta = pdf.addPage([PAGE_W, PAGE_H]);
  cta.drawRectangle({ x: 0, y: 0, width: PAGE_W, height: PAGE_H, color: BG });
  cta.drawText("¿Seguimos?", { x: 64, y: PAGE_H - 300, size: 48, font: bold, color: PAPER });
  cta.drawText("Lee la columna completa en", {
    x: 64,
    y: PAGE_H - 380,
    size: 26,
    font: regular,
    color: rgb(0.75, 0.75, 0.75),
  });
  cta.drawText(`kilowatto.com/columnas/${column.slug}`, {
    x: 64,
    y: PAGE_H - 420,
    size: 26,
    font: bold,
    color: EMBER,
  });
  cta.drawText("(liga completa en este post)", {
    x: 64,
    y: PAGE_H - 460,
    size: 18,
    font: regular,
    color: rgb(0.6, 0.6, 0.6),
  });

  return pdf.save();
}

export async function postColumnCarouselToLinkedIn(
  env: any,
  column: CarouselColumn,
  coverUrl: string | null
): Promise<{ ok: boolean; error?: string; externalUrl?: string }> {
  const [accessToken, personUrn] = await Promise.all([
    getSetting(env, "LINKEDIN_ACCESS_TOKEN"),
    getSetting(env, "LINKEDIN_PERSON_URN"),
  ]);
  if (!accessToken || !personUrn) {
    return {
      ok: false,
      error:
        "LINKEDIN_ACCESS_TOKEN/LINKEDIN_PERSON_URN no configurados — agrégalos en /admin/settings para activar el carrusel automático.",
    };
  }

  let coverBytes: ArrayBuffer | null = null;
  if (coverUrl) {
    const res = await fetch(coverUrl);
    if (res.ok) coverBytes = await res.arrayBuffer();
  }

  const pdfBytes = await buildColumnCarouselPdf(env, column, coverBytes);

  const initRes = await fetch("https://api.linkedin.com/rest/documents?action=initializeUpload", {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
      "LinkedIn-Version": "202601",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify({ initializeUploadRequest: { owner: personUrn } }),
  });
  if (!initRes.ok) {
    return { ok: false, error: `LinkedIn documents initializeUpload ${initRes.status}: ${await initRes.text()}` };
  }
  const initData: any = await initRes.json();
  const uploadUrl: string | undefined = initData?.value?.uploadUrl;
  const documentUrn: string | undefined = initData?.value?.document;
  if (!uploadUrl || !documentUrn) {
    return { ok: false, error: `LinkedIn documents initializeUpload: respuesta inesperada ${JSON.stringify(initData)}` };
  }

  const putRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "content-type": "application/pdf" },
    body: pdfBytes,
  });
  if (!putRes.ok) {
    return { ok: false, error: `LinkedIn documents upload ${putRes.status}: ${await putRes.text()}` };
  }

  const columnUrl = `https://kilowatto.com/columnas/${column.slug}`;
  const commentary = `${column.title}\n\n${column.subtitle ?? ""}\n\nLee la columna completa: ${columnUrl}`;

  const postRes = await fetch("https://api.linkedin.com/rest/posts", {
    method: "POST",
    headers: {
      authorization: `Bearer ${accessToken}`,
      "content-type": "application/json",
      "LinkedIn-Version": "202601",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify({
      author: personUrn,
      commentary,
      visibility: "PUBLIC",
      distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] },
      content: { media: { title: column.title, id: documentUrn } },
      lifecycleState: "PUBLISHED",
    }),
  });
  if (!postRes.ok) {
    return { ok: false, error: `LinkedIn posts ${postRes.status}: ${await postRes.text()}` };
  }
  const id = postRes.headers.get("x-restli-id") ?? undefined;
  return { ok: true, externalUrl: id ? `https://www.linkedin.com/feed/update/${id}` : undefined };
}
