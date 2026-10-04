import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

export const hashKey = (key: string) => createHash("sha256").update(key).digest("hex");
export class DeviceKeys {
  private readonly secret: Buffer;
  constructor(base64: string) {
    this.secret = Buffer.from(base64, "base64");
    if (this.secret.length !== 32) throw new Error("Device key encryption requires 32 bytes.");
  }
  issue(plantId: string) {
    const key = `grove_device_${randomBytes(32).toString("base64url")}`;
    return { key, hash: hashKey(key), encrypted: this.encrypt(key, plantId) };
  }
  private encrypt(key: string, plantId: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", this.secret, iv);
    cipher.setAAD(Buffer.from(plantId));
    const data = Buffer.concat([cipher.update(key, "utf8"), cipher.final()]);
    return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), data.toString("base64url")].join(".");
  }
  decrypt(encrypted: string, plantId: string) {
    const [version, iv, tag, data] = encrypted.split(".");
    if (version !== "v1" || !iv || !tag || !data) throw new Error("Unsupported encrypted device key.");
    const cipher = createDecipheriv("aes-256-gcm", this.secret, Buffer.from(iv, "base64url"));
    cipher.setAAD(Buffer.from(plantId));
    cipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([cipher.update(Buffer.from(data, "base64url")), cipher.final()]).toString("utf8");
  }
}
