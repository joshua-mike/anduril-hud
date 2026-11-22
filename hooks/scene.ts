// An orbital-ops backdrop in a stark black and link-blue defense-tech idiom:
// a starfield, a faint survey grid, a planet limb in the top-right corner
// with two tilted orbits and their tracked objects, HUD brackets, and now and
// then a shooting star or a quick run of two or three.

function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

function stars(): string {
  const r = rng(7)
  let out = ''
  for (let i = 0; i < 220; i++) {
    const x = (r() * 1600).toFixed(0)
    const y = (r() * 1000).toFixed(0)
    const rad = r() < 0.92 ? 0.6 : 1.1
    const o = (0.25 + r() * 0.55).toFixed(2)
    const tw = r() < 0.18 ? ` class="tw" style="animation-delay:${(r() * 6).toFixed(1)}s"` : ''
    out += `<circle cx="${x}" cy="${y}" r="${rad}" fill="#fff" opacity="${o}"${tw}/>`
  }
  return out
}

function grid(): string {
  let out = ''
  for (let x = 0; x <= 1600; x += 80) out += `<line x1="${x}" y1="0" x2="${x}" y2="1000"/>`
  for (let y = 0; y <= 1000; y += 80) out += `<line x1="0" y1="${y}" x2="1600" y2="${y}"/>`
  return out
}

// ── Shooting stars ──────────────────────────────────────────────────────────
// An SVG scene runs no script, so the randomness is drawn when the module loads:
// a schedule of about 20 minutes of bursts (1 to 3 streaks each, at random
// places, angles and speeds), played by CSS and repeated. Each load draws a new
// sky. A streak rests hidden, so a scene shown without motion shows none.
const SKY_SECONDS = 1200

type Streak = {
  at: number // seconds into the schedule
  dur: number // seconds in flight
  dist: number // distance flown
  x: number
  y: number
  rot: number // heading in degrees, 0 = rightward, clockwise is down
  len: number // tail length
  peak: number // brightest opacity
  w: number // tail thickness
}

// The planet in the corner covers what passes behind it. In the scene's own units
// its disc sits at (1447, 135) with radius 327 (the corner svg's 800x520 box met
// into 1600x1000), so a streak starts and ends clear of it.
const clearOfPlanet = (x: number, y: number) => Math.hypot(x - 1447, y - 135) > 360

function streaks(r: () => number): { list: Streak[]; cycle: number } {
  const pick = (a: number, b: number) => a + r() * (b - a)
  const list: Streak[] = []
  let t = pick(6, 20)
  while (t < SKY_SECONDS) {
    const roll = r()
    const count = roll < 0.6 ? 1 : roll < 0.88 ? 2 : 3
    const rightward = r() < 0.5
    const slope = pick(18, 55)
    let at = t
    for (let i = 0; i < count; i++) {
      const dur = pick(0.6, 1.5)
      const dist = pick(220, 520)
      const a = slope + pick(-6, 6)
      const rot = rightward ? a : 180 - a
      const dx = Math.cos((rot * Math.PI) / 180) * dist
      const dy = Math.sin((rot * Math.PI) / 180) * dist
      let x = 0
      let y = 0
      for (let tries = 0; tries < 30; tries++) {
        x = pick(80, 1520)
        y = pick(60, 520)
        if (clearOfPlanet(x, y) && clearOfPlanet(x + dx, y + dy)) break
      }
      list.push({
        at,
        dur,
        dist,
        x,
        y,
        rot,
        len: Math.min(190, Math.max(70, (dist / dur) * 0.22)),
        peak: pick(0.5, 0.95),
        w: pick(1.1, 1.8),
      })
      at += pick(0.35, 1.8)
    }
    t = at + pick(20, 70)
  }
  return { list, cycle: t }
}

