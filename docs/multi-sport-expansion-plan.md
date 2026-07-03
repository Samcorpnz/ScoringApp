# Multi-Sport Expansion Plan

## Status

| Phase | Description | Status |
|-------|-------------|--------|
| Phase 0 | Refactor + Architecture | ✅ Complete (commit d4cc37f) |
| Phase 1 | 8 drop-in sports | ✅ Complete (commit d4cc37f) |
| Phase 2 | Indoor Cricket | ⬜ Not started |
| Phase 3 | Softball | ⬜ Not started |
| Phase 4 | Cricket | ⬜ Not started |

Test counts after Phase 0+1: **85 relay tests, 125 frontend tests, all green.**

---

## Context
The ScoringApp targets NZ sports stadiums, leisure centres, and multi-sport venues. Currently 11 sports exist. This plan adds ~10 more sports, phased by implementation complexity. Before the bulk add, a Phase 0 refactor consolidates the config model, eliminates type duplication, and adds relay-level capabilities (undo, score reset) that the more complex sports require. The codebase is config-driven: after Phase 0, most sports are true "drop-ins" touching only one file.

---

## Phase 0: Refactor + Architecture ✅

### Part A — Code Cleanup (no behaviour change)

**1. Move `scoreIncrements` into `sport-templates.ts`**
- Add `scoreIncrements: number[]` to the `SportTemplate` interface
- Remove the separate `SCORE_INCREMENTS` record from `frontend/app/control/mobile/page.tsx`
- After this, mobile and desktop score buttons both read from the template
- Drops the "6 files to change" checklist to 4 for every future sport

**2. Make `ScoreButtons` config-driven**
- `frontend/app/control/components/primitives.tsx` previously had `if (sport === "netball") / if (sport === "basketball")` hardcoded blocks
- Replaced with: read `scoreIncrements` from template, render buttons dynamically
- New sports with standard scoring need zero changes here

**3. Consolidate sport labels**
- `sportLabel()` function in `frontend/app/types.ts` duplicated the `label` field already on each template object
- Removed `sportLabel()`, replaced call sites with `SPORT_TEMPLATES.find(t => t.sport === sport)?.label`

**4. Sport-panel plugin pattern for `ScoreTab.tsx`**
- Added optional `controlPanel?: React.ComponentType<ControlPanelProps>` to `SportTemplate`
- `ScoreTab.tsx` checks for this override and renders it; falls through to generic panel if absent
- Complex sports (Softball, Cricket) provide their own tab component; generic sports untouched
- Eliminates the growing `if (isBasketball) / if (isNetball)` chain

**5. Create `packages/types` shared package**
- `relay/src/types.ts` previously mirrored `frontend/app/types.ts` — both maintained separately
- Created `packages/types/index.ts` exporting all shared interfaces (`MatchState`, `TeamState`, `SportType`, etc.)
- Both frontend and relay import from `@scorehub/types`
- Sport-specific state extensions (cricket, softball) live in `packages/types/sports/` as separate files

### Part B — Capability Additions (required by later phases)

**6. Undo stack in relay**
- Circular buffer of last 50 states in relay memory
- `undo` Socket.io event: pops last state, broadcasts it
- "Undo" button in control panel (keyboard shortcut: Cmd/Ctrl+Z)
- Undo is session-scoped (lost on relay restart)

**7. `resetScoreOnPeriod` flag in sport template**
- Set-based sports (Badminton, Pickleball, Table Tennis, Squash, Volleyball, Tennis) reset scores to 0 when a game ends
- `resetScoreOnPeriod: boolean` on `SportTemplate`
- Relay applies reset before advancing period when flag is true

**8. Extensible match creation config**
- `SportTemplate.matchConfig?: ConfigField[]` — typed config fields shown at match creation
- Values stored in `MatchState.sportConfig: Record<string, unknown>`
- Squash uses this for bo3/bo5 format selector
- Indoor cricket will use this for `{ wicketPenalty: 2 | 5 }`
- Softball will use this for `{ format: "fastpitch" | "slowpitch" }`
- Cricket will use this for `{ format: "t20" | "odi" | "test" }`

**9. Formalise sport state extension pattern**
- `sportState?: CricketState | SoftballState | IndoorCricketState` (discriminated union)
- Each type defined in `packages/types/sports/*.ts`
- Relay handlers and display components type-narrow via `state.sport`

**10. Single active controller per match**
- Controller mutex in relay: `controllerGranted` / `controllerConflict` / `takeControl` / `controllerRevoked`
- 30s grace period TTL on ungraceful disconnect (allows page refresh without losing control)
- Viewer connections are unaffected — unlimited viewers permitted

**11. Enhanced undo for volunteer operators**
- 50-state undo buffer (covers a full volleyball set)
- Keyboard shortcut: Cmd/Ctrl+Z

---

## Architecture Recap (post Phase 0)

