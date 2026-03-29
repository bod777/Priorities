# Ranker Identification & UI Implementation Plan

## Overview

This document outlines the complete implementation plan for clearly identifying the ranker at the start of each round and providing differentiated UI for ranker vs non-ranker players during card submission.

---

## Requirements

### R1: Round Start Announcement
- **All players** see who the ranker is at the start of each round
- Clear visual announcement before card submission begins
- Shows round number and ranker's name

### R2: Ranker Waiting Screen
- **Ranker** sees a waiting screen during card submission
- Shows how many players have submitted
- Shows countdown/progress of submissions
- **No card input field**

### R3: Non-Ranker Submission Screen
- **Non-rankers** see the card submission interface
- Shows who the current ranker is (reminder)
- Shows submission progress

---

## Implementation Plan

### Phase 1: Add Round Transition Screen

#### 1.1 Create New Component

**File**: `client/src/screens/RoundTransition.tsx`

```typescript
import { useEffect, useState } from 'react';
import { useGame } from '../context/GameContext.tsx';

export function RoundTransition() {
  const { state } = useGame();
  const { lobbyState } = state;
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  if (!lobbyState) return null;

  const ranker = lobbyState.players.find((p) => p.id === lobbyState.currentRankerId);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-500 to-pink-500 p-4 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-2xl p-12 max-w-2xl w-full text-center animate-fadeIn">
        <div className="mb-8">
          <h1 className="text-5xl font-bold text-purple-600 mb-4">
            Round {lobbyState.currentRound}
          </h1>
          <p className="text-gray-500 text-lg">
            of {lobbyState.totalRounds}
          </p>
        </div>

        <div className="mb-8 py-8 px-6 bg-gradient-to-r from-yellow-100 to-yellow-50 rounded-xl border-2 border-yellow-400">
          <p className="text-gray-600 text-lg mb-3">The Ranker is</p>
          <h2 className="text-4xl font-bold text-purple-600">
            {ranker?.displayName || 'Unknown'}
          </h2>
        </div>

        {countdown > 0 ? (
          <div className="text-6xl font-bold text-purple-600 animate-pulse">
            {countdown}
          </div>
        ) : (
          <p className="text-gray-600 text-lg">Get ready...</p>
        )}
      </div>
    </div>
  );
}
```

**Key Features**:
- Shows round number prominently
- Highlights ranker's name in a special box
- 3-second countdown before proceeding
- Auto-transitions after countdown

#### 1.2 Add Transition State to GameContext

**File**: `client/src/context/GameContext.tsx`

Add to `GameContextState`:

```typescript
interface GameContextState {
  playerId: string | null;
  displayName: string | null;
  lobbyState: LobbyState | null;
  roundResult: RoundResult | null;
  gameOverData: GameOverData | null;
  showRoundTransition: boolean;  // ← NEW
}
```

Add to `GameAction`:

```typescript
type GameAction =
  | { type: 'SET_PLAYER'; playerId: string; displayName: string }
  | { type: 'SET_LOBBY'; lobbyState: LobbyState }
  | { type: 'SET_ROUND_RESULT'; roundResult: RoundResult }
  | { type: 'SET_GAME_OVER'; gameOverData: GameOverData }
  | { type: 'SHOW_ROUND_TRANSITION' }      // ← NEW
  | { type: 'HIDE_ROUND_TRANSITION' }      // ← NEW
  | { type: 'RESET' };
```

Update `initialState`:

```typescript
const initialState: GameContextState = {
  playerId: null,
  displayName: null,
  lobbyState: null,
  roundResult: null,
  gameOverData: null,
  showRoundTransition: false,  // ← NEW
};
```

Update `gameReducer`:

```typescript
function gameReducer(state: GameContextState, action: GameAction): GameContextState {
  switch (action.type) {
    case 'SET_PLAYER':
      return { ...state, playerId: action.playerId, displayName: action.displayName };
    case 'SET_LOBBY':
      return { ...state, lobbyState: action.lobbyState };
    case 'SET_ROUND_RESULT':
      return { ...state, roundResult: action.roundResult };
    case 'SET_GAME_OVER':
      return { ...state, gameOverData: action.gameOverData };
    case 'SHOW_ROUND_TRANSITION':  // ← NEW
      return { ...state, showRoundTransition: true };
    case 'HIDE_ROUND_TRANSITION':  // ← NEW
      return { ...state, showRoundTransition: false };
    case 'RESET':
      return initialState;
    default:
      return state;
  }
}
```

#### 1.3 Trigger Transition on Phase Change

**File**: `client/src/context/GameContext.tsx`

Update `handlePhaseChanged`:

```typescript
const handlePhaseChanged = (data: LobbyState) => {
  console.log('Phase changed:', data);

  // Show round transition when entering card_submission phase
  if (data.phase === 'card_submission') {
    dispatch({ type: 'SHOW_ROUND_TRANSITION' });

    // Auto-hide after 3 seconds
    setTimeout(() => {
      dispatch({ type: 'HIDE_ROUND_TRANSITION' });
    }, 3000);
  }

  dispatch({ type: 'SET_LOBBY', lobbyState: data });
};
```

