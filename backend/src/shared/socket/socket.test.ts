// Final Implementation Pass, Part 6: focused tests for the Socket.IO Redis
// adapter attachment logic in socket.ts. These exercise the branching added
// around `io.adapter(createAdapter(pubClient, subClient))` without spinning
// up a real network connection to Upstash (unavailable in this sandbox --
// see the project's documented Prisma/Redis sandbox network limitation).
// socket.io's Server and @socket.io/redis-adapter's createAdapter are both
// mocked so we can assert on *which branch ran* and what socketAdapterStatus
// ends up as, independent of real network reachability.

const mockAdapterFn = jest.fn()
const mockNamespace = {
  use: jest.fn(),
  on: jest.fn(),
  to: jest.fn(() => ({ except: jest.fn(() => ({ emit: jest.fn() })) })),
}

jest.mock("socket.io", () => ({
  __esModule: true,
  Server: jest.fn().mockImplementation(() => ({
    adapter: mockAdapterFn,
    of: jest.fn(() => mockNamespace),
  })),
}))

const mockCreateAdapter = jest.fn(() => "MOCK_REDIS_ADAPTER")
jest.mock("@socket.io/redis-adapter", () => ({
  __esModule: true,
  createAdapter: mockCreateAdapter,
}))

jest.mock("../database/db", () => ({
  __esModule: true,
  default: {},
  prisma: {},
}))

describe("initSocket -- Redis adapter attachment (Part 6)", () => {
  const fakeHttpServer = {} as any

  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
  })

  function mockEnv(nodeEnv: string) {
    jest.doMock("../config/env", () => ({
      __esModule: true,
      default: {
        NODE_ENV: nodeEnv,
        JWT_ACCESS_SECRET: "test-secret",
        CLIENT_URL: "http://localhost:5173",
        FRONTEND_URL: "http://localhost:3000",
      },
    }))
  }

  it("attaches the Redis adapter when running outside test mode with a real Redis client available", () => {
    mockEnv("production")
    const mockPubClient = { on: jest.fn() }
    const mockSubClient = { on: jest.fn() }
    const duplicate = jest.fn().mockReturnValueOnce(mockPubClient).mockReturnValueOnce(mockSubClient)
    jest.doMock("../utils/redis", () => ({
      __esModule: true,
      default: { duplicate, status: "ready" },
    }))

    const { initSocket, socketAdapterStatus } = require("./socket")
    initSocket(fakeHttpServer)

    expect(duplicate).toHaveBeenCalledTimes(2)
    expect(mockCreateAdapter).toHaveBeenCalledWith(mockPubClient, mockSubClient)
    expect(mockAdapterFn).toHaveBeenCalledWith("MOCK_REDIS_ADAPTER")
    // Re-read the live binding after initSocket has mutated it.
    expect(require("./socket").socketAdapterStatus).toBe("redis")
  })

  it("registers error handlers on both the pub and sub clients (so a connection drop never crashes the process)", () => {
    mockEnv("production")
    const mockPubClient = { on: jest.fn() }
    const mockSubClient = { on: jest.fn() }
    const duplicate = jest.fn().mockReturnValueOnce(mockPubClient).mockReturnValueOnce(mockSubClient)
    jest.doMock("../utils/redis", () => ({
      __esModule: true,
      default: { duplicate, status: "ready" },
    }))

    const { initSocket } = require("./socket")
    initSocket(fakeHttpServer)

    expect(mockPubClient.on).toHaveBeenCalledWith("error", expect.any(Function))
    expect(mockSubClient.on).toHaveBeenCalledWith("error", expect.any(Function))
  })

  it("does not attempt to attach the Redis adapter in test mode", () => {
    mockEnv("test")
    const duplicate = jest.fn()
    jest.doMock("../utils/redis", () => ({
      __esModule: true,
      default: { duplicate, status: "ready" },
    }))

    const { initSocket } = require("./socket")
    initSocket(fakeHttpServer)

    expect(duplicate).not.toHaveBeenCalled()
    expect(mockCreateAdapter).not.toHaveBeenCalled()
    expect(mockAdapterFn).not.toHaveBeenCalled()
    expect(require("./socket").socketAdapterStatus).toBe("memory")
  })

  it("falls back to an error status (in-memory adapter, no cross-instance fanout) when no Redis client is available outside test mode", () => {
    mockEnv("production")
    jest.doMock("../utils/redis", () => ({
      __esModule: true,
      default: null,
    }))

    const { initSocket } = require("./socket")
    initSocket(fakeHttpServer)

    expect(mockCreateAdapter).not.toHaveBeenCalled()
    expect(mockAdapterFn).not.toHaveBeenCalled()
    expect(require("./socket").socketAdapterStatus).toBe("error")
  })

  it("falls back to an error status when attaching the adapter throws", () => {
    mockEnv("production")
    jest.doMock("../utils/redis", () => ({
      __esModule: true,
      default: {
        duplicate: jest.fn(() => {
          throw new Error("ECONNREFUSED")
        }),
        status: "ready",
      },
    }))

    const { initSocket } = require("./socket")
    initSocket(fakeHttpServer)

    expect(mockAdapterFn).not.toHaveBeenCalled()
    expect(require("./socket").socketAdapterStatus).toBe("error")
  })
})
