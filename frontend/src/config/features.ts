const DEFAULT_FLAGS = {
  CHAT_SYSTEM: true,
  WEB_SOCKETS: false,
  EMAIL_DIGESTS: true,
  ADMIN_MODERATION: true,
  RETURNSHIP_ALERTS: true,
  ANALYTICS_EXPORT: true,
  AI_RESUME_PARSER: false,
  SMS_NOTIFICATIONS: false,
  ENTERPRISE_GREENHOUSE: false,
}

export type FeatureKey = keyof typeof DEFAULT_FLAGS

const getStoredFlags = (): Record<FeatureKey, boolean> => {
  try {
    const stored = localStorage.getItem("featureFlags")
    if (stored) {
      return { ...DEFAULT_FLAGS, ...JSON.parse(stored) }
    }
  } catch (err) {
    console.error("Failed to parse stored feature flags:", err)
  }
  return { ...DEFAULT_FLAGS }
}

export const FEATURE_FLAGS = getStoredFlags()

export function isFeatureEnabled(key: FeatureKey): boolean {
  const flags = getStoredFlags()
  return flags[key] ?? false
}

export function setFeatureFlag(key: FeatureKey, value: boolean) {
  const flags = getStoredFlags()
  flags[key] = value
  localStorage.setItem("featureFlags", JSON.stringify(flags))
}