**Files that change for any new sport (reduced from 6 to 4):**
- `packages/types/index.ts` — `SportType` union
- `frontend/app/sport-templates.ts` — template object (scoreIncrements, resetScoreOnPeriod, optional matchConfig + controlPanel)
- `relay/src/schemas.ts` — Zod `sportSchema` enum
- `relay/src/server.ts` — add to `SPORT_DEFAULT_CLOCK` (and `SPORT_RESET_SCORE_ON_PERIOD` if applicable)

---

## Phase 1: Drop-In Sports ✅

Data-layer changes only. No control panel UI work.

### Template Values

| Sport | key | periods | periodLabel | clockSeconds | countDown | timeoutsPerTeam | scoreIncrements |
|-------|-----|---------|-------------|--------------|-----------|-----------------|-----------------|
| Touch Rugby | `touch_rugby` | 2 | HALF | 2400 | true | 0 | [1] |
| Futsal | `futsal` | 2 | HALF | 1200 | true | 1 | [1] |
| Pickleball | `pickleball` | 3 | GAME | 0 | false | 2 | [1] |
| Badminton | `badminton` | 3 | GAME | 0 | false | 1 | [1] |
| Table Tennis | `table_tennis` | 7 | GAME | 0 | false | 1 | [1] |
| Floorball | `floorball` | 3 | PERIOD | 1200 | true | 1 | [1] |
| Squash | `squash` | 5 | GAME | 0 | false | 0 | [1] |
| Lawn Bowls | `lawn_bowls` | 21 | END | 0 | false | 0 | [1, 2, 3, 4] |

### International Standards per Sport

**Touch Rugby (World Touch)**
- Try = 1 point, no conversions or penalties
- 2 × 40-minute halves (international); tournament formats often 35 min total
- 6 touches per possession (referee responsibility, not scoreboard)
- No timeouts

**Futsal (FIFA Laws of the Game)**
- Goals = 1 point
- 2 × 20-minute stop-clock halves
- 1 × 60-second team timeout per half
- Knockout ties: 2 × 5-minute extra time periods (add as OT periods)

**Pickleball (USA Pickleball / IFP)**
- Rally scoring; games to 11, win by 2, no cap
- Best of 3 (standard); best of 5 (some championship brackets)
- 2 × 1-minute timeouts per team per game

**Badminton (BWF)**
- Rally scoring; games to 21, win by 2, capped at 30–29
- Best of 3 games
- 1 × 60-second timeout per team per game (team events)
- 60-second interval at 11 points each game; 120-second interval between games

**Table Tennis (ITTF / WTT)**
- Rally scoring; games to 11, win by 2 (no cap — keep playing)
- Best of 7 games (international singles/doubles); best of 5 common in club play
- Service alternates every 2 points (every point at deuce)
- 1 × 60-second timeout per team per match (not per game)

**Floorball (IFF)**
- Goals = 1 point
- 3 × 20-minute stop-clock periods
- 1 × 60-second timeout per team per match
- 5 field players + GK per side; rolling substitutions
- Knockout ties: 5-minute sudden-death OT, then penalty shootout

**Squash (WSF)**
- PAR (Point-a-Rally) scoring; games to 11, win by 2 (keep playing until 2 ahead)
- Best of 5 games (WSF/PSA major events); best of 3 (some circuit events — configurable at match setup)
- No team timeouts; 90-second rest between games, 120-second after games 3 and 4

