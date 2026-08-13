export const EMAIL_REGEX = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i
export const PHONE_REGEX = /^\+?[0-9]{10,14}$/

// Requires at least one letter and one number alongside the existing
// 8-character minimum used across every password field in the app -- length
// alone (the previous rule everywhere, frontend and backend) lets through
// weak passwords like "aaaaaaaa" or "11111111".
export const PASSWORD_MIN_LENGTH = 8
export const PASSWORD_COMPLEXITY_REGEX = /^(?=.*[A-Za-z])(?=.*\d).+$/
export const PASSWORD_HELP_TEXT = "At least 8 characters, including one letter and one number."

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email)
}

export function isValidPhone(phone: string): boolean {
  return PHONE_REGEX.test(phone.replace(/[\s-]/g, ""))
}

export function isValidPassword(password: string): boolean {
  return password.length >= PASSWORD_MIN_LENGTH && PASSWORD_COMPLEXITY_REGEX.test(password)
}

// Backend `.url()` checks (e.g. onboardCompanySchema, resubmitCompanySchema)
// require a full URL with protocol, but every website field's placeholder
// text suggests a bare domain ("e.g. company.com") -- so a user who follows
// the placeholder literally gets a valid-looking bare domain that the
// backend rejects on submit. Normalize first, then validate the result.
export function normalizeWebsite(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return trimmed
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`
}

// Used by the Current CTC field -- strips everything but digits and a
// single decimal point as the user types, so free-text values like
// "15LPA" or "15,00,000" can no longer be entered/saved. Keeps at most one
// "." (typing a second one is simply dropped) so "15.5.2" can't happen.
export function sanitizeNumeric(value: string): string {
  const cleaned = value.replace(/[^\d.]/g, "")
  const firstDot = cleaned.indexOf(".")
  if (firstDot === -1) return cleaned
  return cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, "")
}

export function isValidWebsite(value: string): boolean {
  if (!value.trim()) return false
  try {
    const url = new URL(normalizeWebsite(value))
    // Require an actual dot in the hostname (rejects "https://a" passing
    // URL's lenient parser as a "valid" URL with no real domain).
    return url.hostname.includes(".")
  } catch {
    return false
  }
}
