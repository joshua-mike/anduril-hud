import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, SessionRateLimit, SessionUsage, ThemeSetArgs } from 'claude-code'

import type { FableReading, Gauge, Telemetry } from '../types'
import { makeColors } from './make-colors.js'
import { SCENE } from './scene'

// ── Look ─────────────────────────────────────────────────────────────────────
const LINK_BLUE = '#58A6FF'
const AMBER = '#F2B33D'
const RED = '#FF5A47'
const DIM = '#3A3A36'
const BONE = '#D8D8D4'
const ASH = '#B0B0A9'

const { theme, problems } = makeColors({
  label: 'Anduril HUD',
  only: 'dark',
  roles: { accent: LINK_BLUE, danger: RED, success: '#5FD38D', warning: AMBER, pro: '#8FB8FF' },
  dark: {
    gray: {
      anchors: {
        'surface-0': '#000000',
        'surface-1': '#0b0b0a',
        'surface-2': '#121211',
        'surface-3': '#181816',
        'text-primary': '#ffffff',
        'text-secondary': BONE,
        'text-muted': ASH,
      },
    },
  },
})

const LOOK: ThemeSetArgs = {
  colors: theme,
  backdrop: { scene: 'orbit', glass: { blur: 18, opacity: 0.55 } },
}

// ── State ────────────────────────────────────────────────────────────────────
const telemetry = atom({ plugin: 'anduril-hud', key: 'telemetry' } as const, null)
const nowAtom = atom({ plugin: 'anduril-hud', key: 'now' } as const, 0)
const fableAtom = atom({ plugin: 'anduril-hud', key: 'fable' } as const, null)

// ── Fable feed ───────────────────────────────────────────────────────────────
// Protections:
// - The URL is fixed here and the request only ever goes to Anthropic.
// - The sign-in never enters this module: $.session.authorize() gives an opaque
//   handle, and Claude Code adds the credential header itself, only for its own hosts.
// - Nothing about a request (headers, body, errors) is ever logged or written:
//   the shared file holds the percentage, the reset time and when it was fetched.
const USAGE_URL = 'https://api.anthropic.com/api/oauth/usage?skip_spend=1'
const FETCH_EVERY_MS = 3 * 60_000
const READ_FILE_EVERY_MS = 60_000

const isFable = (model: string | undefined) => model !== undefined && /fable/i.test(model)

type Limit = { kind?: string; percent?: number; resets_at?: string; scope?: { model?: { display_name?: string } } | null }

function parseFable(text: string, fetchedAt: number): FableReading | null {
  try {
    const limits = (JSON.parse(text) as { limits?: Limit[] }).limits ?? []
    const hit = limits.find(l => l.kind === 'weekly_scoped' && /fable/i.test(l.scope?.model?.display_name ?? ''))
    return hit && typeof hit.percent === 'number' ? { percent: hit.percent, resetsAt: hit.resets_at, fetchedAt } : null
  } catch {
    return null
  }
}

function asReading(text: string): FableReading | null {
  try {
    const r = JSON.parse(text) as Partial<FableReading>
    return typeof r.percent === 'number' && typeof r.fetchedAt === 'number'
      ? { percent: r.percent, resetsAt: typeof r.resetsAt === 'string' ? r.resetsAt : undefined, fetchedAt: r.fetchedAt }
      : null
  } catch {
    return null
  }
}

async function fableFile($: EngineInterface) {
  const home = (await $.env.get('USERPROFILE')) ?? (await $.env.get('HOME'))
  return home ? `${home}/.claude/anduril-hud/fable-usage.json` : undefined
}

async function showFable($: EngineInterface, r: FableReading) {
  const prev = await read($, fableAtom)
  if (!prev || prev.fetchedAt < r.fetchedAt) await update($, fableAtom, () => r)
}

function gauge(limits: SessionRateLimit[], test: (kind: string) => boolean): Gauge | undefined {
  const hit = limits.find(l => test(l.kind))
  return hit ? { percent: hit.percentUsed, resetsAt: hit.resetsAt } : undefined
}

