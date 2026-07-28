const mockSend = jest.fn()

// Mock the SES v2 client. The commands are captured as plain objects carrying
// their input so assertions can inspect exactly what was sent to AWS.
jest.mock("@aws-sdk/client-sesv2", () => {
  class MockSendEmailCommand {
    constructor(public input: any) {}
  }
  class MockGetAccountCommand {
    constructor(public input: any) {}
  }
  return {
    SESv2Client: jest.fn().mockImplementation(() => ({ send: mockSend })),
    SendEmailCommand: MockSendEmailCommand,
    GetAccountCommand: MockGetAccountCommand,
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
import { EmailService, PermanentEmailError, verifyEmailTransport, resetTransportCheckCache } from "./email"

// Builds an error shaped like one thrown by the AWS SDK.
function awsError(name: string, message: string, httpStatusCode = 400) {
  const err: any = new Error(message)
  err.name = name
  err.$metadata = { httpStatusCode }
  return err
}

// Save the original NODE_ENV
const originalNodeEnv = process.env.NODE_ENV

describe("EmailService AWS SES Integration Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks()
    // NODE_ENV must not be "test" or sendMail short-circuits to its mock path.
    process.env.NODE_ENV = "production"
    // verifyEmailTransport() caches its result for 60s to avoid hammering
    // SES GetAccount (which has ~1 rps quota). Tests assert both the success
    // and failure paths well within that window, so the cache must be cleared
    // between them or the second assertion reads the first one's answer.
    resetTransportCheckCache()
  })

  afterAll(() => {
    process.env.NODE_ENV = originalNodeEnv
  })

  it("1. EmailService invokes SES with correct recipient/subject/html and a text alternative", async () => {
    mockSend.mockResolvedValueOnce({ MessageId: "ses-msg-999" })

    const recipient = "test@example.com"
    const subject = "Welcome Test"
    const html = "<p>Hello World</p>"

    const result = await EmailService.sendMail(recipient, subject, html)

    expect(result).toBe(true)
    expect(mockSend).toHaveBeenCalledTimes(1)

    const command = mockSend.mock.calls[0][0]
    expect(command.input.FromEmailAddress).toBe(env.SES_FROM)
    expect(command.input.Destination.ToAddresses).toEqual([recipient])
    expect(command.input.Content.Simple.Subject.Data).toBe(subject)
    expect(command.input.Content.Simple.Body.Html.Data).toBe(html)
    // Plain-text alternative is derived from the HTML, not passed in.
    expect(command.input.Content.Simple.Body.Text.Data).toBe("Hello World")
  })

  it("2. A transient SES error propagates so BullMQ can retry", async () => {
    mockSend.mockRejectedValueOnce(awsError("InternalServiceError", "SES is currently unavailable.", 500))

    await expect(
      EmailService.sendMail("someone@example.com", "Test Subject", "<p>Test</p>")
    ).rejects.toThrow("SES is currently unavailable.")

    expect(mockSend).toHaveBeenCalledTimes(1)
  })

  it("3. Missing MessageId causes EmailService to throw", async () => {
    mockSend.mockResolvedValueOnce({}) // no MessageId

    await expect(
      EmailService.sendMail("test@example.com", "Test Subject", "<p>Test</p>")
    ).rejects.toThrow("SES did not return a MessageId")

    expect(mockSend).toHaveBeenCalledTimes(1)
  })

  it("4. A valid MessageId returns success", async () => {
    mockSend.mockResolvedValueOnce({ MessageId: "ses-msg-12345" })

    const result = await EmailService.sendMail("test@example.com", "Test Subject", "<p>Test</p>")
    expect(result).toBe(true)
  })

  it("5. Provider failure propagates through the template helpers to the queue processor", async () => {
    mockSend.mockRejectedValueOnce(awsError("InternalServiceError", "SES is currently unavailable.", 500))

    await expect(
      EmailService.sendWelcomeEmail("candidate@example.com", "verify-token-123")
    ).rejects.toThrow("SES is currently unavailable.")
  })

  it("6. Sandbox MessageRejected is surfaced as a PermanentEmailError so retries are skipped", async () => {
    mockSend.mockRejectedValueOnce(
      awsError("MessageRejected", "Email address is not verified. The following identities failed the check.", 400)
    )

    // The distinction matters: the email worker converts PermanentEmailError
    // into BullMQ's UnrecoverableError, so a sandbox rejection fails once
    // instead of consuming three attempts of the daily sending quota.
    await expect(
      EmailService.sendMail("unverified@example.com", "Sandbox Test", "<p>Sandbox</p>")
    ).rejects.toBeInstanceOf(PermanentEmailError)
  })

  it("7. Throttling is treated as transient, not permanent", async () => {
    mockSend.mockRejectedValueOnce(awsError("TooManyRequestsException", "Maximum sending rate exceeded.", 429))

    const promise = EmailService.sendMail("test@example.com", "Rate Test", "<p>Rate</p>")
    await expect(promise).rejects.toThrow("Maximum sending rate exceeded.")
    await expect(promise).rejects.not.toBeInstanceOf(PermanentEmailError)
  })

  it("8. A configuration set is only attached when one is configured", async () => {
    mockSend.mockResolvedValueOnce({ MessageId: "ses-msg-cfg" })

    await EmailService.sendMail("test@example.com", "Config Test", "<p>Config</p>")

    const command = mockSend.mock.calls[0][0]
    if (env.SES_CONFIGURATION_SET) {
      expect(command.input.ConfigurationSetName).toBe(env.SES_CONFIGURATION_SET)
    } else {
      // Must be absent rather than empty -- SES rejects an unknown/blank name.
      expect(command.input).not.toHaveProperty("ConfigurationSetName")
    }
  })

  it("9. verifyEmailTransport reports success without sending an email", async () => {
    mockSend.mockResolvedValueOnce({
      ProductionAccessEnabled: false,
      SendQuota: { Max24HourSend: 240, MaxSendRate: 1, SentLast24Hours: 12 },
    })

    await expect(verifyEmailTransport()).resolves.toBe(true)

    // GetAccount, not SendEmail -- the check must not consume sending quota.
    const command = mockSend.mock.calls[0][0]
    expect(command.constructor.name).toBe("MockGetAccountCommand")
  })

  it("10. verifyEmailTransport reports failure when SES is unreachable", async () => {
    mockSend.mockRejectedValueOnce(awsError("CredentialsProviderError", "Could not load credentials", 403))

    await expect(verifyEmailTransport()).resolves.toBe(false)
  })
})
