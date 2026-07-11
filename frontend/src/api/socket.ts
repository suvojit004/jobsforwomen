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