function toTelemetry(u: Pick<SessionUsage, 'context' | 'rateLimits'>): Telemetry {
  const rl = u.rateLimits
  return {
    contextTokens: u.context.tokens,
    contextWindow: u.context.window,
    contextPercent: u.context.percent,
    fiveHour: gauge(rl, k => k === 'five_hour'),
    weekly: gauge(rl, k => k === 'seven_day'),
    fable: gauge(rl, k => /fable/i.test(k)),
  }
}

async function publish($: EngineInterface, next: Telemetry) {
  const prev = await read($, telemetry)
  if (JSON.stringify(prev) !== JSON.stringify(next)) await update($, telemetry, () => next)
}

// ── Formatting ───────────────────────────────────────────────────────────────
function tone(p: number | undefined) {
  if (p === undefined) return ASH
  return p >= 90 ? RED : p >= 70 ? AMBER : LINK_BLUE
}

function bar(p: number | undefined, cells = 12) {
  const n = p === undefined ? 0 : Math.max(0, Math.min(cells, Math.round((p / 100) * cells)))
  return { on: '▰'.repeat(n), off: '▱'.repeat(cells - n) }
}

function kTokens(n: number) {
  return n >= 1_000_000 ? `${+(n / 1_000_000).toFixed(2)}M` : `${Math.round(n / 1000)}K`
}

function countdown(iso: string | undefined, now: number) {
  if (!iso || !now) return ''
  const ms = Date.parse(iso) - now
  if (!Number.isFinite(ms)) return ''
  if (ms <= 0) return 'T-0'
  const m = Math.floor(ms / 60000)
  const d = Math.floor(m / 1440)
  const h = Math.floor((m % 1440) / 60)
  return d > 0 ? `T-${d}D${String(h).padStart(2, '0')}H` : `T-${h}H${String(m % 60).padStart(2, '0')}M`
}

function pct(p: number | undefined) {
  return p === undefined ? '--%' : `${Math.round(p)}%`.padStart(4, ' ')
}

let model: string | undefined
let lastFetch = 0
let fetching = false

// Only a session running Fable asks the server; any session shows the last reading.
async function fetchFable($: EngineInterface, force = false) {
  if (!isFable(model) || fetching) return
  const t = await $.clock.now()
  // A few seconds' slack so the 3-minute timer's own drift never skips a period.
  if (!force && t - lastFetch < FETCH_EVERY_MS - 10_000) return
  fetching = true
  lastFetch = t
  try {
    const auth = await $.session.authorize()
    if (!auth) return
    const res = await $.http.fetch(USAGE_URL, {
      auth: auth.handle,
      headers: { 'anthropic-beta': 'oauth-2025-04-20' },
    })
    if (!res.ok) return
    const r = parseFable(res.text, t)
    if (!r) return
    await showFable($, r)
    const path = await fableFile($)
    if (path) await $.fs.write(path, JSON.stringify(r))
  } catch {
    // stay quiet: the next period tries again
  } finally {
    fetching = false
  }
}

async function readFableFile($: EngineInterface) {
  try {
    const path = await fableFile($)
    if (!path) return
    const r = asReading(String(await $.fs.read(path)))
    if (r) await showFable($, r)
  } catch {
    // no file yet: no Fable session has fetched
  }
}

function setModel($: EngineInterface, m: string | undefined) {
  if (!m || m === model) return
  model = m
  if (isFable(m)) void fetchFable($)
}

