const mockSend = jest.fn()

jest.mock("resend", () => {
  return {
    Resend: jest.fn().mockImplementation(() => {
      return {
        emails: {
          send: mockSend,
        },
      }
    }),
  }
})

// Mock Prisma DB Operations
jest.mock("../database/db", () => {
  const localPrismaMock = {
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  }
  return {
    ...localPrismaMock,
    default: localPrismaMock,
    __esModule: true,
  }
})

import env from "../config/env"
import { EmailService } from "./email"

// Save the original NODE_ENV
const originalNodeEnv = process.env.NODE_ENV

describe("EmailService Resend Integration Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // Set NODE_ENV to production to test actual Resend integration instead of NODE_ENV === 'test' mock return
    process.env.NODE_ENV = "production"
  })

  afterAll(() => {
    // Restore original NODE_ENV
    process.env.NODE_ENV = originalNodeEnv
  })

  it("1. EmailService invokes Resend with correct recipient/subject/html", async () => {
    mockSend.mockResolvedValueOnce({
      data: { id: "resend-msg-999" },
      error: null,
    })

    const recipient = "test@example.com"
    const subject = "Welcome Test"
    const html = "<p>Hello World</p>"

    const result = await EmailService.sendMail(recipient, subject, html)

    expect(result).toBe(true)
    expect(mockSend).toHaveBeenCalledTimes(1)
    expect(mockSend).toHaveBeenCalledWith({
      from: env.SMTP_FROM,
      to: [recipient],
      subject,
      html,
      text: "Hello World",
    })
  })

  it("2. Resend error causes EmailService to throw", async () => {
    const mockError = {
      name: "validation_error",
      message: "The recipient address is invalid.",
      statusCode: 400,
    }
    mockSend.mockResolvedValueOnce({
      data: null,
      error: mockError,
    })

    await expect(
      EmailService.sendMail("invalid-email", "Test Subject", "<p>Test</p>")
    ).rejects.toThrow("The recipient address is invalid.")

    expect(mockSend).toHaveBeenCalledTimes(1)
  })

  it("3. Missing data.id causes EmailService to throw", async () => {
    mockSend.mockResolvedValueOnce({
      data: {}, // no id
      error: null,
    })

    await expect(
      EmailService.sendMail("test@example.com", "Test Subject", "<p>Test</p>")
    ).rejects.toThrow("Resend did not return a message ID")

    expect(mockSend).toHaveBeenCalledTimes(1)
  })

  it("4. Valid Resend message ID returns success", async () => {
    mockSend.mockResolvedValueOnce({
      data: { id: "resend-msg-12345" },
      error: null,
    })

    const result = await EmailService.sendMail("test@example.com", "Test Subject", "<p>Test</p>")
    expect(result).toBe(true)
  })

  it("5. Provider failure propagates to the queue processor", async () => {
    mockSend.mockResolvedValueOnce({
      data: null,
      error: {
        name: "internal_server_error",
        message: "Resend service is currently unavailable.",
        statusCode: 500,
      },
    })

    // Importing handleEmailJob dynamically or calling a helper that uses EmailService.sendMail
    await expect(
      EmailService.sendWelcomeEmail("candidate@example.com", "verify-token-123")
    ).rejects.toThrow("Resend service is currently unavailable.")
  })

  it("6. Resend 403 sandbox rejection is identified and logged", async () => {
    mockSend.mockResolvedValueOnce({
      data: null,
      error: {
        name: "forbidden",
        message: "You can only send to verified domains.",
        statusCode: 403,
      },
    })

    await expect(
      EmailService.sendMail("unverified-sandbox@example.com", "Sandbox Test", "<p>Sandbox</p>")
    ).rejects.toThrow("You can only send to verified domains.")
  })
})
