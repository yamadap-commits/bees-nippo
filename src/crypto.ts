export type EncryptedBlob = {
  encrypted: true;
  v: 1;
  salt: string;
  iv: string;
  ciphertext: string;
  iterations: number;
};

const ITERATIONS = 200_000;

function toB64(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function fromB64(s: string): Uint8Array {
  const bin = atob(s);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function deriveKey(
  password: string,
  salt: Uint8Array,
  iterations: number,
): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    { name: "PBKDF2" },
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: new Uint8Array(salt),
      iterations,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptJson<T>(
  data: T,
  password: string,
): Promise<EncryptedBlob> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt, ITERATIONS);
  const plaintext = new TextEncoder().encode(JSON.stringify(data));
  const cipherBuf = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    plaintext,
  );
  return {
    encrypted: true,
    v: 1,
    salt: toB64(salt),
    iv: toB64(iv),
    ciphertext: toB64(new Uint8Array(cipherBuf)),
    iterations: ITERATIONS,
  };
}

export async function decryptJson<T>(
  blob: EncryptedBlob,
  password: string,
): Promise<T> {
  const salt = fromB64(blob.salt);
  const iv = fromB64(blob.iv);
  const ciphertext = fromB64(blob.ciphertext);
  const key = await deriveKey(password, salt, blob.iterations ?? ITERATIONS);
  const plainBuf = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: new Uint8Array(iv) },
    key,
    new Uint8Array(ciphertext),
  );
  const text = new TextDecoder().decode(plainBuf);
  return JSON.parse(text) as T;
}

export function isEncryptedBlob(v: unknown): v is EncryptedBlob {
  return (
    typeof v === "object" &&
    v !== null &&
    (v as { encrypted?: unknown }).encrypted === true
  );
}
