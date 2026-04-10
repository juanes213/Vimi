const ENCRYPTION_SECRET_ENV = "INTEGRATIONS_ENCRYPTION_KEY";
const STATE_SECRET_ENV = "GOOGLE_OAUTH_STATE_SECRET";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function deriveEncryptionKey(secret: string) {
  const hash = await crypto.subtle.digest("SHA-256", encoder.encode(secret));
  return await crypto.subtle.importKey("raw", hash, "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function deriveHmacKey(secret: string) {
  return await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function encryptSecret(plaintext: string) {
  const key = await deriveEncryptionKey(getRequiredEnv(ENCRYPTION_SECRET_ENV));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(plaintext),
  );
  const encrypted = new Uint8Array(encryptedBuffer);
  const tagLength = 16;
  const ciphertext = encrypted.slice(0, encrypted.length - tagLength);
  const tag = encrypted.slice(encrypted.length - tagLength);
  return `v1:${bytesToBase64Url(iv)}:${bytesToBase64Url(tag)}:${bytesToBase64Url(ciphertext)}`;
}

export async function decryptSecret(payload: string) {
  const [version, ivValue, tagValue, encryptedValue] = payload.split(":");
  if (version !== "v1" || !ivValue || !tagValue || !encryptedValue) {
    throw new Error("Invalid encrypted payload");
  }

  const key = await deriveEncryptionKey(getRequiredEnv(ENCRYPTION_SECRET_ENV));
  const iv = base64UrlToBytes(ivValue);
  const tag = base64UrlToBytes(tagValue);
  const encrypted = base64UrlToBytes(encryptedValue);
  const merged = new Uint8Array(encrypted.length + tag.length);
  merged.set(encrypted);
  merged.set(tag, encrypted.length);

  const decryptedBuffer = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, merged);
  return decoder.decode(decryptedBuffer);
}

export async function signOAuthState(payload: Record<string, string | number>) {
  const encoded = bytesToBase64Url(encoder.encode(JSON.stringify(payload)));
  const key = await deriveHmacKey(getRequiredEnv(STATE_SECRET_ENV));
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(encoded));
  return `${encoded}.${bytesToBase64Url(new Uint8Array(signature))}`;
}

export async function verifyOAuthState<T extends Record<string, string | number>>(value: string): Promise<T> {
  const [encoded, signature] = value.split(".");
  if (!encoded || !signature) {
    throw new Error("Invalid OAuth state");
  }

  const key = await deriveHmacKey(getRequiredEnv(STATE_SECRET_ENV));
  const isValid = await crypto.subtle.verify(
    "HMAC",
    key,
    base64UrlToBytes(signature),
    encoder.encode(encoded),
  );
  if (!isValid) {
    throw new Error("Invalid OAuth state signature");
  }

  return JSON.parse(decoder.decode(base64UrlToBytes(encoded))) as T;
}
