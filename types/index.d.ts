export type Gauge = { percent: number; resetsAt?: string }

/** The last Fable reading, shared by every session through a file. */
export type FableReading = { percent: number; resetsAt?: string; fetchedAt: number }

export type Telemetry = {
  contextTokens?: number
  contextWindow: number
  contextPercent?: number
  fiveHour?: Gauge
  weekly?: Gauge
  fable?: Gauge
}

declare module 'claude-code' {
  interface PluginState {
    'anduril-hud': {
      telemetry: Telemetry | null
      now: number
      fable: FableReading | null
    }
  }
}
