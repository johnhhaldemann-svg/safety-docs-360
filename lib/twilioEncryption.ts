/**
 * AES-256-GCM encryption for Twilio auth tokens stored in company_twilio_settings.
 *
 * Requires env var: TWILIO_SETTINGS_ENCRYPTION_KEY (64 hex chars = 32 bytes)
 * Generate with: openssl rand -hex 32
 *
 * If the env var is missing, we fall back to storing/reading plaintext so the
 * feature still works on dev without setup. In production, the env var MUST be set.
 */
import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12; // 96-bit IV — standard for GCM

function getEncryptionKey(): Buffer | null {
  const hex = process.env.TWILIO_SETTINGS_ENCRYPTION_KEY?.trim();
  if (!hex || hex.length !== 64) {
    if (process.env.NODE_ENV === "production") {
      console.warn("[twilioEncryption] TWILIO_SETTINGS_ENCRYPTION_KEY is missing or invalid in production!");
    }
    return null;
  }
  return Buffer.from(hex, "hex");
}

/** Returns an encrypted token prefixed with "enc:" so we can detect it later. */
export function encryptTwilioAuthToken(plaintext: string): string {
  const key = getEncryptionKey();
  if (!key) return plaintext; // Dev fallback: store plaintext

  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  // Format: enc:<iv_hex>:<tag_hex>:<ciphertext_hex>
  return `enc:${iv.toString("hex")}:${tag.toString("hex")}:${encrypted.toString("hex")}`;
}

/** Decrypts a token that was encrypted with encryptTwilioAuthToken. Falls back to returning raw value if not prefixed. */
export function decryptTwilioAuthToken(stored: string): string {
  if (!stored.startsWith("enc:")) return stored; // Plaintext fallback

  const key = getEncryptionKey();
  if (!key) {
    throw new Error("[twilioEncryption] Cannot decrypt — TWILIO_SETTINGS_ENCRYPTION_KEY is not set.");
  }

  const parts = stored.slice(4).split(":");
  if (parts.length !== 3) throw new Error("[twilioEncryption] Malformed encrypted token.");

  const [ivHex, tagHex, ciphertextHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const ciphertext = Buffer.from(ciphertextHex, "hex");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  return decipher.update(ciphertext).toString("utf8") + decipher.final("utf8");
}
