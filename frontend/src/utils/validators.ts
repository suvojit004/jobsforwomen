export const EMAIL_REGEX = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i
export const PHONE_REGEX = /^\+?[0-9]{10,14}$/

export function isValidEmail(email: string): boolean {
  return EMAIL_REGEX.test(email)
}

export function isValidPhone(phone: string): boolean {
  return PHONE_REGEX.test(phone.replace(/[\s-]/g, ""))
}
