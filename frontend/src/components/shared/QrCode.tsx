import { useEffect, useState } from "react"
import QRCode from "qrcode"
import { Loader2 } from "lucide-react"

type QrCodeProps = {
  // The otpauth:// URI an authenticator app scans -- generated per-enrollment
  // by AuthService.startTwoFactorEnrollment (see candidateApi/recruiterApi/
  // AdminApi's start2FAEnrollment). Rendered entirely client-side via the
  // "qrcode" package (no network call, no third-party service) since this
  // string embeds the account's real TOTP secret -- it must never leave the
  // browser.
  value: string
  size?: number
  className?: string
}

// 2FA enrollment previously only showed the manual-entry secret and the raw
// otpauth URI as plain text -- functional (any authenticator app can add an
// account by typing the secret in by hand), but every other app's 2FA setup
// screen leads with "scan this QR code" for a reason: it's faster and far
// less error-prone than transcribing a 32-character Base32 string correctly.
export function QrCode({ value, size = 176, className }: QrCodeProps) {
  const [dataUrl, setDataUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    setDataUrl(null)
    setFailed(false)

    if (!value) return

    QRCode.toDataURL(value, {
      width: size,
      margin: 1,
      color: { dark: "#0f172a", light: "#ffffff" },
    })
      .then((url) => {
        if (!cancelled) setDataUrl(url)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })

    return () => {
      cancelled = true
    }
  }, [value, size])

  if (failed) {
    // Manual entry (the secret shown alongside this component) still works
    // as a complete fallback, so a QR-generation hiccup never blocks
    // enrollment -- just quietly omit the image.
    return null
  }

  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-white p-2 dark:border-slate-700"
      style={{ width: size + 16, height: size + 16 }}
    >
      {dataUrl ? (
        <img src={dataUrl} alt="Scan with your authenticator app" width={size} height={size} className={className} />
      ) : (
        <Loader2 className="size-6 animate-spin text-slate-400" />
      )}
    </div>
  )
}

export default QrCode
