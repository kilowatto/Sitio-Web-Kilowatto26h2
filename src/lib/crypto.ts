// Native Web Crypto only — no external deps, works as-is in Workers.

// OWASP currently recommends 600,000 for PBKDF2-SHA256, but Cloudflare Workers'
// crypto.subtle caps PBKDF2 at 100,000 iterations (throws NotSupportedError above
// that) — confirmed by hitting it in production, not documented up front.
const PBKDF2_ITERATIONS = 100_000;

function toHex(buf: ArrayBuffer) {
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function fromHex(hex: string) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return bytes;
}

export async function hashPassword(password: string, saltHex?: string): Promise<{ hash: string; salt: string }> {
  const salt = saltHex ? fromHex(saltHex) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    key,
    256
  );
  return { hash: toHex(bits), salt: toHex(salt) };
}

export async function verifyPassword(password: string, hash: string, salt: string): Promise<boolean> {
  const attempt = await hashPassword(password, salt);
  if (attempt.hash.length !== hash.length) return false;
  // constant-time compare
  let diff = 0;
  for (let i = 0; i < hash.length; i++) diff |= attempt.hash.charCodeAt(i) ^ hash.charCodeAt(i);
  return diff === 0;
}

export function generatePassword(length = 20): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*-_";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

async function getSettingsKey(env: any): Promise<CryptoKey> {
  if (!env.SETTINGS_ENCRYPTION_KEY) throw new Error("SETTINGS_ENCRYPTION_KEY not configured");
  const raw = fromHex(env.SETTINGS_ENCRYPTION_KEY);
  return crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
}

export async function encryptSetting(env: any, plaintext: string): Promise<string> {
  const key = await getSettingsKey(env);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plaintext));
  return `${toHex(iv)}:${toHex(ciphertext)}`;
}

export async function decryptSetting(env: any, stored: string): Promise<string> {
  const [ivHex, ctHex] = stored.split(":");
  const key = await getSettingsKey(env);
  const plaintext = await crypto.subtle.decrypt({ name: "AES-GCM", iv: fromHex(ivHex) }, key, fromHex(ctHex));
  return new TextDecoder().decode(plaintext);
}
