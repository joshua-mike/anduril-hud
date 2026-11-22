# anduril-hud

A Claude Code mod for the desktop app: a stark black and link-blue defense-tech look, an animated orbital backdrop, and a live telemetry band above the prompt.

> Unofficial fan project inspired by the visual style of Anduril Industries' website. Not affiliated with or endorsed by Anduril. It uses no Anduril logos, artwork or fonts.

## What you get

- **Theme**: dark-only. Pure black surfaces, white and warm-grey text, link-blue `#58A6FF` accent.
- **Backdrop**: a slowly drifting starfield over a faint survey grid, a planet limb with two tilted orbits and tracked objects, and HUD corner brackets. The art keeps to the edges, away from the conversation and the message box.
- **Telemetry band**, just above the prompt:

  ```
  ◉ [ TELEMETRY ]  CTX ▰▰▰▰▱▱▱▱▱▱▱▱ 34% 68K/200K   5H ▰▰▰▱… 23% T-2H14M   WEEK ▰▰▰▰▰▱… 41% T-3D06H   FABLE ▰▱… 12% T-3D06H
  ```

  | Meter | Source |
  | --- | --- |
  | `CTX` | the session's context window fill, pushed by Claude Code after every model step |
  | `5H` | the 5-hour usage window |
  | `WEEK` | the weekly limit across all models |
  | `FABLE` | the weekly Fable allowance (see below) |

  Bars are blue, amber from 70%, red from 90%. Each limit shows a countdown to its reset.

## The FABLE meter

Claude Code doesn't pass the per-model Fable limit to mods, so the mod reads it from the same usage service the app's Usage screen uses:

- Only a session whose model is **Fable** fetches, every 3 minutes, and once right away when you switch to Fable.
- The request goes through `$.session.authorize()`: Claude Code attaches your sign-in itself, only for Anthropic's own hosts. The mod never sees your token, and the URL is fixed in the code.
- Nothing about a request (headers, responses, errors) is logged. Each fetch overwrites one small file, `~/.claude/anduril-hud/fable-usage.json`, holding only the percentage, the reset time and when it was fetched.
- Sessions on other models read that file every minute (no network), so every session's band shows Fable. A reading older than 5 minutes shows its age, e.g. `14M OLD`. Before any Fable session has fetched, the meter reads `AWAITING FABLE SESSION`.

The usage endpoint is undocumented, so a future Claude Code or service change can break the FABLE meter. The other meters use Claude Code's public mod API.

## Install

From a shell:

```bash
claude plugin install anduril-hud --marketplace joshua-mike/anduril-hud
```

At the prompt of a terminal Claude Code session:

```
/plugin install anduril-hud --marketplace joshua-mike/anduril-hud
```

In the desktop app: click **+** next to the prompt box, then **Plugins**, **Add marketplace** with `joshua-mike/anduril-hud`, then **Add plugin**.

Answer `y` to add the marketplace and choose the **user** scope to load it in every session. Sessions already open pick it up after `/reload-plugins`.

To turn it off: `claude plugin disable anduril-hud`.

## Surfaces

The theme, backdrop and band draw in the Claude desktop and mobile apps. The terminal draws the band but no theme or backdrop.

## License

MIT