function meteors(): { css: string; svg: string } {
  const { list, cycle } = streaks(rng((Math.random() * 4294967296) >>> 0))
  const pc = (s: number) => `${((s / cycle) * 100).toFixed(4)}%`
  let css = ''
  let svg = ''
  list.forEach((s, i) => {
    const peak = s.peak.toFixed(2)
    const end = `translateX(${s.dist.toFixed(0)}px)`
    css +=
      `.m${i}{opacity:0;animation:m${i} ${cycle.toFixed(2)}s linear ${s.at.toFixed(2)}s infinite}` +
      `@keyframes m${i}{0%{opacity:0;transform:translateX(0)}${pc(s.dur * 0.12)}{opacity:${peak}}` +
      `${pc(s.dur * 0.6)}{opacity:${peak}}${pc(s.dur)},100%{opacity:0;transform:${end}}}\n`
    svg +=
      `<g transform="translate(${s.x.toFixed(0)} ${s.y.toFixed(0)}) rotate(${s.rot.toFixed(1)})"><g class="m${i}">` +
      `<rect x="${(-s.len).toFixed(0)}" y="${(-s.w / 2).toFixed(2)}" width="${s.len.toFixed(0)}" height="${s.w.toFixed(2)}" fill="url(#mt)"/>` +
      `<circle r="${(s.w * 0.7).toFixed(2)}" fill="#fff"/></g></g>\n`
  })
  return { css, svg }
}

const LINK_BLUE = '#58A6FF'
const METEORS = meteors()

export const SCENE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">
<style>
.tw{animation:tw 6s ease-in-out infinite}
@keyframes tw{0%,100%{opacity:.15}50%{opacity:.9}}
.spin1{transform-origin:0 0;animation:spin 90s linear infinite}
.spin2{transform-origin:0 0;animation:spin 140s linear infinite reverse}
@keyframes spin{to{transform:rotate(360deg)}}
.blink{animation:blink 2.4s steps(2,end) infinite}
@keyframes blink{50%{opacity:0}}
.drift{animation:drift 60s ease-in-out infinite alternate}
@keyframes drift{to{transform:translate(-18px,10px)}}
text{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:11px;letter-spacing:2px;fill:#B0B0A9}
@media (max-aspect-ratio:1/1){.corner{opacity:.55}}
${METEORS.css}</style>
<rect width="1600" height="1000" fill="#000"/>
<g stroke="#fff" stroke-opacity=".035" stroke-width="1">${grid()}</g>
<g class="drift">${stars()}</g>
<g>${METEORS.svg}</g>
<defs>
<linearGradient id="mt" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity=".9"/></linearGradient>
<radialGradient id="pl" cx=".35" cy=".65" r=".75"><stop offset="0" stop-color="#1a1a18"/><stop offset=".8" stop-color="#070707"/><stop offset="1" stop-color="#000"/></radialGradient>
</defs>
<svg class="corner" x="0" y="0" width="1600" height="1000" viewBox="0 0 800 520" preserveAspectRatio="xMaxYMin meet">
 <g transform="translate(720 70)">
  <circle r="170" fill="url(#pl)"/>
  <circle r="170" fill="none" stroke="${LINK_BLUE}" stroke-opacity=".55" stroke-width="1.2" stroke-dasharray="2 5"/>
  <circle r="182" fill="none" stroke="#fff" stroke-opacity=".08"/>
  <g transform="rotate(-24) scale(1 .32)">
   <circle r="300" fill="none" stroke="#fff" stroke-opacity=".22" stroke-width="2"/>
   <g class="spin1"><circle cx="300" cy="0" r="9" fill="${LINK_BLUE}"/><circle cx="300" cy="0" r="22" fill="none" stroke="${LINK_BLUE}" stroke-opacity=".5" stroke-width="2"/></g>
  </g>
  <g transform="rotate(18) scale(1 .5)">
   <circle r="380" fill="none" stroke="#fff" stroke-opacity=".12" stroke-width="1.5" stroke-dasharray="6 10"/>
   <g class="spin2"><rect x="374" y="-6" width="12" height="12" fill="#fff"/></g>
  </g>
  <text x="-250" y="180">[ ORBIT 01 ]  LEO  550KM</text>
  <text x="-250" y="198">INC 53.0°  TRK NOMINAL</text>
 </g>
</svg>
<g stroke="#fff" stroke-opacity=".5" stroke-width="1.5" fill="none">
 <path d="M24 64V24H64"/><path d="M1536 976H1576V936"/>
</g>
<text x="40" y="52">[ SPACE ]</text>
<circle class="blink" cx="1488" cy="968" r="3" fill="${LINK_BLUE}"/>
</svg>`
