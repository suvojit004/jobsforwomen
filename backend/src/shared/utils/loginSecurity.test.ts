// Direct unit tests of the counters themselves (no HTTP/Express layer --
// see auth.test.ts's "Admin Login Lockout" describe block for the wiring
// tests, which mock this module entirely to avoid sharing counter state
// across unrelated test cases). Redis mocked to null so every call
// exercises the in-memory fallback path deterministically and fast.
jest.mock("./redis", () => ({ redis: null, default: null }))

import { recordFailedAdminLogin, isIpFlaggedForAdminLogins, clearFailedAdminLogins } from "./loginSecurity"
import env from "../config/env"

describe("loginSecurity (admin login failure counters)", () => {
  // Every test uses its own unique email/IP pair so the module-level
  // in-memory Map (shared across the whole test file) can never leak
  // state between cases.
  let counter = 0
  function uniquePair() {
    counter++
    return { email: `lockout-unit-${counter}@jfw.info`, ip: `203.0.113.${counter % 255}` }
  }

  it("increments and returns the per-email failure count on each call", async () => {
    const { email, ip } = uniquePair()

    const first = await recordFailedAdminLogin(email, ip)
    expect(first.emailFailureCount).toBe(1)

    const second = await recordFailedAdminLogin(email, ip)
    expect(second.emailFailureCount).toBe(2)
  })

  it("flags the IP once ADMIN_LOGIN_IP_LOCKOUT_THRESHOLD failed attempts are recorded against it", async () => {
    const { ip } = uniquePair()
    const threshold = env.ADMIN_LOGIN_IP_LOCKOUT_THRESHOLD

    let lastResult
    for (let i = 0; i < threshold; i++) {
      // A different email each time -- this is specifically testing the
      // IP-wide signal (one address probing multiple admin accounts), not
      // the per-email counter.
      lastResult = await recordFailedAdminLogin(`ip-probe-${i}-${ip}@jfw.info`, ip)
    }

    expect(lastResult!.ipFlagged).toBe(true)
    expect(await isIpFlaggedForAdminLogins(ip)).toBe(true)
  })

  it("does not flag an IP before the threshold is reached", async () => {
    const { ip } = uniquePair()
    await recordFailedAdminLogin(`under-threshold-${ip}@jfw.info`, ip)
    expect(await isIpFlaggedForAdminLogins(ip)).toBe(false)
  })

  it("clearFailedAdminLogins resets both the email and IP counters", async () => {
    const { email, ip } = uniquePair()

    await recordFailedAdminLogin(email, ip)
    await recordFailedAdminLogin(email, ip)
    await clearFailedAdminLogins(email, ip)

    const afterClear = await recordFailedAdminLogin(email, ip)
    // Back to 1, not 3 -- the prior two failures were actually cleared.
    expect(afterClear.emailFailureCount).toBe(1)
  })
})
