# Authorship Guess Feature Plan

## Overview

After card submission ends and before the ranker ranks the cards, the ranker must guess which player submitted each card. Every correct guess earns the ranker +1 point, added to their score at reveal time alongside the collective guess score.

The feature is optional via a game settings toggle: `authorshipEnabled`.

Auto-generated cards (filled in by the server) are attributed to `null` authorId — the ranker must guess "Auto" for these.

---

## New Phase: `authorship_guess`

Insert a new game phase between `card_submission` and `ranking`:

```
card_submission → authorship_guess → ranking → guessing → reveal
```

Only shown when `authorshipEnabled === true`. If disabled, `advancePhase` skips straight from `card_submission` to `ranking` as before.

---

## What the ranker sees

A screen showing all 5 cards (shuffled, as they'll be ranked). For each card, a dropdown/button group to assign a player name (or "Auto" for auto-generated cards).

The ranker submits all guesses at once. No partial submission — must assign all 5 before submitting.

## What guessers see

A waiting screen: "Waiting for [ranker] to guess who submitted each card..."

---

## Data flow

### Shared types (`shared/src/types.ts`)

- Add `'authorship_guess'` to `GamePhase`
- Add `authorshipEnabled: boolean` to `GameSettings`
- Add `authorshipGuesses: Record<string, string> | null` to `LobbyState` — maps cardId → guessed playerId (or `'auto'`)
- Add `'submit-authorship': (data: { guesses: Record<string, string> }) => void` to `ClientEvents`
- Add `authorshipResults: Record<string, string> | null` to `TurnResult` — maps cardId → actual authorId (or `'auto'`), revealed at the end so guessers can see how the ranker did

### Server (`server/src/lobby.ts`)

- Add `authorshipEnabled` to `GameSettings` default
- Add `authorshipGuesses: Record<string, string> | null` to `ServerGameState`
- Add `authorshipResults: Record<string, string> | null` to `ServerGameState` — populated after authorship phase, holds the true authorId per card
- Reset both in `startTurn`
- Include `authorshipGuesses` in `toLobbyState`

### Server (`server/src/game.ts`)

`advancePhase` changes:
- `card_submission` → if `authorshipEnabled`: go to `authorship_guess`, else go to `ranking` (same as before)
- `authorship_guess` → go to `ranking`

In `startTurn`, reset `authorshipGuesses = null`.

### Server (`server/src/handlers/gameHandlers.ts`)

New handler: `submit-authorship`
- Only valid in `authorship_guess` phase
- Only the current ranker can submit
- Validates that all 5 card IDs are accounted for
- Stores guesses in `state.authorshipGuesses`
- Advances phase to `ranking`
- Emits `phase-changed`

Auto-submit for authorship phase (disconnect handler): if ranker disconnects during `authorship_guess`, auto-submit random guesses so the game can continue.

`emitRevealResults` changes:
- After calculating collective guess scores, also score authorship:
  - For each card, compare `state.authorshipGuesses[cardId]` to the true `card.authorId` (or `'auto'` if null)
  - Each correct guess: `state.scores.set(rankerId, score + 1)`
  - Store `authorshipResults` in the `TurnResult` for display on the reveal screen

### Client types changes

`LobbyState` gains `authorshipGuesses: Record<string, string> | null`
`TurnResult` gains `authorshipResults: Record<string, string> | null` and `authorshipScore: number` (how many the ranker got right)

### Client: new screen `AuthorshipGuess.tsx`

Ranker view:
- Title: "Who submitted each card?"
- List of all 5 cards, each with a player selector
- Player options: all non-ranker display names + "Auto"
- Submit button (disabled until all 5 assigned)
- No timer shown (auto-submit handled server-side on disconnect)

Guesser view:
- "Waiting for [ranker] to guess who submitted each card..."
- Show the list of cards so guessers can anticipate

### Client: `GameRouter` in `App.tsx`

Add `case 'authorship_guess': return <AuthorshipGuess />;`

### Client: `Lobby.tsx`

Add toggle for `authorshipEnabled` in game settings, same pattern as `multipleSubmissionsEnabled`.

### Client: `Reveal.tsx`

Add a new section showing authorship results:
- Each card, who the ranker guessed, who actually submitted it, ✓/✗
- "+N pts" bonus shown for ranker at the bottom of the scores section

### Client: `PlayerSidebar.tsx`

No changes needed — sidebar already shows scores which will include authorship bonus.

---

## Scoring summary (per turn)

| Who | How | Points |
|---|---|---|
| Each guesser | Collective guess accuracy | 0–5 pts (existing) |
| Ranker | Correct authorship guesses | 0–5 pts (new) |

---

## Auto-generated card authorship

Cards filled by `getAutoFillCards` have `authorId: null` in `CardFull`. The ranker sees an "Auto" option. The true answer for null-author cards is `'auto'`. This is included in the reveal so everyone can see which cards were auto-generated.

---

## Todo

- [ ] Add `'authorship_guess'` to `GamePhase` in `shared/src/types.ts`
- [ ] Add `authorshipEnabled: boolean` to `GameSettings` in `shared/src/types.ts`
- [ ] Add `authorshipGuesses: Record<string, string> | null` to `LobbyState` in `shared/src/types.ts`
- [ ] Add `authorshipResults: Record<string, string> | null` and `authorshipScore: number` to `TurnResult` in `shared/src/types.ts`
- [ ] Add `'submit-authorship'` to `ClientEvents` in `shared/src/types.ts`
- [ ] Add `authorshipGuesses` and `authorshipEnabled` to `ServerGameState` in `server/src/lobby.ts`
- [ ] Reset `authorshipGuesses` in `startTurn` in `server/src/game.ts`
- [ ] Update `advancePhase` to insert `authorship_guess` phase when enabled in `server/src/game.ts`
- [ ] Add `submit-authorship` handler in `server/src/handlers/gameHandlers.ts`
- [ ] Update disconnect auto-submit to handle `authorship_guess` phase in `server/src/handlers/gameHandlers.ts`
- [ ] Update `emitRevealResults` to score authorship guesses and include results in `TurnResult`
- [ ] Update `toLobbyState` to include `authorshipGuesses` in `server/src/lobby.ts`
- [ ] Add `authorshipEnabled` toggle to `Lobby.tsx`
- [ ] Create `client/src/screens/AuthorshipGuess.tsx`
- [ ] Add `case 'authorship_guess'` to `GameRouter` in `App.tsx`
- [ ] Update `Reveal.tsx` to show authorship results section
- [ ] Remove `authorshipEnabled` from `defaultSettings` in `Home.tsx` (default to `false`)
