import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";

export const RP_NAME = "Kilowatto Admin";
export const RP_ID = "kilowatto.com";
export const ORIGIN = "https://kilowatto.com";

const CHALLENGE_TTL_SECONDS = 300; // 5 min, matches how long a WebAuthn prompt reasonably stays open

export async function storeChallenge(env: any, key: string, challenge: string) {
  await env.SESSION.put(`kw_webauthn_challenge:${key}`, challenge, { expirationTtl: CHALLENGE_TTL_SECONDS });
}

export async function consumeChallenge(env: any, key: string): Promise<string | null> {
  const challenge = await env.SESSION.get(`kw_webauthn_challenge:${key}`);
  if (challenge) await env.SESSION.delete(`kw_webauthn_challenge:${key}`);
  return challenge;
}

export async function buildRegistrationOptions(env: any, userId: number, email: string) {
  const existing = await env.DB.prepare("SELECT credential_id, transports FROM webauthn_credentials WHERE user_id = ?")
    .bind(userId)
    .all<any>();

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userName: email,
    userID: new TextEncoder().encode(String(userId)),
    attestationType: "none",
    excludeCredentials: (existing.results ?? []).map((c: any) => ({
      id: c.credential_id,
      transports: c.transports ? JSON.parse(c.transports) : undefined,
    })),
    authenticatorSelection: {
      residentKey: "required",
      userVerification: "required",
    },
  });

  await storeChallenge(env, `reg:${userId}`, options.challenge);
  return options;
}

export async function verifyRegistration(env: any, userId: number, response: any, nickname?: string) {
  const expectedChallenge = await consumeChallenge(env, `reg:${userId}`);
  if (!expectedChallenge) throw new Error("challenge expirado, intenta de nuevo");

  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge,
    expectedOrigin: ORIGIN,
    expectedRPID: RP_ID,
  });

  if (!verification.verified || !verification.registrationInfo) throw new Error("no se pudo verificar el passkey");

  const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;

  await env.DB.prepare(
    `INSERT INTO webauthn_credentials (user_id, credential_id, public_key, counter, device_type, backed_up, transports, nickname)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      userId,
      credential.id,
      Buffer.from(credential.publicKey).toString("base64url"),
      credential.counter,
      credentialDeviceType,
      credentialBackedUp ? 1 : 0,
      credential.transports ? JSON.stringify(credential.transports) : null,
      nickname ?? null
    )
    .run();

  return true;
}

export async function buildAuthenticationOptions(env: any) {
  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    userVerification: "required",
  });
  await storeChallenge(env, "auth:anon", options.challenge);
  return options;
}

export async function verifyAuthentication(env: any, response: any) {
  const expectedChallenge = await consumeChallenge(env, "auth:anon");
  if (!expectedChallenge) throw new Error("challenge expirado, intenta de nuevo");

  const credentialId = response.id;
  const stored = await env.DB.prepare("SELECT * FROM webauthn_credentials WHERE credential_id = ?")
    .bind(credentialId)
    .first<any>();
  if (!stored) throw new Error("passkey no reconocido");

  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge,
    expectedOrigin: ORIGIN,
    expectedRPID: RP_ID,
    credential: {
      id: stored.credential_id,
      publicKey: Buffer.from(stored.public_key, "base64url"),
      counter: stored.counter,
      transports: stored.transports ? JSON.parse(stored.transports) : undefined,
    },
  });

  if (!verification.verified) throw new Error("no se pudo verificar el passkey");

  await env.DB.prepare("UPDATE webauthn_credentials SET counter = ?, last_used_at = datetime('now') WHERE id = ?")
    .bind(verification.authenticationInfo.newCounter, stored.id)
    .run();

  return stored.user_id as number;
}
