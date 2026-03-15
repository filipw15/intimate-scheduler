import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;   // 96-bit IV recommended for GCM
const TAG_LENGTH = 16;

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error("ENCRYPTION_KEY must be a 64-character hex string (32 bytes).");
  }
  return Buffer.from(hex, "hex");
}

/**
 * Krypterar en sträng med AES-256-GCM.
 * Returnerar: "<iv_hex>:<ciphertext_hex>:<tag_hex>"
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [iv.toString("hex"), encrypted.toString("hex"), tag.toString("hex")].join(":");
}

/**
 * Dekrypterar en sträng krypterad med encrypt().
 * Förväntar: "<iv_hex>:<ciphertext_hex>:<tag_hex>"
 */
export function decrypt(ciphertext: string): string {
  const key = getKey();
  const parts = ciphertext.split(":");
  if (parts.length !== 3) {
    throw new Error("Ogiltigt krypteringsformat.");
  }
  const [ivHex, encryptedHex, tagHex] = parts;
  const iv = Buffer.from(ivHex!, "hex");
  const encrypted = Buffer.from(encryptedHex!, "hex");
  const tag = Buffer.from(tagHex!, "hex");

  if (tag.length !== TAG_LENGTH) {
    throw new Error("Ogiltig autentiseringstagg.");
  }

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}
