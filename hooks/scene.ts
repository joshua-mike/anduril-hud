// An orbital-ops backdrop in a stark black-and-lime defense-tech idiom:
// a starfield, a faint survey grid, a planet limb in the top-right corner
// with two tilted orbits and their tracked objects, HUD brackets and a slow scan.

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

const LIME = '#DFF140'

export const SCENE = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">
<style>
.tw{animation:tw 6s ease-in-out infinite}
@keyframes tw{0%,100%{opacity:.15}50%{opacity:.9}}
.spin1{transform-origin:0 0;animation:spin 90s linear infinite}
.spin2{transform-origin:0 0;animation:spin 140s linear infinite reverse}
@keyframes spin{to{transform:rotate(360deg)}}
.scan{animation:scan 14s linear infinite}
@keyframes scan{0%{transform:translateY(-60px)}100%{transform:translateY(1060px)}}
.blink{animation:blink 2.4s steps(2,end) infinite}
@keyframes blink{50%{opacity:0}}
.drift{animation:drift 60s ease-in-out infinite alternate}
@keyframes drift{to{transform:translate(-18px,10px)}}
text{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:11px;letter-spacing:2px;fill:#B0B0A9}
@media (max-aspect-ratio:1/1){.corner{opacity:.55}}
</style>
<rect width="1600" height="1000" fill="#000"/>
<g stroke="#fff" stroke-opacity=".035" stroke-width="1">${grid()}</g>
<g class="drift">${stars()}</g>
<rect class="scan" x="0" y="0" width="1600" height="60" fill="url(#sg)"/>
<defs>
<linearGradient id="sg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${LIME}" stop-opacity="0"/><stop offset="1" stop-color="${LIME}" stop-opacity=".045"/></linearGradient>
<radialGradient id="pl" cx=".35" cy=".65" r=".75"><stop offset="0" stop-color="#1a1a18"/><stop offset=".8" stop-color="#070707"/><stop offset="1" stop-color="#000"/></radialGradient>
</defs>
<svg class="corner" x="0" y="0" width="1600" height="1000" viewBox="0 0 800 520" preserveAspectRatio="xMaxYMin meet">
 <g transform="translate(720 70)">
  <circle r="170" fill="url(#pl)"/>
  <circle r="170" fill="none" stroke="${LIME}" stroke-opacity=".55" stroke-width="1.2" stroke-dasharray="2 5"/>
  <circle r="182" fill="none" stroke="#fff" stroke-opacity=".08"/>
  <g transform="rotate(-24) scale(1 .32)">
   <circle r="300" fill="none" stroke="#fff" stroke-opacity=".22" stroke-width="2"/>
   <g class="spin1"><circle cx="300" cy="0" r="9" fill="${LIME}"/><circle cx="300" cy="0" r="22" fill="none" stroke="${LIME}" stroke-opacity=".5" stroke-width="2"/></g>
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
<circle class="blink" cx="1488" cy="968" r="3" fill="${LIME}"/>
</svg>`
