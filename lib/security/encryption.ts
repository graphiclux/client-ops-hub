import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";
import { env, requireEnv } from "@/lib/env";

const KEY_LENGTH = 32;
const IV_LENGTH = 12;

function getMasterKey() {
  const key = Buffer.from(requireEnv("MASTER_KEY"), "base64");
  if (key.length !== KEY_LENGTH) {
    throw new Error("MASTER_KEY must be 32 bytes base64");
  }
  return key;
}

export function encryptValue(plaintext: string) {
  const iv = randomBytes(IV_LENGTH);
  const key = getMasterKey();
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(env.APP_ENCRYPTION_AAD));

  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${iv.toString("base64")}.${tag.toString("base64")}.${encrypted.toString("base64")}`;
}

export function decryptValue(ciphertext: string) {
  const [ivRaw, tagRaw, dataRaw] = ciphertext.split(".");
  if (!ivRaw || !tagRaw || !dataRaw) {
    throw new Error("Malformed ciphertext");
  }

  const iv = Buffer.from(ivRaw, "base64");
  const tag = Buffer.from(tagRaw, "base64");
  const data = Buffer.from(dataRaw, "base64");
  const key = getMasterKey();

  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAAD(Buffer.from(env.APP_ENCRYPTION_AAD));
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([decipher.update(data), decipher.final()]);
  return decrypted.toString("utf8");
}