#### 1.4 Update App Router

**File**: `client/src/App.tsx`

```typescript
import { RoundTransition } from './screens/RoundTransition.tsx';

function GameRouter() {
  const { state } = useGame();
  const { lobbyState, gameOverData, showRoundTransition } = state;

  // Show round transition overlay
  if (showRoundTransition && lobbyState?.phase === 'card_submission') {
    return <RoundTransition />;
  }

  if (gameOverData) {
    return <GameOver />;
  }

  if (!lobbyState) {
    return <Home />;
  }

  switch (lobbyState.phase) {
    case 'lobby':
      return <Lobby />;
    case 'card_submission':
      return <CardSubmission />;
    // ... rest of cases
  }
}
```

---

### Phase 2: Update CardSubmission Component

#### 2.1 Add Ranker Check Logic

**File**: `client/src/screens/CardSubmission.tsx`

Complete rewrite:

```typescript
import { useState } from 'react';
import { useSocket } from '../hooks/useSocket.ts';
import { useGame } from '../context/GameContext.tsx';

export function CardSubmission() {
  const { socket } = useSocket();
  const { state } = useGame();
  const { lobbyState, playerId } = state;
  const [cardText, setCardText] = useState('');

  if (!lobbyState || !playerId) return null;

  const isRanker = lobbyState.currentRankerId === playerId;
  const hasSubmitted = lobbyState.submittedPlayerIds.includes(playerId);
  const ranker = lobbyState.players.find((p) => p.id === lobbyState.currentRankerId);

  // Calculate non-ranker count (ranker doesn't submit)
  const totalNonRankers = lobbyState.players.length - 1;
  const submittedCount = lobbyState.submittedPlayerIds.length;

  const handleSubmit = () => {
    if (!socket || !cardText.trim()) return;
    socket.emit('submit-card', { text: cardText.trim() });
    setCardText(''); // Clear input after submit
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-500 to-pink-500 p-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Round Header */}
        <div className="bg-white rounded-2xl shadow-2xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-purple-600">Card Submission</h1>
              <p className="text-gray-600 mt-1">
                Round {lobbyState.currentRound} of {lobbyState.totalRounds}
              </p>
            </div>

            {/* Ranker Badge */}
            <div className="text-right">
              <p className="text-sm text-gray-500 mb-1">Current Ranker</p>
              <div className="bg-yellow-100 border-2 border-yellow-400 rounded-lg px-4 py-2">
                <p className="font-bold text-purple-600">{ranker?.displayName}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {isRanker ? (
            /* RANKER VIEW */
            <div className="text-center space-y-6">
              <div className="bg-purple-50 border-2 border-purple-200 rounded-xl p-8">
                <div className="text-5xl mb-4">👑</div>
                <h2 className="text-2xl font-bold text-purple-600 mb-3">
                  You are the Ranker!
                </h2>
                <p className="text-gray-700 text-lg">
                  Waiting for other players to submit their cards...
                </p>
              </div>

              {/* Progress Display */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">
                    Submissions Progress
                  </span>
                  <span className="text-sm font-medium text-purple-600">
                    {submittedCount} / {totalNonRankers}
                  </span>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                  <div
                    className="bg-purple-600 h-4 transition-all duration-500 ease-out"
                    style={{ width: `${(submittedCount / totalNonRankers) * 100}%` }}
                  />
                </div>
              </div>

              {/* Player List */}
              <div className="text-left">
                <h3 className="font-semibold text-gray-700 mb-3">Players:</h3>
                <div className="space-y-2">
                  {lobbyState.players
                    .filter((p) => p.id !== lobbyState.currentRankerId)
                    .map((player) => {
                      const submitted = lobbyState.submittedPlayerIds.includes(player.id);
                      return (
                        <div
                          key={player.id}
                          className="flex items-center justify-between bg-gray-50 rounded-lg p-3"
                        >
                          <span className="font-medium">{player.displayName}</span>
                          {submitted ? (
                            <span className="text-green-600 flex items-center gap-1">
                              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                                <path
                                  fillRule="evenodd"
                                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                  clipRule="evenodd"
                                />
                              </svg>
                              Submitted
                            </span>
                          ) : (
                            <span className="text-gray-400">Waiting...</span>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          ) : (
            /* NON-RANKER VIEW */
            <div>
              {!hasSubmitted ? (
                <div className="space-y-6">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-blue-900">
                      <strong>{ranker?.displayName}</strong> is the ranker this round.
                      Submit a card for them to rank!
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Your Card
                    </label>
                    <textarea
                      value={cardText}
                      onChange={(e) => setCardText(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
                      placeholder="Type your card text here..."
                      maxLength={100}
                      rows={3}
                      autoFocus
                    />
                    <p className="text-sm text-gray-500 mt-1">
                      {cardText.length} / 100 characters
                    </p>
                  </div>

                  <button
                    onClick={handleSubmit}
                    disabled={!cardText.trim()}
                    className="w-full bg-purple-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-purple-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    Submit Card
                  </button>
                </div>
              ) : (
                /* POST-SUBMISSION VIEW */
                <div className="text-center space-y-6">
                  <div className="bg-green-50 border-2 border-green-200 rounded-lg p-8">
                    <div className="text-5xl mb-4">✓</div>
                    <h2 className="text-2xl font-bold text-green-800 mb-2">
                      Card Submitted!
                    </h2>
                    <p className="text-green-700">
                      Waiting for other players...
                    </p>
                  </div>

                  {/* Progress */}
                  <div>
                    <p className="text-gray-600 mb-3">
                      {submittedCount} of {totalNonRankers} players have submitted
                    </p>
                    <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                      <div
                        className="bg-green-600 h-3 transition-all duration-500"
                        style={{ width: `${(submittedCount / totalNonRankers) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

**Key Changes**:

1. **Ranker Detection**: `const isRanker = lobbyState.currentRankerId === playerId;`
2. **Correct Count**: `const totalNonRankers = lobbyState.players.length - 1;`
3. **Three Views**:
   - Ranker waiting screen with progress
   - Non-ranker submission form
   - Post-submission confirmation
4. **Visual Feedback**:
   - Progress bars
   - Player submission status
   - Clear role indicators

---

### Phase 3: Add Visual Enhancements

#### 3.1 Add Ranker Badge Component

**File**: `client/src/components/RankerBadge.tsx`

```typescript
interface RankerBadgeProps {
  rankerName: string;
  isCurrentPlayer?: boolean;
}

export function RankerBadge({ rankerName, isCurrentPlayer = false }: RankerBadgeProps) {
  return (
    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border-2 ${
      isCurrentPlayer
        ? 'bg-yellow-100 border-yellow-400 text-yellow-800'
        : 'bg-purple-50 border-purple-200 text-purple-700'
    }`}>
      <span className="text-xl">👑</span>
      <div>
        <p className="text-xs font-medium opacity-75">
          {isCurrentPlayer ? 'You are the Ranker' : 'Ranker'}
        </p>
        <p className="font-bold">{rankerName}</p>
      </div>
    </div>
  );
}
```

#### 3.2 Add to index.css for Animation

**File**: `client/src/index.css`

Add pulse animation:

```css
@keyframes pulse-slow {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.animate-pulse-slow {
  animation: pulse-slow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}
```

---

### Phase 4: Server-Side Improvements

#### 4.1 Add Transition Delay (Optional)

**File**: `server/src/handlers/gameHandlers.ts`

Add a small delay before phase change to let clients prepare:

```typescript
socket.on('start-game', () => {
  const state = getLobbyForSocket(socket.id);
  if (!state || state.hostId !== socket.id) return;
  if (state.players.size < 3) return;

  startGame(state);

  // Emit phase-changed immediately
  io.to(state.lobbyCode).emit('phase-changed', toLobbyState(state));

  console.log(`Game started in lobby ${state.lobbyCode}, ranker: ${state.currentRankerId}`);
});
```

#### 4.2 Add Server Logging for Debugging

**File**: `server/src/game.ts`

Add logs to track ranker selection:

```typescript
export function startRound(state: ServerGameState): void {
  const rankerIndex = (state.currentRound - 1) % state.rankerOrder.length;
  state.currentRankerId = state.rankerOrder[rankerIndex];

  console.log(`Round ${state.currentRound}: Ranker is ${state.currentRankerId} (index ${rankerIndex})`);
  console.log(`Ranker order: ${state.rankerOrder.join(', ')}`);

  state.cards = [];
  state.rankerRanking = null;
  state.guesses = new Map();
  state.collectiveGuess = null;
  state.authorshipGuesses = null;
  state.personalRankings = new Map();
  state.submittedPlayerIds = new Set();

  state.phase = 'card_submission';
}
```

---

## Testing Plan

### Test 1: Round Start Announcement

**Steps**:
1. Create lobby with 3 players
2. Host starts game
3. **Expected**: All players see round transition screen with ranker's name
4. **Expected**: After 3 seconds, transition to card submission

### Test 2: Ranker Waiting Screen

**Steps**:
1. Continue from Test 1
2. Player who is ranker checks their screen
3. **Expected**: Ranker sees waiting screen, NOT card input
4. **Expected**: Progress shows "0 / 2 players"

### Test 3: Non-Ranker Submission

**Steps**:
1. Non-ranker player submits a card
2. **Expected**: Ranker's screen updates to "1 / 2 players"
3. **Expected**: Player list shows checkmark next to submitted player
4. **Expected**: Submitting player sees confirmation screen

### Test 4: All Submit → Phase Change

**Steps**:
1. Second non-ranker submits card
2. **Expected**: Ranker sees "2 / 2 players"
3. **Expected**: Phase advances to next phase (authorship or ranking)

### Test 5: Multi-Round Ranker Rotation

**Steps**:
1. Complete round 1
2. Check round 2 ranker
3. **Expected**: Different player is ranker
4. **Expected**: Round transition shows new ranker

---

## File Checklist

### New Files
- [ ] `client/src/screens/RoundTransition.tsx`
- [ ] `client/src/components/RankerBadge.tsx`

### Modified Files
- [ ] `client/src/context/GameContext.tsx` (add transition state)
- [ ] `client/src/App.tsx` (add RoundTransition to router)
- [ ] `client/src/screens/CardSubmission.tsx` (complete rewrite)
- [ ] `client/src/index.css` (add animations)
- [ ] `server/src/game.ts` (add logging)

### Verification
- [ ] Run `npm run typecheck` (must pass)
- [ ] Test with 3 players
- [ ] Test with 6 players
- [ ] Test ranker rotation across multiple rounds
- [ ] Test disconnection during card submission

---

## Implementation Order

### Step 1: Update CardSubmission (Immediate Fix)
Rewrite `CardSubmission.tsx` with ranker check - this fixes the immediate bug.

**Time**: 10 minutes

### Step 2: Add Round Transition Screen
Create `RoundTransition.tsx` and wire into context/router.

**Time**: 20 minutes

### Step 3: Add Visual Polish
Create `RankerBadge`, update CSS, add animations.

**Time**: 15 minutes

### Step 4: Testing & Refinement
Run through all test cases, fix edge cases.

**Time**: 30 minutes

**Total**: ~75 minutes

---

## Edge Cases to Handle

### Edge Case 1: Player Disconnects During Card Submission

**Current Behavior**: Disconnected player auto-submits after 30s

**UI Impact**:
- Ranker should see player marked as disconnected
- Counter should still increment when auto-submit happens

**Solution**: Add disconnection indicator in player list.

### Edge Case 2: Ranker Disconnects

**Current Behavior**: Auto-submit random ranking after 30s

**UI Impact**:
- All players should see "Ranker disconnected" message
- Still wait for auto-submit

**Solution**: Add special message in waiting screen.

### Edge Case 3: All Non-Rankers Submit Instantly

**Current Behavior**: Phase advances immediately

**UI Impact**:
- Round transition might be skipped if too fast

**Solution**: Ensure minimum 3-second display of round transition.

### Edge Case 4: Single Player is Ranker Multiple Rounds in Row

**Scenario**: 3 players, 10 rounds → each player is ranker 3-4 times

**UI Impact**: Should be clear each time

**Solution**: Round transition always shows, even for same ranker.

---

## Future Enhancements

### Enhancement 1: Animated Ranker Crown
Add CSS animation to crown emoji that pulses or rotates.

### Enhancement 2: Sound Effects
- Sound when transitioning to new round
- Sound when all players submit
- Different sound for ranker vs non-ranker

### Enhancement 3: Ranker Stats Preview
Show in round transition:
- "Alice has been ranker 2 times"
- "Average score when Alice ranks: 3.5"

### Enhancement 4: Card Submission Timer
Add optional countdown timer (e.g., 60 seconds) for card submission.

---

## Summary

This plan provides:

✅ **Clear ranker identification** at round start
✅ **Differentiated UI** for ranker vs non-ranker
✅ **Progress tracking** with visual feedback
✅ **Smooth transitions** between phases
✅ **Proper player counts** (excluding ranker)

All bugs identified in `start_research.md` are addressed with complete code solutions.

---

## Detailed Implementation TODO List

### Phase 1: Core Card Submission Fix (Critical Priority)

#### Task 1.1: Update CardSubmission Component Structure
- [x] Open `client/src/screens/CardSubmission.tsx`
- [x] Add `isRanker` check: `const isRanker = lobbyState.currentRankerId === playerId;`
- [x] Add `ranker` lookup: `const ranker = lobbyState.players.find((p) => p.id === lobbyState.currentRankerId);`
- [x] Fix player count: Change `lobbyState.players.length` to `lobbyState.players.length - 1`
- [x] Create `totalNonRankers` constant: `const totalNonRankers = lobbyState.players.length - 1;`
- [x] Replace `submittedCount` calculation to use `lobbyState.submittedPlayerIds.length`

#### Task 1.2: Build Ranker Waiting View
- [x] Add conditional rendering: `{isRanker ? ( ... ) : ( ... )}`
- [x] Create ranker header section with crown emoji (👑)
- [x] Add "You are the Ranker!" title
- [x] Add "Waiting for other players..." message
- [x] Create progress section with label "Submissions Progress"
- [x] Add progress counter: `{submittedCount} / {totalNonRankers}`
- [x] Build progress bar with dynamic width: `width: ${(submittedCount / totalNonRankers) * 100}%`
- [x] Add purple gradient background to progress bar
- [x] Implement player list showing all non-rankers
- [x] Filter players: `.filter((p) => p.id !== lobbyState.currentRankerId)`
- [x] Map through filtered players to create status cards
- [x] Add checkmark SVG icon for submitted players
- [x] Add "Waiting..." text for non-submitted players
- [x] Style player cards with background, padding, rounded corners

#### Task 1.3: Build Non-Ranker Submission View
- [x] Create non-ranker conditional block (else branch)
- [x] Add nested conditional for `!hasSubmitted` state
- [x] Create info banner showing ranker's name
- [x] Add label "Your Card" for textarea
- [x] Change input to textarea (multi-line support)
- [x] Set textarea rows to 3
- [x] Add character counter: `{cardText.length} / 100 characters`
- [x] Add `autoFocus` attribute to textarea
- [x] Update `onChange` handler to use `setCardText` (not array)
- [x] Update button `disabled` logic to check `!cardText.trim()`
- [x] Add focus ring styles: `focus:ring-2 focus:ring-purple-500`

#### Task 1.4: Build Post-Submission Confirmation View
- [x] Add else block for `hasSubmitted` state (non-ranker who submitted)
- [x] Create success banner with green background
- [x] Add checkmark emoji (✓)
- [x] Add "Card Submitted!" heading
- [x] Add "Waiting for other players..." message
- [x] Create progress display showing submission count
- [x] Add progress text: `{submittedCount} of {totalNonRankers} players have submitted`
- [x] Build green progress bar with animation
- [x] Set transition duration: `transition-all duration-500`

#### Task 1.5: Add Round Header with Ranker Badge
- [x] Create top header section above main content
- [x] Add white rounded card container
- [x] Create flex layout with space-between
- [x] Add left section with title "Card Submission"
- [x] Add round indicator: `Round {currentRound} of {totalRounds}`
- [x] Add right section with "Current Ranker" label
- [x] Create ranker badge with yellow background and border
- [x] Display ranker's display name in badge
- [x] Add crown emoji to badge (optional)

#### Task 1.6: Update State Management
- [x] Change `cardTexts` array state to single `cardText` string
- [x] Update `useState` declaration: `useState<string>('')`
- [x] Update `handleSubmit` to emit single text value
- [x] Add `setCardText('')` to clear input after submission
- [x] Remove array indexing (`[0]`) from all state references

#### Task 1.7: Test Card Submission Component
- [x] Run `npm run typecheck` to check for TypeScript errors
- [ ] Test ranker view shows waiting screen (no input field)
- [ ] Test non-ranker view shows card input
- [ ] Verify progress counter shows correct denominator
- [ ] Test card submission updates UI correctly
- [ ] Verify ranker sees real-time submission updates
- [ ] Test with 3 players (2 non-rankers)
- [ ] Test with 6 players (5 non-rankers)

---

### Phase 2: Round Transition Screen

#### Task 2.1: Create RoundTransition Component
- [x] Create new file: `client/src/screens/RoundTransition.tsx`
- [x] Add imports: `useEffect, useState, useGame`
- [x] Create component export: `export function RoundTransition()`
- [x] Add `useGame` hook to get lobby state
- [x] Create `countdown` state: `useState(3)`
- [x] Implement countdown effect with `useEffect`
- [x] Add 1-second interval timer
- [x] Add cleanup function to clear timeout
- [x] Add dependency array `[countdown]`

#### Task 2.2: Build Transition UI Layout
- [x] Create full-screen container with gradient background
- [x] Add flex centering: `flex items-center justify-center`
- [x] Create white card container with max-width 2xl
- [x] Add fade-in animation class: `animate-fadeIn`
- [x] Create round number section at top
- [x] Display large round number: `text-5xl font-bold`
- [x] Add "of X" total rounds indicator below
- [x] Create ranker announcement box with yellow gradient
- [x] Add yellow border: `border-2 border-yellow-400`
- [x] Display "The Ranker is" label
- [x] Show ranker display name in large font (text-4xl)

#### Task 2.3: Implement Countdown Logic
- [x] Add conditional rendering for countdown
- [x] Show countdown number if `countdown > 0`
- [x] Style countdown: `text-6xl font-bold`
- [x] Add pulse animation: `animate-pulse`
- [x] Show "Get ready..." message when countdown reaches 0
- [x] Ensure countdown auto-decrements from 3 to 0

#### Task 2.4: Add Ranker Lookup
- [x] Add ranker lookup before return: `const ranker = lobbyState.players.find(...)`
- [x] Use `lobbyState.currentRankerId` for comparison
- [x] Display ranker's `displayName` in UI
- [x] Add fallback: `ranker?.displayName || 'Unknown'`
- [x] Handle null/undefined cases gracefully

---

### Phase 3: Context & State Management

#### Task 3.1: Update GameContext Interface
- [x] Open `client/src/context/GameContext.tsx`
- [x] Add `showRoundTransition: boolean` to `GameContextState` interface
- [x] Update `initialState` object with `showRoundTransition: false`
- [x] Add JSDoc comment explaining the field

#### Task 3.2: Add Transition Actions
- [x] Add `SHOW_ROUND_TRANSITION` to `GameAction` type union
- [x] Add `HIDE_ROUND_TRANSITION` to `GameAction` type union
- [x] Both actions should have no additional payload
- [x] Format: `{ type: 'SHOW_ROUND_TRANSITION' }`

#### Task 3.3: Update Reducer Logic
- [x] Add case for `SHOW_ROUND_TRANSITION` in `gameReducer`
- [x] Return state with `showRoundTransition: true`
- [x] Add case for `HIDE_ROUND_TRANSITION`
- [x] Return state with `showRoundTransition: false`
- [x] Preserve all other state fields with spread operator

#### Task 3.4: Trigger Transition on Phase Change
- [x] Locate `handlePhaseChanged` function in GameContext
- [x] Add check: `if (data.phase === 'card_submission')`
- [x] Inside check, dispatch `SHOW_ROUND_TRANSITION`
- [x] Add `setTimeout` to dispatch `HIDE_ROUND_TRANSITION` after 3000ms
- [x] Store timeout reference for cleanup (optional)
- [x] Keep existing `SET_LOBBY` dispatch after transition logic
- [x] Test that transition only shows for card_submission phase

---

### Phase 4: Router Integration

#### Task 4.1: Import RoundTransition Component
- [x] Open `client/src/App.tsx`
- [x] Add import: `import { RoundTransition } from './screens/RoundTransition.tsx';`
- [x] Verify import path is correct
- [x] Check for TypeScript errors

#### Task 4.2: Update GameRouter Logic
- [x] Locate `GameRouter` function component
- [x] Destructure `showRoundTransition` from `state`
- [x] Add early return check before other conditionals
- [x] Check: `if (showRoundTransition && lobbyState?.phase === 'card_submission')`
- [x] Return `<RoundTransition />` if condition is true
- [x] Ensure this check happens BEFORE phase switch statement
- [x] Verify order: showRoundTransition → gameOverData → !lobbyState → phase switch

#### Task 4.3: Test Router Flow
- [ ] Start game and verify transition shows
- [ ] Verify transition lasts exactly 3 seconds
- [ ] Confirm automatic transition to CardSubmission
- [ ] Test that other phases don't show transition
- [ ] Test rapid phase changes don't break routing

---

### Phase 5: Visual Enhancements

#### Task 5.1: Create RankerBadge Component
- [x] Create new file: `client/src/components/RankerBadge.tsx`
- [x] Define `RankerBadgeProps` interface
- [x] Add `rankerName: string` property
- [x] Add `isCurrentPlayer?: boolean` optional property
- [x] Create functional component export
- [x] Add conditional styling based on `isCurrentPlayer`
- [x] Yellow background if current player, purple otherwise
- [x] Add crown emoji (👑) to badge
- [x] Create two-line layout: label + name
- [x] Style label as small text: `text-xs`
- [x] Style name as bold: `font-bold`
- [x] Add inline-flex for horizontal layout
- [x] Add gap between emoji and text: `gap-2`
- [x] Add padding and rounded corners
- [x] Add 2px border with appropriate color

#### Task 5.2: Add CSS Animations
- [x] Open `client/src/index.css`
- [x] Add `@keyframes pulse-slow` definition
- [x] Set 0% and 100% to `opacity: 1`
- [x] Set 50% to `opacity: 0.5`
- [x] Add `.animate-pulse-slow` class
- [x] Set animation: `pulse-slow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite`
- [x] Test animation renders smoothly
- [x] Add fade-in animation for RoundTransition (if needed)

#### Task 5.3: Integrate RankerBadge (Optional)
- [ ] Import RankerBadge in CardSubmission.tsx
- [ ] Replace inline ranker badge with component
- [ ] Pass `rankerName={ranker?.displayName || 'Unknown'}`
- [ ] Pass `isCurrentPlayer={isRanker}` for ranker's view
- [ ] Test badge appears correctly
- [ ] Verify conditional styling works

---

### Phase 6: Server-Side Improvements

#### Task 6.1: Add Server Logging for Ranker Selection
- [x] Open `server/src/game.ts`
- [x] Locate `startRound` function
- [x] Add log after ranker selection: `console.log('Round X: Ranker is Y')`
- [x] Include rankerIndex in log
- [x] Add log showing full `rankerOrder` array
- [x] Format: `console.log('Ranker order:', state.rankerOrder.join(', '))`
- [x] Test logs appear in server terminal

#### Task 6.2: Add Game Start Logging
- [x] Open `server/src/handlers/gameHandlers.ts`
- [x] Locate `start-game` handler
- [x] Add log after `startGame(state)` call
- [x] Log: `console.log('Game started in lobby X, ranker: Y')`
- [x] Include lobby code and initial ranker ID
- [x] Test log appears when game starts

#### Task 6.3: Verify Phase Change Logging
- [x] Check existing logs in `advancePhase` function
- [x] Ensure phase transitions are logged
- [x] Add log for card submission completion
- [x] Log: `console.log('All cards submitted, advancing phase')`
- [x] Test logs help debug phase flow

---

### Phase 7: Testing & Quality Assurance

#### Task 7.1: TypeScript Validation
- [x] Run `npm run typecheck` in project root
- [x] Fix any type errors in CardSubmission.tsx
- [x] Fix any type errors in RoundTransition.tsx
- [x] Fix any type errors in GameContext.tsx
- [x] Fix any type errors in App.tsx
- [x] Verify all imports resolve correctly
- [x] Check shared types are imported properly

#### Task 7.2: Test Round Start Flow
- [ ] Create lobby with 3 players
- [ ] Assign player names (e.g., Alice, Bob, Charlie)
- [ ] Host clicks "Start Game"
- [ ] Verify RoundTransition appears for all players
- [ ] Verify correct ranker name is displayed
- [ ] Verify "Round 1 of 3" displays correctly
- [ ] Verify countdown works (3, 2, 1)
- [ ] Verify auto-transition to CardSubmission after 3 seconds

#### Task 7.3: Test Ranker View
- [ ] Identify which player is ranker from transition screen
- [ ] Check ranker's screen after transition
- [ ] Verify NO card input field is shown
- [ ] Verify "You are the Ranker!" message displays
- [ ] Verify crown emoji shows
- [ ] Verify waiting message displays
- [ ] Verify progress bar shows 0 / 2
- [ ] Verify player list shows both non-rankers
- [ ] Verify both players show "Waiting..." status

#### Task 7.4: Test Non-Ranker Submission
- [ ] Switch to non-ranker player 1
- [ ] Verify card input field is visible
- [ ] Verify ranker's name shows in info banner
- [ ] Type card text (e.g., "Test card 1")
- [ ] Verify character counter updates
- [ ] Click "Submit Card" button
- [ ] Verify success screen appears
- [ ] Verify green checkmark shows
- [ ] Verify "Card Submitted!" message
- [ ] Verify progress shows "1 of 2 players"

#### Task 7.5: Test Ranker View Updates
- [ ] Switch to ranker's screen
- [ ] Verify progress bar updated to 1 / 2
- [ ] Verify progress bar width is ~50%
- [ ] Verify player 1 shows green checkmark
- [ ] Verify player 1 status says "Submitted"
- [ ] Verify player 2 still says "Waiting..."

#### Task 7.6: Test Second Submission & Phase Change
- [ ] Switch to non-ranker player 2
- [ ] Submit card (e.g., "Test card 2")
- [ ] Verify success screen appears
- [ ] Switch to ranker's screen
- [ ] Verify progress updates to 2 / 2
- [ ] Verify both players show "Submitted" status
- [ ] Verify progress bar is 100% width
- [ ] Verify phase automatically advances
- [ ] Check next phase loads (authorship_guess or ranking)

#### Task 7.7: Test Multi-Round Ranker Rotation
- [ ] Complete round 1 fully
- [ ] Reach round 2 start
- [ ] Verify new RoundTransition appears
- [ ] Verify DIFFERENT player is now ranker
- [ ] Verify round shows "Round 2 of 3"
- [ ] Verify new ranker sees waiting screen
- [ ] Verify previous ranker can now submit cards
- [ ] Complete round 2
- [ ] Verify round 3 has third player as ranker

#### Task 7.8: Test with Different Player Counts
- [ ] Test with 3 players (minimum)
  - [ ] Verify 2 non-rankers must submit
  - [ ] Verify progress shows "X / 2"
- [ ] Test with 4 players
  - [ ] Verify 3 non-rankers must submit
  - [ ] Verify progress shows "X / 3"
- [ ] Test with 6 players
  - [ ] Verify 5 non-rankers must submit
  - [ ] Verify player list scrolls properly
  - [ ] Verify all submissions tracked correctly

#### Task 7.9: Test Edge Cases
- [ ] Test player disconnect during card submission
  - [ ] Check if disconnected player removed from count
  - [ ] Verify game doesn't hang waiting for disconnected player
- [ ] Test rapid submissions (all players submit quickly)
  - [ ] Verify transition screen still shows full 3 seconds
  - [ ] Verify no race conditions in state updates
- [ ] Test same player as ranker multiple rounds
  - [ ] Set roundCount to player count * 2
  - [ ] Verify ranker rotation wraps correctly
  - [ ] Verify UI updates properly each time
- [ ] Test browser refresh mid-round
  - [ ] Refresh ranker's browser
  - [ ] Verify reconnection works
  - [ ] Verify UI state restores correctly

#### Task 7.10: Visual & UX Testing
- [ ] Verify all text is readable (contrast, size)
- [ ] Verify colors match design (purple, yellow, green)
- [ ] Test on mobile viewport (320px width)
- [ ] Test on tablet viewport (768px width)
- [ ] Test on desktop viewport (1920px width)
- [ ] Verify animations are smooth (no jank)
- [ ] Test progress bar fills smoothly
- [ ] Verify emoji render correctly (crown, checkmark)
- [ ] Test with long player names (20+ characters)
- [ ] Test with special characters in names

---

### Phase 8: Documentation & Cleanup

#### Task 8.1: Update Code Comments
- [ ] Add JSDoc comment to RoundTransition component
- [ ] Add JSDoc comment to RankerBadge component
- [ ] Add inline comments explaining ranker logic in CardSubmission
- [ ] Document countdown timer logic in RoundTransition
- [ ] Add comment explaining transition state in GameContext

#### Task 8.2: Remove Debug Logging (Optional)
- [ ] Review all `console.log` statements added
- [ ] Decide which logs to keep for production
- [ ] Remove or comment out temporary debug logs
- [ ] Keep critical error logs
- [ ] Keep server-side logs for debugging

#### Task 8.3: Update README (Optional)
- [ ] Document ranker rotation mechanism
- [ ] Explain round transition feature
- [ ] Add screenshots of ranker/non-ranker views
- [ ] Update feature list
- [ ] Note any known limitations

#### Task 8.4: Verify File Checklist
- [ ] Confirm `client/src/screens/RoundTransition.tsx` created
- [ ] Confirm `client/src/components/RankerBadge.tsx` created (if used)
- [ ] Confirm `client/src/context/GameContext.tsx` modified
- [ ] Confirm `client/src/App.tsx` modified
- [ ] Confirm `client/src/screens/CardSubmission.tsx` rewritten
- [ ] Confirm `client/src/index.css` modified (animations)
- [ ] Confirm `server/src/game.ts` modified (logging)
- [ ] No other files inadvertently changed

---

### Phase 9: Final Verification

#### Task 9.1: Run Full Build
- [ ] Run `npm run build` in project root
- [ ] Verify no build errors
- [ ] Verify no TypeScript errors
- [ ] Verify no linting errors
- [ ] Check bundle size is reasonable

#### Task 9.2: Production Test
- [ ] Start production build locally
- [ ] Test complete game flow start to finish
- [ ] Verify all features work in production mode
- [ ] Test with multiple browser tabs (simulate players)
- [ ] Check browser console for errors
- [ ] Check network tab for failed requests

#### Task 9.3: Cross-Browser Testing
- [ ] Test in Chrome
- [ ] Test in Firefox
- [ ] Test in Safari (if available)
- [ ] Test in Edge
- [ ] Verify consistent behavior across browsers

#### Task 9.4: Performance Check
- [ ] Check page load time
- [ ] Verify smooth transitions (no lag)
- [ ] Check memory usage (no leaks)
- [ ] Verify WebSocket connection is stable
- [ ] Test with 6 players simultaneously

---

## Task Summary by Priority

### P0 - Critical (Must Complete)
- [ ] Task 1.1-1.7: Card Submission component rewrite
- [ ] Task 3.1-3.4: Context state management
- [ ] Task 7.1: TypeScript validation
- [ ] Task 7.2-7.6: Core functionality testing

### P1 - High (Should Complete)
- [ ] Task 2.1-2.4: Round Transition component
- [ ] Task 4.1-4.3: Router integration
- [ ] Task 7.7-7.9: Extended testing

### P2 - Medium (Nice to Have)
- [ ] Task 5.1-5.3: Visual enhancements
- [ ] Task 6.1-6.3: Server-side logging
- [ ] Task 7.10: Visual/UX testing

### P3 - Low (Optional)
- [ ] Task 8.1-8.4: Documentation
- [ ] Task 9.1-9.4: Final verification

---

## Estimated Time per Phase

| Phase | Tasks | Estimated Time |
|-------|-------|----------------|
| Phase 1: Card Submission Fix | 7 tasks | 25 minutes |
| Phase 2: Round Transition | 4 tasks | 15 minutes |
| Phase 3: Context Updates | 4 tasks | 10 minutes |
| Phase 4: Router Integration | 3 tasks | 5 minutes |
| Phase 5: Visual Enhancements | 3 tasks | 10 minutes |
| Phase 6: Server Improvements | 3 tasks | 5 minutes |
| Phase 7: Testing | 10 tasks | 40 minutes |
| Phase 8: Documentation | 4 tasks | 10 minutes |
| Phase 9: Final Verification | 4 tasks | 15 minutes |
| **TOTAL** | **42 tasks** | **~135 minutes** |

---

## Quick Start Checklist (Minimum Viable Fix)

If time is limited, complete these tasks first for a working implementation:

1. ✅ Task 1.1: Add ranker check to CardSubmission
2. ✅ Task 1.2: Build ranker waiting view
3. ✅ Task 1.3: Build non-ranker submission view
4. ✅ Task 1.4: Build post-submission view
5. ✅ Task 1.5: Add round header with ranker badge
6. ✅ Task 1.6: Update state management
7. ✅ Task 7.1: Run TypeScript check
8. ✅ Task 7.3: Test ranker view
9. ✅ Task 7.4: Test non-ranker submission
10. ✅ Task 7.6: Test phase change

**Estimated time for quick start**: 30-40 minutes

This provides the core bug fix without the transition screen enhancement.
