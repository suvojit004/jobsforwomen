// Direct unit tests of the receipt tracker itself (no HTTP/Express layer --
// see admin.test.ts's "DELETE /admins/audits" describe block for the wiring
// tests, which mock this module entirely for deterministic control). Redis
// mocked to null so every call exercises the in-memory fallback path.
jest.mock("./redis", () => ({ redis: null, default: null }))

import {
  recordAuditExportReceipt,
  hasRecentAuditExportReceipt,
  clearAuditExportReceipt,
} from "./auditExportReceipt"

describe("auditExportReceipt (server-side export-before-delete enforcement)", () => {
  let counter = 0
  function uniqueAdminId() {
    counter++
    return `admin-receipt-${counter}`
  }

  it("has no receipt for an admin who has never exported", async () => {
    const adminId = uniqueAdminId()
    expect(await hasRecentAuditExportReceipt(adminId)).toBe(false)
  })

  it("records a receipt that is then found", async () => {
    const adminId = uniqueAdminId()
    await recordAuditExportReceipt(adminId)
    expect(await hasRecentAuditExportReceipt(adminId)).toBe(true)
  })

  it("does not leak a receipt across different admins", async () => {
    const adminA = uniqueAdminId()
    const adminB = uniqueAdminId()
    await recordAuditExportReceipt(adminA)
    expect(await hasRecentAuditExportReceipt(adminB)).toBe(false)
  })

  it("clearAuditExportReceipt makes a subsequent check fail again", async () => {
    const adminId = uniqueAdminId()
    await recordAuditExportReceipt(adminId)
    expect(await hasRecentAuditExportReceipt(adminId)).toBe(true)

    await clearAuditExportReceipt(adminId)
    expect(await hasRecentAuditExportReceipt(adminId)).toBe(false)
  })
})
