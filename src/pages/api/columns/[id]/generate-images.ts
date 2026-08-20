import type { APIRoute } from "astro";
import { env } from "cloudflare:workers";
import { generateRecraftImage } from "../../../../lib/recraft-image";
import { saveInfographic, type InfographicOptions } from "../../../../lib/column-infographic";

export const prerender = false;

// Editorial illustration style for columns — deliberately NOT Larry/Orange Rhino, which is the
// social-brand-post mascot register. Columns are long-form opinion pieces, closer to a real
// publication's art direction than a social post's visual identity.
const NEGATIVE_PROMPT = "text, letters, words, numbers, watermark, logo, signature, mascot, cartoon rhino, ugly, blurry";

type Brief = {
  cover: string;
  second: { type: "infographic"; data: InfographicOptions } | { type: "illustration"; prompt: string };
};

// Per-column art-direction briefs — kept explicit rather than auto-derived from body text, since
// picking the strongest visual moment (and whether a real chart is even possible) in a piece is
// an editorial judgment call each time. Infographic only used where the column itself cites real
// comparable numbers — everything else gets a second illustration instead of a fabricated chart.
const BRIEFS: Record<string, Brief> = {
  "mis-aventuras-con-fable": {
    cover:
      "Editorial illustration for a tech opinion piece: an ornate glowing digital oracle or genie made of light and circuitry, floating above a minimalist modern office desk, warm amber and deep orange color palette, sense of expensive power and mystery, clean professional editorial illustration style, no text",
    second: {
      type: "infographic",
      data: {
        title: "¿Qué tan caro es Fable?",
        subtitle: "Costo de su API comparado con otros modelos",
        bars: [
          { label: "vs. GPT (gen. anterior)", value: 15, displayValue: "15x" },
          { label: "vs. Opus 4.8", value: 10, displayValue: "10x" },
          { label: "vs. Sonnet 5", value: 50, displayValue: "50x" },
        ],
      },
    },
  },
  "internet-too-big-to-fail": {
    cover:
      "Editorial illustration: an enormous ornate woven basket holding the entire glowing digital globe/internet inside it, teetering on the edge of a table, dramatic warm amber lighting, sense of fragility and risk, clean professional editorial illustration style, no text",
    second: {
      type: "infographic",
      data: {
        title: "¿Quién controla la nube?",
        subtitle: "Participación del mercado global de infraestructura en la nube",
        bars: [
          { label: "Google Cloud", value: 13, displayValue: "13%" },
          { label: "Microsoft Azure", value: 20, displayValue: "20%" },
          { label: "Amazon AWS", value: 30, displayValue: "30%" },
        ],
      },
    },
  },
  "credenciales-fantasma": {
    cover:
      "Editorial illustration: a translucent glowing key made of streaming code and light floating unnoticed through a dark empty server room at night, sense of an invisible autonomous presence, clean professional editorial illustration style, no text",
    second: {
      type: "illustration",
      prompt:
        "Editorial illustration: a mechanical robotic hand issuing dozens of tiny glowing digital keys into the air inside a server room, no human present, cool blue tones, clean professional editorial illustration style, no text",
    },
  },
  "credencial-salud-boveda-nacional": {
    cover:
      "Editorial illustration: a single ornate glowing digital vault door replacing a messy pile of many different ID cards and wallets, warm amber glow from the vault, clean professional editorial illustration style, no text",
    second: {
      type: "infographic",
      data: {
        title: "Identidades que carga un mexicano",
        subtitle: "Documentos distintos hoy vs. la propuesta de una sola identidad digital",
        bars: [
          { label: "Propuesta: una identidad digital", value: 1, displayValue: "1" },
          { label: "Hoy: INE, CURP, RFC, cédula, licencia...", value: 6, displayValue: "6+" },
        ],
      },
    },
  },
  "artemis-ii": {
    cover:
      "Editorial illustration: the Artemis II SLS rocket standing tall on the launch pad at night under floodlights, small human silhouettes for scale, dramatic and hopeful atmosphere, clean professional editorial illustration style, no text",
    second: {
      type: "illustration",
      prompt:
        "Editorial illustration: a lone astronaut silhouette looking out a capsule window at the Moon with Mars glowing faintly in the distant background, sense of a long journey ahead, clean professional editorial illustration style, no text",
    },
  },
  "techo-de-cristal-de-la-ia": {
    cover:
      "Editorial illustration: a glowing molten quartz crucible cracking under pressure while holding a tiny silicon computer chip inside it, warm orange glass tones, sense of a hidden physical bottleneck, clean professional editorial illustration style, no text",
    second: {
      type: "illustration",
      prompt:
        "Editorial illustration: two hands reaching for the same last spool of glass fiber thread on an assembly line, one labeled with a chip icon and one with a laptop icon, tension and scarcity, clean professional editorial illustration style, no text",
    },
  },
  "dr-gpt-te-atendera-ahora": {
    cover:
      "Editorial illustration: a smartphone glowing warmly in a cozy home, showing a gentle caring stethoscope icon on its screen, soft comforting light, sense of accessible care, clean professional editorial illustration style, no text",
    second: {
      type: "infographic",
      data: {
        title: "¿A quién prefirieron los pacientes?",
        subtitle: "Estudio UCSD/JAMA: respuestas de IA vs. médicos",
        bars: [
          { label: "Médicos", value: 21, displayValue: "21%" },
          { label: "Respuesta de la IA", value: 79, displayValue: "79%" },
        ],
      },
    },
  },
  "padron-del-desastre": {
    cover:
      "Editorial illustration: a shattered smartphone screen with glowing personal data (ID cards, fingerprints, documents) leaking out like light through the cracks into darkness, sense of a data breach, clean professional editorial illustration style, no text",
    second: {
      type: "infographic",
      data: {
        title: "Historial de padrones telefónicos en México",
        subtitle: "Intentos del Estado por crear un registro obligatorio de líneas móviles",
        bars: [
          { label: "PANAUT (2021, declarado inconstitucional)", value: 1, displayValue: "2021" },
          { label: "RENAUT (2009, filtrado y cancelado)", value: 1, displayValue: "2009" },
          { label: "Nuevo registro (2026, vulnerado día 1)", value: 1, displayValue: "2026" },
        ],
      },
    },
  },
  "club-vip-hardware": {
    cover:
      "Editorial illustration: a velvet-rope VIP entrance to a glowing data center at night, well-dressed executives waved through by a bouncer while a small business owner is turned away, clean professional editorial illustration style, no text",
    second: {
      type: "illustration",
      prompt:
        "Editorial illustration: an empty server rack shelf with a bright red 'agotado/sold out' glow where memory modules used to be, warehouse setting, clean professional editorial illustration style, no text",
    },
  },
  "nube-a-la-orbita": {
    cover:
      "Editorial illustration: rows of solar-powered server racks floating in orbit above Earth, glowing panels catching endless sunlight, dramatic space background, clean professional editorial illustration style, no text",
    second: {
      type: "illustration",
      prompt:
        "Editorial illustration: a robotic arm repairing an overheating glowing server radiator in the vacuum of space, Earth visible below, sense of extreme engineering challenge, clean professional editorial illustration style, no text",
    },
  },
  "ia-es-real-burbuja-nvidia-no": {
    cover:
      "Editorial illustration: a large green dragon made of circuitry and light waking up and cracking through a golden bubble-shaped computer chip, dramatic tension between East and West tech, clean professional editorial illustration style, no text",
    second: {
      type: "infographic",
      data: {
        title: "El mercado chino de chips de IA",
        subtitle: "Participación de NVIDIA en China, 2023 vs. 2025",
        bars: [
          { label: "Hoy (2025)", value: 50, displayValue: "~50%" },
          { label: "Antes (2023)", value: 95, displayValue: "95%" },
        ],
      },
    },
  },
  "ia-se-comio-tu-memoria": {
    cover:
      "Editorial illustration: a giant glowing AI chip with a mouth-like opening devouring a stack of RAM memory sticks, warm amber and electric blue tones, clean professional editorial illustration style, no text",
    second: {
      type: "infographic",
      data: {
        title: "El costo del hardware en 2026",
        subtitle: "Incremento estimado de precio vs. 2024, por escasez de memoria",
        bars: [
          { label: "Precio 2024 (base)", value: 100, displayValue: "base" },
          { label: "Precio estimado 2026", value: 128, displayValue: "+20-30%" },
        ],
      },
    },
  },
  "impuesto-silencioso-de-la-ia": {
    cover:
      "Editorial illustration: coins and bills flowing out of a piggy bank painted with Mexican folk-art patterns, streaming into a laptop screen showing a distant glowing cloud icon, sense of capital flight, clean professional editorial illustration style, no text",
    second: {
      type: "illustration",
      prompt:
        "Editorial illustration: an empty office desk and chair bathed in cold light, with a single glowing AI subscription card sitting on the desk where an employee used to sit, clean professional editorial illustration style, no text",
    },
  },
  "fragilidad-de-la-nube": {
    cover:
      "Editorial illustration: the glowing digital globe held up by only three or four thick glowing cables against a dark background, other thin cables frayed and sparking, sense of systemic fragility, clean professional editorial illustration style, no text",
    second: {
      type: "infographic",
      data: {
        title: "Quién sostiene la nube global",
        subtitle: "Participación combinada de los tres mayores proveedores",
        bars: [
          { label: "Google Cloud", value: 13, displayValue: "13%" },
          { label: "Microsoft Azure", value: 20, displayValue: "20%" },
          { label: "Amazon AWS", value: 30, displayValue: "30%" },
        ],
      },
    },
  },
  "frida-cafe": {
    cover:
      "Editorial illustration: a steaming cup of Mexican coffee with warm folk-art inspired patterns swirling in the steam, vibrant Mexican color palette (marigold orange, deep pink, turquoise), clean professional editorial illustration style, no text",
    second: {
      type: "illustration",
      prompt:
        "Editorial illustration: lush green coffee plantation terraces in the Mexican mountains (Chiapas-style), warm golden morning light, sense of tradition and craft, clean professional editorial illustration style, no text",
    },
  },
  "80-horas-a-la-semana": {
    cover:
      "Editorial illustration: a person's silhouette with their head opening up like a screen overflowing with tiny glowing news headlines and TV static, sense of information overload, clean professional editorial illustration style, no text",
    second: {
      type: "infographic",
      data: {
        title: "La adicción invisible a las noticias",
        subtitle: "Encuestas Pew Research / Reuters Institute",
        bars: [
          { label: "Evitan activamente ciertas noticias", value: 38, displayValue: "38%" },
          { label: "Conectados constantemente a noticias", value: 30, displayValue: "30%" },
        ],
      },
    },
  },
  "follow-the-dots-fable-ios": {
    cover:
      "Editorial illustration: a minimalist smartphone silhouette with a glowing digital shield cracking on its screen, thin streams of binary code leaking out through the crack, dramatic blue and red security-alert lighting, no visible logos or brand marks, clean professional editorial illustration style, no text",
    second: {
      type: "illustration",
      prompt:
        "Editorial illustration: side by side contrast of a massive golden fortress glowing with protective shields, versus a small humble wooden shop with a rusty cracked padlock, representing a security divide between the wealthy and the small, warm vs cold lighting contrast, clean professional editorial illustration style, no text",
    },
  },
  "nefasto-nuevo-linkedin": {
    cover:
      "Editorial illustration: an endless glowing ribbon of a phone screen spiraling into infinity, a small human silhouette trapped scrolling within the spiral, cool blue tones, clean professional editorial illustration style, no text",
    second: {
      type: "illustration",
      prompt:
        "Editorial illustration: a glowing human brain connected to a smartphone by a thin IV drip line of light, representing a dopamine feedback loop, clean professional editorial illustration style, no text",
    },
  },
};

