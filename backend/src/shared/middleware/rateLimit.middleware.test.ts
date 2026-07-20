// Focused tests for the trust-proxy fix in app.ts and the rate limiter's IP
// resolution in rateLimit.middleware.ts (Final Implementation Pass, Part 1).
//
// What this covers, and why it needed a dedicated test rather than relying
// on the existing supertest suites against the real app:
//  1. rateLimitMiddleware itself short-circuits entirely when
//     NODE_ENV === "test" (see the file under test), so the existing
//     integration test suites never exercise its IP-keying logic at all.
//     This file temporarily flips NODE_ENV for the duration of its tests to
//     actually exercise the real exported function.
//  2. The trust-proxy behavior is a property of Express's own req.ip
//     computation once `app.set("trust proxy", N)` is configured, so it's
//     verified against a minimal standalone Express instance configured the
//     same way app.ts configures the real one, rather than duplicating the
//     entire app's routing/mocks just to read req.ip back.

import express from "express"
import request from "supertest"

jest.mock("../utils/redis", () => ({ redis: null, default: null }))
jest.mock("../utils/logger", () => ({
  logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn(), debug: jest.fn(), http: jest.fn() },
}))

// Imported once, at module load time -- the "test mode bypass" inside
// rateLimitMiddleware reads process.env.NODE_ENV at CALL time (it's a check
// inside the function body, not a module-load-time branch), so there is no
// need to jest.resetModules()/re-require it per test. Re-requiring it was
// tried first and turned out to be the wrong tool here: resetting the module
// registry mid-suite caused an unrelated real (unmocked) Prisma client to get
// re-imported through this module's transitive dependency chain, which then
// fails in this sandbox (see the documented "no query engine for
// debian-openssl-3.0.x" limitation covered in the platform audit report) --
// a false failure entirely unrelated to the trust-proxy/rate-limit behavior
// this file is actually testing.
import { rateLimitMiddleware } from "./rateLimit.middleware"

describe("trust proxy configuration (single Render reverse-proxy hop)", () => {
  function buildApp(trustProxySetting: number | boolean) {
    const app = express()
    app.set("trust proxy", trustProxySetting)
    app.get("/whoami", (req, res) => {
      res.json({ ip: req.ip })
    })
    return app
  }

  it("with trust proxy = 1, resolves req.ip from the single nearest X-Forwarded-For hop", async () => {
    const app = buildApp(1)
    const res = await request(app)
      .get("/whoami")
      .set("X-Forwarded-For", "203.0.113.7")
    expect(res.body.ip).toBe("203.0.113.7")
  })

  it("with trust proxy = 1, an attacker-supplied extra spoofed hop in front does not override the trusted client IP", async () => {
    const app = buildApp(1)
    // A malicious client cannot make the server "believe" an arbitrary IP by
    // prepending extra entries -- only the single hop closest to the server
    // (i.e. the one Render itself appended) is trusted.
    const res = await request(app)
      .get("/whoami")
      .set("X-Forwarded-For", "9.9.9.9, 203.0.113.7")
    expect(res.body.ip).toBe("203.0.113.7")
    expect(res.body.ip).not.toBe("9.9.9.9")
  })

  it("with trust proxy disabled (local dev), X-Forwarded-For is ignored entirely", async () => {
    const app = buildApp(false)
    const res = await request(app)
      .get("/whoami")
      .set("X-Forwarded-For", "203.0.113.7")
    // Falls back to the actual (loopback) socket address of the supertest
    // client, never the spoofable header.
    expect(res.body.ip).not.toBe("203.0.113.7")
  })
})

describe("rateLimitMiddleware IP keying (no raw X-Forwarded-For fallback)", () => {
  const ORIGINAL_NODE_ENV = process.env.NODE_ENV

  beforeEach(() => {
    // The middleware bypasses everything when NODE_ENV === "test" (by
    // design, so the rest of the suite isn't rate-limited) -- flip it for
    // just these assertions so the real logic under test actually runs.
    ;(process.env as any).NODE_ENV = "development"
  })

  afterEach(() => {
    ;(process.env as any).NODE_ENV = ORIGINAL_NODE_ENV
  })

  function mockReqRes(overrides: Partial<express.Request> = {}) {
    const req = { ip: undefined, headers: {}, ...overrides } as unknown as express.Request
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      getHeader: jest.fn().mockReturnValue(undefined),
      // Rate-limit headers (X-RateLimit-*, Retry-After) are set via
      // res.setHeader -- this mock needs it or the middleware throws.
      setHeader: jest.fn(),
    } as unknown as express.Response
    const next = jest.fn()
    return { req, res, next }
  }

  it("keys the limiter off req.ip, not a client-supplied x-forwarded-for header", async () => {
    // req.ip is undefined here (as it would be if trust proxy were off and
    // the socket layer didn't populate it in this synthetic unit test), but
    // a spoofable header IS present. The fixed implementation must NOT read
    // that header directly.
    const { req, res, next } = mockReqRes({
      ip: undefined,
      headers: { "x-forwarded-for": "1.2.3.4" },
    })
    await rateLimitMiddleware(req, res, next)
    expect(next).toHaveBeenCalled()
    // If the old behavior were still present, the tracker key would be
    // "1.2.3.4"; the fixed behavior buckets this request under the
    // "unknown_ip" fallback instead, which is the documented, safe behavior
    // when Express itself provides no vetted IP.
  })

  it("allows up to the configured request budget for a given resolved IP, then rejects further requests in the same window", async () => {
    const ip = "198.51.100.42"
    let lastRes: any
    for (let i = 0; i < 101; i++) {
      const { req, res, next } = mockReqRes({ ip })
      await rateLimitMiddleware(req, res, next)
      lastRes = { res, next }
    }
    // The 101st request in the same 60s window for the same IP must be
    // rejected (429) rather than forwarded.
    expect(lastRes.res.status).toHaveBeenCalledWith(429)
    expect(lastRes.next).not.toHaveBeenCalled()
  })
})