// ── Mod ──────────────────────────────────────────────────────────────────────
export const register: Register = on => {
  let stop: (() => void) | undefined
  on('classic.SessionStart', ($, e, next) => {
    setModel($, e.model)
    return next(e)
  })

  on('classic.PostModelSwitch', ($, e, next) => {
    setModel($, e.to_model)
    return next(e)
  })

  on('session.start', async ($, e, next) => {
    const unpainted = problems.find(line => line.startsWith("Desktop won't paint"))
    if (unpainted !== undefined) $.ui.toast(unpainted)
    await $.theme.set(LOOK)

    const poll = async () => {
      try {
        await publish($, toTelemetry(await $.session.usage()))
        const t = await $.clock.now()
        const minute = Math.floor(t / 60000) * 60000
        if ((await read($, nowAtom)) !== minute) await update($, nowAtom, () => minute)
      } catch {
        // a missed poll is caught by the next one
      }
    }
    await poll()
    await readFableFile($)
    stop?.()
    const timers = [
      $.clock.every(2000, () => void poll()),
      $.clock.every(FETCH_EVERY_MS, () => void fetchFable($)),
      $.clock.every(READ_FILE_EVERY_MS, () => void readFableFile($)),
    ]
    stop = () => timers.forEach(timer => timer.cancel())

    return next(e)
  })

  // Pushed by the engine after each turn and whenever a limit moves a whole point.
  on('session.measure', async ($, e, next) => {
    await publish($, toTelemetry(e))
    return next(e)
  })

  // Context grows with every model step inside a turn: refresh right away.
  on('turn.step', async function* ($, e, next) {
    if (e.agentId === undefined) setModel($, e.model)
    const out = yield* next(e)
    try {
      await publish($, toTelemetry(await $.session.usage()))
    } catch {}
    return out
  })

  on('session.end', ($, e, next) => {
    stop?.()
    stop = undefined
    return next(e)
  })

  on('ui.render', { component: 'Backdrop' }, ($, e, next) => {
    if (e.surface !== 'desktop' && e.surface !== 'mobile') return next(e)
    const { Svg } = $.ui.resolve(e)
    return <Svg source={SCENE} alt="A planet limb with two satellites tracing slow orbits over a starfield, with an occasional shooting star" />
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const t = await read($, telemetry)
    const now = await read($, nowAtom)
    const fable = await read($, fableAtom)
    const fableP = fable?.percent ?? t?.fable?.percent
    const ageMin = fable && now ? Math.floor((now - fable.fetchedAt) / 60000) : 0
    const age = ageMin >= 5 ? (ageMin >= 120 ? ` ${Math.floor(ageMin / 60)}H OLD` : ` ${ageMin}M OLD`) : ''
    const fableDetail = fable
      ? `${countdown(fable.resetsAt, now)}${age}`
      : t?.fable
        ? countdown(t.fable.resetsAt, now)
        : 'AWAITING FABLE SESSION'
    const { Box, Text } = $.ui.resolve(e)

    const Label = ({ children }: { children: string }) => (
      <Text mono size="caption" color={ASH}>
        {children}
      </Text>
    )

    const Meter = (props: { name: string; p?: number; detail?: string }) => {
      const b = bar(props.p)
      const c = tone(props.p)
      return (
        <Box flexDirection="row" gap={1} alignItems="center">
          {Label({ children: props.name })}
          <Text mono size="caption">
            <Text mono size="caption" color={c}>{b.on}</Text>
            <Text mono size="caption" color={DIM}>{b.off}</Text>
          </Text>
          <Text mono tabular size="caption" weight="semibold" color={props.p === undefined ? ASH : '#ffffff'}>
            {pct(props.p)}
          </Text>
          {props.detail ? (
            <Text mono size="caption" color={ASH}>
              {props.detail}
            </Text>
          ) : null}
        </Box>
      )
    }

    const ctxDetail =
      t?.contextTokens !== undefined ? `${kTokens(t.contextTokens)}/${kTokens(t.contextWindow)}` : t ? `—/${kTokens(t.contextWindow)}` : ''

    return (
      <Box flexDirection="row" flexWrap="wrap" columnGap={3} rowGap={0} alignItems="center" paddingX={1}>
        <Box flexDirection="row" gap={1} alignItems="center">
          <Text mono size="caption" color={e.props.isWorking ? LINK_BLUE : ASH}>
            {e.props.isWorking ? '◉' : '○'}
          </Text>
          <Text mono size="caption" weight="semibold" color="#ffffff">
            [ TELEMETRY ]
          </Text>
        </Box>
        {Meter({ name: "CTX", p: t?.contextPercent, detail: ctxDetail })}
        {Meter({ name: "5H", p: t?.fiveHour?.percent, detail: countdown(t?.fiveHour?.resetsAt, now) })}
        {Meter({ name: "WEEK", p: t?.weekly?.percent, detail: countdown(t?.weekly?.resetsAt, now) })}
        {Meter({ name: "FABLE", p: fableP, detail: fableDetail })}
      </Box>
    )
  })
}