export const POST: APIRoute = async ({ request, params }) => {
  const url = new URL(request.url);
  if (url.searchParams.get("token") !== env.ADMIN_TOKEN) {
    return new Response("unauthorized", { status: 401 });
  }

  const id = Number(params.id);
  const row = await env.DB.prepare("SELECT * FROM columns WHERE id = ?").bind(id).first<any>();
  if (!row) return new Response(JSON.stringify({ error: "not found" }), { status: 404 });

  const brief = BRIEFS[row.slug];
  if (!brief) {
    return new Response(JSON.stringify({ error: `no image brief defined for slug "${row.slug}"` }), { status: 400 });
  }

  const [coverKey, secondResult] = await Promise.all([
    generateRecraftImage(brief.cover, { style: "digital_illustration", negativePrompt: NEGATIVE_PROMPT }),
    brief.second.type === "infographic"
      ? saveInfographic(env, brief.second.data).then((key) => ({ infographicKey: key, illustrationKey: null as string | null }))
      : generateRecraftImage(brief.second.prompt, { style: "digital_illustration", negativePrompt: NEGATIVE_PROMPT }).then((key) => ({
          infographicKey: null as string | null,
          illustrationKey: key,
        })),
  ]);

  await env.DB.prepare(
    `UPDATE columns SET cover_r2_key = COALESCE(?, cover_r2_key), illustration_r2_key = COALESCE(?, illustration_r2_key), infographic_r2_key = COALESCE(?, infographic_r2_key) WHERE id = ?`
  )
    .bind(coverKey, secondResult.illustrationKey, secondResult.infographicKey, id)
    .run();

  return new Response(
    JSON.stringify({ ok: true, coverKey, infographicKey: secondResult.infographicKey, illustrationKey: secondResult.illustrationKey }),
    { headers: { "content-type": "application/json" } }
  );
};
