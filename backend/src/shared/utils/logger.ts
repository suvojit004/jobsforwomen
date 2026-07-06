import winston from "winston"

const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4,
}

const colors = {
  error: "red",
  warn: "yellow",
  info: "green",
  http: "magenta",
  debug: "white",
}

winston.addColors(colors)

import { getCorrelationId } from "./correlationContext"

const format = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.colorize({ all: true }),
  winston.format.printf((info: any) => {
    const meta = { ...info }
    delete meta.timestamp
    delete meta.level
    delete meta.message
    const correlationId = getCorrelationId()
    const cidPrefix = correlationId ? ` [CID: ${correlationId}]` : ""
    const metaString = Object.keys(meta).length ? ` | Meta: ${JSON.stringify(meta)}` : ""
    return `[${info.timestamp}] [${info.level}]${cidPrefix}: ${info.message}${metaString}`
  })
)

const transports: winston.transport[] = [
  new winston.transports.Console(),
]

if (process.env.NODE_ENV !== "test") {
  transports.push(
    new winston.transports.File({
      filename: "logs/error.log",
      level: "error",
    }),
    new winston.transports.File({ filename: "logs/combined.log" })
  )
}

export const logger = winston.createLogger({
  level: process.env.NODE_ENV === "development" ? "debug" : "info",
  levels,
  format,
  transports,
})

export default logger
