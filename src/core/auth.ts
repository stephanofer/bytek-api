/**
 * Authentication utilities using Web Crypto API.
 *
 * - Password hashing: PBKDF2 with SHA-256 (100k iterations)
 * - JWT: HMAC-SHA256 signing and verification
 *
 * Zero external dependencies — runs natively on Cloudflare Workers.
 */

const PBKDF2_ITERATIONS = 100_000;
const SALT_LENGTH = 16;
const HASH_ALGORITHM = "SHA-256";

const JWT_ALGORITHM = { name: "HMAC", hash: "SHA-256" } as const;
const JWT_EXPIRATION_SECONDS = 86_400; // 24 hours

// ── Password Hashing ──────────────────────────────────────────────

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function deriveKey(
  password: string,
  salt: Uint8Array,
): Promise<ArrayBuffer> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );

  return crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt,
      iterations: PBKDF2_ITERATIONS,
      hash: HASH_ALGORITHM,
    },
    keyMaterial,
    256,
  );
}

/**
 * Hashes a password using PBKDF2-SHA256.
 * Returns a string in format: `base64(salt).base64(hash)`
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const hash = await deriveKey(password, salt);

  return `${arrayBufferToBase64(salt.buffer as ArrayBuffer)}.${arrayBufferToBase64(hash)}`;
}

/**
 * Verifies a password against a stored hash.
 */
export async function verifyPassword(
  password: string,
  storedHash: string,
): Promise<boolean> {
  const [saltB64, hashB64] = storedHash.split(".");
  if (!saltB64 || !hashB64) return false;

  const salt = new Uint8Array(base64ToArrayBuffer(saltB64));
  const expectedHash = base64ToArrayBuffer(hashB64);
  const actualHash = await deriveKey(password, salt);

  // Constant-time comparison to prevent timing attacks
  const expected = new Uint8Array(expectedHash);
  const actual = new Uint8Array(actualHash);

  if (expected.length !== actual.length) return false;

  let result = 0;
  for (let i = 0; i < expected.length; i++) {
    result |= expected[i] ^ actual[i];
  }

  return result === 0;
}

// ── JWT ───────────────────────────────────────────────────────────

interface JwtPayload {
  sub: number;
  email: string;
  iat: number;
  exp: number;
}

function base64UrlEncode(data: string): string {
  return btoa(data).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlDecode(data: string): string {
  const padded = data.replace(/-/g, "+").replace(/_/g, "/");
  return atob(padded);
}

async function getSigningKey(secret: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    JWT_ALGORITHM,
    false,
    ["sign", "verify"],
  );
}

/**
 * Creates a signed JWT token.
 */
export async function createToken(
  userId: number,
  email: string,
  secret: string,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);

  const header = base64UrlEncode(
    JSON.stringify({ alg: "HS256", typ: "JWT" }),
  );

  const payload = base64UrlEncode(
    JSON.stringify({
      sub: userId,
      email,
      iat: now,
      exp: now + JWT_EXPIRATION_SECONDS,
    } satisfies JwtPayload),
  );

  const signingInput = `${header}.${payload}`;
  const key = await getSigningKey(secret);
  const encoder = new TextEncoder();

  const signature = await crypto.subtle.sign(
    JWT_ALGORITHM.name,
    key,
    encoder.encode(signingInput),
  );

  return `${signingInput}.${base64UrlEncode(
    String.fromCharCode(...new Uint8Array(signature)),
  )}`;
}

/**
 * Verifies and decodes a JWT token.
 * Returns the payload if valid, null if invalid or expired.
 */
export async function verifyToken(
  token: string,
  secret: string,
): Promise<JwtPayload | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [header, payload, signature] = parts;
  const signingInput = `${header}.${payload}`;

  try {
    const key = await getSigningKey(secret);
    const encoder = new TextEncoder();

    const signatureBytes = Uint8Array.from(
      base64UrlDecode(signature),
      (c) => c.charCodeAt(0),
    );

    const isValid = await crypto.subtle.verify(
      JWT_ALGORITHM.name,
      key,
      signatureBytes,
      encoder.encode(signingInput),
    );

    if (!isValid) return null;

    const decoded = JSON.parse(base64UrlDecode(payload)) as JwtPayload;

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (decoded.exp < now) return null;

    return decoded;
  } catch {
    return null;
  }
}