**Lawn Bowls (World Bowls / Bowls NZ)**
- Shots scored by number of bowls closer to jack than opponent's nearest
- Singles: first to 21 shots (minimum 18 ends)
- Pairs/Triples: 21 ends; Fours: 21 ends
- Sets play (common in NZ): 2 sets × 9 ends, tiebreak end if sets split
- Score increments 1–4 (bowls that beat opponent's nearest bowl)

---

## Phase 2: Indoor Cricket (~2 days)

Needs a **secondary per-team counter** (wickets) displayed alongside runs, and a wicket button in the control panel.

### ICF / Cricket NZ Rules
- 8-a-side; 2 × 8-over innings per team (16 overs batting per team total)
- Score displayed as: **Runs / Wickets** (e.g., "87/6")
- Wicket penalty is **configurable at match creation**: Cricket NZ = -5 runs; ICF international = -2 runs
- Wide = 2 penalty runs + ball re-bowled; No-ball = 1 extra run + re-bowled
- Boundaries: 4 or 6 runs (some codes require batsman to physically run all boundaries)
- Overtime: not applicable — innings is fixed overs

### What needs building
1. `packages/types/sports/indoor_cricket.ts` — `IndoorCricketState` type (already scaffolded)
2. `packages/types/index.ts` — add `wickets` to `TeamState` (or use `sportState`)
3. `frontend/app/sport-templates.ts` — indoor cricket template with matchConfig for wicket penalty
4. `frontend/app/control/components/primitives.tsx` — "Wicket (-N)" button for indoor cricket
5. Score display components — render "R/W" format when sport is `indoor_cricket`
6. `relay/src/server.ts` — handle wicket event (decrement runs by penalty, increment wicket count)

---

## Phase 3: Softball (~3–4 days)

Needs a dedicated half-inning control UI: outs, balls, strikes, inning tracker.

### WBSC Rules — two formats, selected at match creation

**Fastpitch (WBSC international standard):**
- 7 innings; 10 players; each half-inning ends on 3 outs
- 3 strikes = batter out; 4 balls = walk
- Mercy rule: 8-run lead after 5 complete innings
- Tie-break from 8th inning: runner starts at 2nd base each half-inning

**Slowpitch (community/social):**
- 6 innings (common NZ club format); 10 players
- Every batter starts with 1 ball, 1 strike (speeds up play)
- No mercy rule typically (varies by competition)
- Tie-break: same runner-at-2nd convention

### New UI elements (shared across fastpitch and slowpitch)
- Format selector at match creation (Fastpitch / Slowpitch) — drives inning count and starting count
- Inning indicator (1–7 fastpitch / 1–6 slowpitch) with top/bottom half (▲/▼)
- Outs counter (0–2) per half-inning, resets on 3rd out
- Balls counter (0–3) per batter (fastpitch starts 0; slowpitch starts 1)
- Strikes counter (0–2) per batter (fastpitch starts 0; slowpitch starts 1)
- "Next Batter" button — resets balls/strikes to starting count for format
- "3 Outs / End Half-Inning" action — clears outs, flips top/bottom, advances inning
- Run scoring: same as other sports (+1)

### Files to change (beyond standard 4)
- `packages/types/sports/softball.ts` — `SoftballState` type (already scaffolded)
- New `SoftballTab.tsx` component registered via `controlPanel` plugin in template
- `relay/src/server.ts` — softball event handlers (ball, strike, out, next-batter, half-inning change)
- Match creation flow — format picker via `matchConfig`
- Scoreboard display — show inning + half above score

---

## Phase 4: Cricket (Standalone milestone, 2–4 weeks)

Cricket is a fundamentally different product feature. Scope separately as its own epic.

### ICC Formats (all three)
- **T20**: 20 overs per team, 1 innings each — most common at NZ venue level
- **ODI**: 50 overs per team, 1 innings each — major grounds (Hagley, Basin, Eden Park)
- **Test**: up to 2 innings per team, 90 overs minimum per day — declarations, follow-on, day/session tracking

### Player lists: YES — required
- 11-player batting order per team (entered pre-match)
- Active display: 2 current batsmen (runs, balls faced, 4s, 6s)
- Active display: current bowler (overs, maidens, runs, wickets)

### Ball-by-ball input (new control panel)
Buttons: dot · 1 · 2 · 3 · 4 (boundary) · 6 (boundary) · Wide · No-ball · Bye · Leg-bye · Wicket

Wicket type selector: Bowled / Caught / LBW / Run Out / Stumped / Hit Wicket / Handled Ball / Obstructed Field

### Scoreboard display (new layout)
- Team score: "123/4 (15.2 ov)"
- Current batsmen names + individual scores
- Current bowler + figures
- Last over dot-ball summary
- 2nd innings: target, required runs, required run rate, current run rate

### New files / components
- `frontend/app/control/components/CricketTab.tsx` — ball-by-ball input panel (registered via `controlPanel` plugin)
- `frontend/app/control/components/CricketSquadSetup.tsx` — pre-match lineup entry, rendered via `matchConfig`
- `packages/types/sports/cricket.ts` — full `CricketState` type (already scaffolded): format, innings, overs, balls, extras, FoW log, player state
- `relay/src/server.ts` — cricket event handlers (ball-by-ball, over complete, innings change, declare, follow-on)
- `frontend/app/display/cricket/page.tsx` — dedicated cricket scoreboard layout
- Test-specific: session tracking (morning/afternoon/evening), day number, declarations, follow-on trigger

---

## Testing

### Running tests
```bash
npm test                              # all workspaces
npm run test --workspace=relay        # relay only
npm run test --workspace=frontend     # frontend only
```

### What is NOT covered yet (deliberate)
- Component rendering tests for control panel tabs (large scope, separate effort)
- E2E / Playwright browser tests (separate infrastructure decision)
- Display page tests (no test infrastructure for Next.js pages yet)

### Manual Verification Plan

**Phase 2 (Indoor Cricket):** Walk through: score 3 runs, record 2 wickets (verify -10 runs penalty), score a wide (+2), verify R/W display format.

**Phase 3 (Softball):** Walk through a full half-inning: 2 balls, 1 strike, batter out → next batter, run scored, 3 outs → inning flips, mercy rule triggers at 8-run lead after 5th inning.

**Phase 4 (Cricket):** Full T20 match walkthrough: squad entry, first over (6 balls including wide + no-ball), wicket with type selection, over summary, innings end at 20 overs, 2nd innings target display, match result.
