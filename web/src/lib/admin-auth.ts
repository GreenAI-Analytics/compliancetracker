import crypto from "crypto";

export const ADMIN_SESSION_COOKIE = "app_admin_session";
const ADMIN_SESSION_HOURS = 8;

function toBase64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function fromBase64Url(value: string): string {
  return Buffer.from(value, "base64url").toString("utf8");
}

function getSessionSecret(): string | null {
  const secret = process.env.APP_ADMIN_SESSION_SECRET?.trim();
  return secret && secret.length >= 16 ? secret : null;
}

export function getAdminCredentials(): { email: string; password: string } | null {
  const email = process.env.APP_ADMIN_EMAIL?.trim();
  const password = process.env.APP_ADMIN_PASSWORD?.trim();

  if (!email || !password) return null;
  return { email: email.toLowerCase(), password };
}

export function verifyAdminCredentials(email: string, password: string): boolean {
  const credentials = getAdminCredentials();
  if (!credentials) return false;

  return email.trim().toLowerCase() === credentials.email && password === credentials.password;
}

export function createAdminSessionToken(email: string): string | null {
  const secret = getSessionSecret();
  if (!secret) return null;

  const payload = JSON.stringify({
    email: email.trim().toLowerCase(),
    exp: Date.now() + ADMIN_SESSION_HOURS * 60 * 60 * 1000,
  });

  const encoded = toBase64Url(payload);
  const signature = crypto.createHmac("sha256", secret).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

export function readAdminSession(token: string | undefined): { email: string } | null {
  if (!token) return null;

  const secret = getSessionSecret();
  if (!secret) return null;

  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;

  const expectedSignature = crypto.createHmac("sha256", secret).update(encoded).digest("base64url");

  if (signature.length !== expectedSignature.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) return null;

  try {
    const parsed = JSON.parse(fromBase64Url(encoded)) as { email?: string; exp?: number };
    if (!parsed.email || !parsed.exp) return null;
    if (Date.now() > parsed.exp) return null;

    return { email: parsed.email };
  } catch {
    return null;
  }
}
