/**
 * Simple encryption for account passwords.
 * Uses AES-256-GCM with key from env.
 */
import * as crypto from "node:crypto";

const ALG = "aes-256-gcm";
const IV_LEN = 16;
const KEY_LEN = 32;

function getKey(): Buffer {
	const secret = process.env.ENCRYPTION_SECRET || "dev-secret-change-in-production-32bytes!!";
	const hash = crypto.createHash("sha256").update(secret).digest();
	return hash.subarray(0, KEY_LEN);
}

export function encrypt(text: string): string {
	const iv = crypto.randomBytes(IV_LEN);
	const cipher = crypto.createCipheriv(ALG, getKey(), iv);
	let enc = cipher.update(text, "utf8", "base64");
	enc += cipher.final("base64");
	const tag = cipher.getAuthTag();
	return `${iv.toString("base64")}:${tag.toString("base64")}:${enc}`;
}

export function decrypt(encrypted: string): string {
	const [ivB64, tagB64, enc] = encrypted.split(":");
	if (!ivB64 || !tagB64 || !enc) {
		throw new Error("Invalid encrypted format");
	}
	const iv = Buffer.from(ivB64, "base64");
	const tag = Buffer.from(tagB64, "base64");
	const decipher = crypto.createDecipheriv(ALG, getKey(), iv);
	decipher.setAuthTag(tag);
	return decipher.update(enc, "base64", "utf8") + decipher.final("utf8");
}
