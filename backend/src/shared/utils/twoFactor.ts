import crypto from "crypto"
import jwt from "jsonwebtoken"
import env from "../config/env"

// Real TOTP (RFC 6238, built on the RFC 4226 HOTP algorithm) implemented
// directly on Node's built-in `crypto` -- no otplib/speakeasy dependency.
// Standard defaults (SHA-1, 6 digits, 30s step) match what every common
// authenticator app (Google Authenticator, Authy, 1Password, etc.) expects
// out of the box.

const TOTP_STEP_SECONDS = 30
const TOTP_DIGITS = 6
const TOTP_WINDOW_STEPS = 1 // tolerate +/- 30s of clock drift between server and device

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"

function base32Encode(buffer: Buffer): string {
  let bits = 0
  let value = 0
  let output = ""
  for (const byte of buffer) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31]
  }
  return output
}

function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[^A-Z2-7]/g, "")
  let bits = 0
  let value = 0
  const bytes: number[] = []
  for (const char of clean) {
    const idx = BASE32_ALPHABET.indexOf(char)
    if (idx === -1) continue
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff)
      bits -= 8
    }
  }
  return Buffer.from(bytes)
}

// 160-bit (20-byte) secret -- the standard size for SHA-1-based TOTP, same
// as what Google Authenticator itself generates.
export function generateTotpSecret(): string {
  return base32Encode(crypto.randomBytes(20))
}

function hotp(secretBuffer: Buffer, counter: number): string {
  const counterBuffer = Buffer.alloc(8)
  counterBuffer.writeBigInt64BE(BigInt(counter))
  const hmac = crypto.createHmac("sha1", secretBuffer).update(counterBuffer).digest()
  const offset = hmac[hmac.length - 1] & 0xf
  const binary =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff)
  const otp = binary % 10 ** TOTP_DIGITS
  return otp.toString().padStart(TOTP_DIGITS, "0")
}

// Computes the current (or a specific instant's) 6-digit code for a secret.
// Exported as a general utility, not just for tests -- useful anywhere the
// server itself needs to know "what code would be valid right now" (e.g. a
// future admin-side support tool), though nothing currently calls it
// outside test coverage.
export function generateTotpToken(base32Secret: string, atTimeMs: number = Date.now()): string {
  const counter = Math.floor(atTimeMs / 1000 / TOTP_STEP_SECONDS)
  return hotp(base32Decode(base32Secret), counter)
}

export function verifyTotpToken(base32Secret: string, token: string): boolean {
  const cleanToken = (token || "").replace(/\s+/g, "")
  if (!/^\d{6}$/.test(cleanToken)) return false

  const secretBuffer = base32Decode(base32Secret)
  const nowCounter = Math.floor(Date.now() / 1000 / TOTP_STEP_SECONDS)
  const tokenBuffer = Buffer.from(cleanToken)

  for (let drift = -TOTP_WINDOW_STEPS; drift <= TOTP_WINDOW_STEPS; drift++) {
    const candidate = Buffer.from(hotp(secretBuffer, nowCounter + drift))
    // Constant-time compare -- avoids leaking which digit differs first via
    // response timing.
    if (candidate.length === tokenBuffer.length && crypto.timingSafeEqual(candidate, tokenBuffer)) {
      return true
    }
  }
  return false
}

export function buildOtpAuthUri(base32Secret: string, accountEmail: string, issuer = "JobsForWomen"): string {
  const label = encodeURIComponent(`${issuer}:${accountEmail}`)
  const params = new URLSearchParams({
    secret: base32Secret,
    issuer,
    algorithm: "SHA1",
    digits: String(TOTP_DIGITS),
    period: String(TOTP_STEP_SECONDS),
  })
  return `otpauth://totp/${label}?${params.toString()}`
}

// --- Secret-at-rest encryption -------------------------------------------
// AES-256-GCM, key derived from JWT_ACCESS_SECRET via scrypt with a
// feature-specific salt -- deliberately not a new required env var. This
// isn't a real password hash (it must be reversible to check codes), so
// storing the base32 secret in plaintext would mean anyone with read access
// to the User table can generate valid codes forever. Deriving from an
// already-configured secret keeps this deployable without a config change.
const ENCRYPTION_KEY = crypto.scryptSync(env.JWT_ACCESS_SECRET, "2fa-secret-encryption", 32)

export function encryptTwoFactorSecret(plainBase32Secret: string): string {
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv("aes-256-gcm", ENCRYPTION_KEY, iv)
  const encrypted = Buffer.concat([cipher.update(plainBase32Secret, "utf8"), cipher.final()])
  const authTag = cipher.getAuthTag()
  return [iv.toString("base64"), authTag.toString("base64"), encrypted.toString("base64")].join(".")
}

export function decryptTwoFactorSecret(stored: string): string {
  const [ivB64, authTagB64, dataB64] = stored.split(".")
  const iv = Buffer.from(ivB64, "base64")
  const authTag = Buffer.from(authTagB64, "base64")
  const data = Buffer.from(dataB64, "base64")
  const decipher = crypto.createDecipheriv("aes-256-gcm", ENCRYPTION_KEY, iv)
  decipher.setAuthTag(authTag)
  const decrypted = Buffer.concat([decipher.update(data), decipher.final()])
  return decrypted.toString("utf8")
}

// --- Pending 2FA challenge token ------------------------------------------
// Issued by AuthService.login() when a password check succeeds but the
// account has 2FA enabled -- short-lived (5 min), and signed with a key
// DERIVED from (not equal to) JWT_ACCESS_SECRET specifically so it can
// never be mistaken for/accepted as a real access token by
// verifyAccessToken(), even though both ultimately trace back to the same
// underlying secret.
const PENDING_TOKEN_SECRET = crypto.scryptSync(env.JWT_ACCESS_SECRET, "2fa-pending-token-secret", 32).toString("hex")
const PENDING_TOKEN_EXPIRY = "5m"
const PENDING_TOKEN_PURPOSE = "2fa_pending"

export function generateTwoFactorPendingToken(userId: string): string {
  return jwt.sign({ userId, purpose: PENDING_TOKEN_PURPOSE }, PENDING_TOKEN_SECRET, {
    expiresIn: PENDING_TOKEN_EXPIRY,
  })
}

export function verifyTwoFactorPendingToken(token: string): { userId: string } | null {
  try {
    const decoded = jwt.verify(token, PENDING_TOKEN_SECRET) as any
    if (decoded?.purpose !== PENDING_TOKEN_PURPOSE || typeof decoded?.userId !== "string") {
      return null
    }
    return { userId: decoded.userId }
  } catch {
    return null
  }
}
