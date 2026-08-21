import type { APIRoute } from "astro";

export const prerender = false;

// Reached via a rewrite from [...slug].astro and [locale]/index.astro whenever the
// requested path matches ENV_SCAN_RE (see src/lib/bot-scan.ts) -- bots specifically
// scanning for a leaked .env file. Esteban's call (2026-08-21): give them exactly what
// they're looking for, formatted like the real thing, every value an obvious joke. A
// plain API route (not a .astro page) on purpose -- Astro prepends <!DOCTYPE html> to
// every .astro page's output regardless of Content-Type, which would've given the game
// away immediately. Real 200, never logged to broken_links.
const BODY = `APP_ENV=production
APP_KEY=base64:NoEraTanFacilComoPensabas==
APP_DEBUG=false
APP_URL=https://kilowatto.com

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=produccion_no_toques
DB_USERNAME=root
DB_PASSWORD=PorQueLaGallinaCruzoElCamino?12312ParaLlegarAlOtroLado

AWS_ACCESS_KEY_ID=NICE-TRY-NO-CLAVE-AQUI-0000
AWS_SECRET_ACCESS_KEY=EstoNoFuncionaYaLoIntentasteVerdad2026
AWS_DEFAULT_REGION=nunca-jamas-1

STRIPE_SECRET_KEY=nice_try_pero_no_es_una_key_de_stripe_0000
STRIPE_WEBHOOK_SECRET=tampoco_es_un_webhook_secret_real_99

GOOGLE_AI_STUDIO_KEY=NoEsUnaKeyDeGoogleDeVerdad_LindoIntentoBot_123
OPENAI_API_KEY=NoEsUnaKeyDeOpenaiEnSerio_EstoEsUnaBroma_000000

JWT_SECRET=NuncaVasAEntrarAquiCarnal2026
SESSION_SECRET=DejaDeEscanearMiSitioPorFavor

SMTP_HOST=smtp.notreal.example
SMTP_USERNAME=larry@kilowatto.com
SMTP_PASSWORD=RhinoFuerte\$2026\$NoEsEnSerio

REDIS_URL=redis://localhost:6379/haciendoTiempo

WORDPRESS_DB_PASSWORD=NoUsamosWordpressYaTeLoDijimosArriba
ADMIN_TOKEN=ImprimeEstoYEnmarcaloPorqueEsLoMasCercaQueVasAEstar

# si llegaste hasta aqui buscando algo real: no hay nada que ver, este sitio corre en
# Astro sobre Cloudflare Workers. saludos de Larry
`;

export const GET: APIRoute = () => {
  return new Response(BODY, {
    status: 200,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
