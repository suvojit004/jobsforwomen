import { EventBus } from "./eventBus"

describe("EventBus Abstraction Unit Tests", () => {
  beforeEach(() => {
    EventBus.clearAll()
  })

  it("should successfully subscribe to and receive published events", () => {
    const mockHandler = jest.fn()
    EventBus.subscribe("TestEvent", mockHandler)

    const payload = { data: "hello" }
    EventBus.publish("TestEvent", payload)

    expect(mockHandler).toHaveBeenCalledWith(payload)
    expect(mockHandler).toHaveBeenCalledTimes(1)
  })

  it("should support unsubscribing from events", () => {
    const mockHandler = jest.fn()
    EventBus.subscribe("TestEvent", mockHandler)
    EventBus.unsubscribe("TestEvent", mockHandler)

    EventBus.publish("TestEvent", { data: "hello" })

    expect(mockHandler).not.toHaveBeenCalled()
  })

  it("should continue executing handlers even if one handler throws a synchronous error", () => {
    const badHandler = () => {
      throw new Error("Crash!")
    }
    const goodHandler = jest.fn()

    EventBus.subscribe("TestEvent", badHandler)
    EventBus.subscribe("TestEvent", goodHandler)

    EventBus.publish("TestEvent", { data: "hello" })

    expect(goodHandler).toHaveBeenCalledTimes(1)
  })
})
