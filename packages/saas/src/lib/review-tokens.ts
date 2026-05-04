import crypto from "crypto";

export function generateAccessToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function getExpirationDate(days = 7): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}
