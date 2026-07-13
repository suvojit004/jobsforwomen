import { io, Socket } from "socket.io-client"

let socketInstance: Socket | null = null
let currentNamespace: string | null = null

export function getSocket(namespace: "candidate" | "recruiter" | "admin"): Socket {
  const token = localStorage.getItem("jwt_token")
  const baseURL = import.meta.env.VITE_API_URL || "http://localhost:5000"

  if (socketInstance) {
    if (currentNamespace === namespace) {
      return socketInstance
    }
    socketInstance.disconnect()
  }

  currentNamespace = namespace
  socketInstance = io(`${baseURL}/${namespace}`, {
    auth: {
      token: token || "",
    },
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  })

  socketInstance.on("connect", () => {
    console.log(`[SocketIO] Connected to namespace: /${namespace}`)
  })

  socketInstance.on("connect_error", (err) => {
    console.error("[SocketIO] Connection error:", err)
  })

  return socketInstance
}

export function disconnectSocket() {
  if (socketInstance) {
    socketInstance.disconnect()
    socketInstance = null
    currentNamespace = null
  }
}

// Called after a REST token refresh succeeds (see api/client.ts) so the
// live socket connection keeps using a valid access token instead of the
// stale one it originally connected with, which the server would otherwise
// eventually reject ("jwt expired") independently of the REST session
// having already recovered.
//
// Deliberately mutates the *existing* Socket instance's `auth` and
// reconnects it, rather than disposing it and creating a brand new one via
// `io(...)`. Every caller that did `socket.on(...)` (NotificationContext,
// chat pages, etc.) holds a reference to this same object, so its listeners
// stay attached across the reconnect -- swapping in a new instance instead
// would silently orphan all of those listeners (they'd still be attached to
// the old, disconnected object) without erroring, since nothing depends on
// this function's effects re-running.
export function updateSocketToken(token: string) {
  if (!socketInstance) return
  socketInstance.auth = { token }
  if (socketInstance.connected) {
    socketInstance.disconnect()
  }
  socketInstance.connect()
}
