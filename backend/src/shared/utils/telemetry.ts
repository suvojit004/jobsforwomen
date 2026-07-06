import { logger } from "./logger"

export class SentryAdapter {
  static init() {
    logger.info("[Telemetry:Sentry] Initialized error tracking framework adapter.")
  }

  static captureException(error: Error, metadata: any = {}) {
    logger.error(`[Telemetry:Sentry] Captured exception: ${error.message} | Meta: ${JSON.stringify(metadata)}`)
  }

  static captureMessage(message: string, level: "info" | "warning" | "error" = "info") {
    logger.info(`[Telemetry:Sentry] Captured message: ${message} (Level: ${level})`)
  }
}

export class OpenTelemetryAdapter {
  static init() {
    logger.info("[Telemetry:OpenTelemetry] Initialized tracing SDK adapter.")
  }

  static startSpan(name: string): { end: () => void } {
    const start = Date.now()
    logger.debug(`[Telemetry:OpenTelemetry] Start span: ${name}`)
    return {
      end: () => {
        const duration = Date.now() - start
        logger.debug(`[Telemetry:OpenTelemetry] End span: ${name} (Duration: ${duration}ms)`)
      },
    }
  }
}

export class PrometheusAdapter {
  private static metrics: Record<string, number> = {}

  static init() {
    logger.info("[Telemetry:Prometheus] Initialized platform exporter adapter.")
  }

  static incrementCounter(name: string, value: number = 1) {
    this.metrics[name] = (this.metrics[name] || 0) + value
    logger.debug(`[Telemetry:Prometheus] Counter '${name}' incremented by ${value}. Value: ${this.metrics[name]}`)
  }

  static observeHistogram(name: string, value: number) {
    logger.debug(`[Telemetry:Prometheus] Observed histogram '${name}' value: ${value}`)
  }
}

export default {
  SentryAdapter,
  OpenTelemetryAdapter,
  PrometheusAdapter,
}
