# Gameplay Report: Ranking Game

## 1. Overview

A multiplayer social deduction / party game where one player (the **Ranker**) secretly ranks 5 items, and the other players attempt to predict that ranking. The game tests how well friends know each other's preferences, priorities, and thought patterns.

---

## 2. Lobby & Session Management

### Players
- **Minimum:** 3 players (1 ranker + 2 guessers)
- **Maximum:** 6 players (1 ranker + 5 guessers/submitters)

### Host Setup
- The host creates a new lobby and configures the game settings before starting:
  - **Guessing Mode**: Collective Guess (one shared answer) or Individual Guesses (each player submits separately).
  - **Optional Features** (toggles):
    - **Ranker Guesses Authorship**: The ranker tries to identify who submitted which card before ranking.
    - **Personal Ranking**: Players also rank the cards by their own preference after guessing the ranker's ranking.
    - **Prompts/Categories**: Enable curated prompts to guide card submissions (off by default — see Section 8).
  - **Round Count**: How many rounds to play (default: one per player so everyone ranks once).
- Once settings are locked in and enough players have joined, the host starts the game.

### Joining
- The **host** creates a lobby and receives a short, shareable **join code** (e.g., `AXBT`).
- Other players enter the code to join. No account creation required — just a display name and the code.
- The host controls when the game starts and manages lobby settings (game mode, number of rounds, etc.).

---

## 3. Round Structure

Each round proceeds through distinct phases:

### Phase 1: Role Assignment
- One player is designated as the **Ranker** for the round.
- All other players are **Guessers**.
- The ranker role should rotate each round so everyone gets a turn.

### Phase 2: card Submission
- Each non-ranker player submits **a card** (a word, phrase, or response to a prompt).
- The game can also offer **generated suggestions** that players can pick from instead of writing their own.

### Phase 3: Auto-Fill to 5
- The game **always requires exactly 5 cards** for the ranker to rank.
- With `N` total players, there are `N - 1` submitters, producing `N - 1` cards.
- The game auto-generates `6 - N` cards to bring the total to 5.

| Total Players | Submitters | Player cards | Auto-Generated | Total |
|---------------|------------|----------------|----------------|-------|
| 3             | 2          | 2              | 3              | 5     |
| 4             | 3          | 3              | 2              | 5     |
| 5             | 4          | 4              | 1              | 5     |
| 6             | 5          | 5              | 0              | 5     |

### Phase 4: Ranking (Ranker Only)
- The ranker sees all 5 cards (shuffled, with no indication of authorship or which are auto-generated).
- The ranker assigns ranks **1 through 5**, where **1 = top / best / most preferred**.
- This ranking is hidden from other players until the reveal.

### Phase 5: Guessing (Non-Ranker Players)
- The other players now see the same 5 cards and must predict how the ranker ranked them.
- **Two modes available:**

#### Mode A: Collective Guess
- All non-ranker players discuss (in person or via chat) and submit **one shared ranking** as a group.
- Encourages debate and social interaction.
- Everyone sees the **same board** on their screen in real time. When any guesser drags a card to a new position, the change instantly appears on every other guesser's screen — like editing a shared document together.
- Once the group is happy with the order, any guesser (or the host) can hit **"Lock In"** to finalize the answer. This submits the collective guess and moves the game forward.

#### Mode B: Individual Guesses
- Each non-ranker player independently submits their **own predicted ranking** of all 5 cards.
- No discussion required (or discussion allowed but separate submissions).
- Creates more interesting reveals since players can differ.

### Phase 6: Reveal & Scoring
- The ranker's true ranking is revealed.
- Each guess is compared position-by-position against the true ranking.
- **Points = number of cards placed in the correct position** (0 to 5 per guess).

---

## 4. Scoring System

### Per-Round Scoring
- In **Collective Mode**: all guessers earns the same number of points based on how many cards they placed correctly.
- In **Individual Mode**: each player earns 0-5 points independently based on their own input.

### Ranker Stats (Tracked Across Rounds)
- **Most Predictable Ranker**: the ranker whose rankings were guessed most accurately on average. This player is an "open book" — friends know them well.
- **Least Predictable Ranker**: the ranker whose rankings were hardest to guess. This player is mysterious or contrarian.
- These stats add a meta-game layer and provide fun end-of-game superlatives.

### Game-Level Scoring
- Accumulated points across all rounds determine the winner (in individual mode).
- In collective mode, the group score per round is tracked but the competitive element shifts more toward the ranker stats and bonus interactions.

---

## 5. Bonus Interactions / Secondary Mechanics

### 5a. Ranker Guesses Authorship
- Before the ranking, the ranker can **guess which player submitted which card**.
- The ranker has the optional to label auto-generated cards.
- Potential scoring: bonus points for correct authorship guesses.
- Adds a layer of social deduction — the ranker is trying to read their friends' writing style, humor, or preferences.

### 5b. Personal Ranking Mode
- In addition to (or instead of) guessing the ranker's ranking, each player can submit **how they personally would rank the 5 cards** — ranking by their own preference, not trying to predict the ranker.
- After the reveal, the game shows a comparison:
  - How each player would rank vs. how the ranker ranked.
  - How similar or different everyone's personal tastes are.
  - Who has the most aligned preferences with the ranker.
- This mode is about **self-expression**, not prediction. It's a "forget the ranker, how do YOU feel?" exercise.
- Can produce entertaining moments: "Wait, you actually like pineapple on pizza MORE than pepperoni?!"

---

## 6. Reveal Dynamics & Social Moments

The reveal phase is where the game shines socially. Key moments include:

### In Individual Mode
- **Split predictions**: when guessers disagree on a particular position, the reveal shows who read the ranker better.
- **Unanimous wrong guesses**: everyone thought the ranker would rank something high, but they ranked it last — sparks conversation about why.
- **One player nails it**: someone gets 5/5 — they clearly know the ranker well (or got lucky).

### Authorship Reveal
- When the ranker correctly guesses who wrote what: "I knew that was you!"
- When the ranker is wrong: "You thought I wrote THAT?!"

### Personal Ranking Comparison
- Seeing how differently everyone ranks the same 5 items reveals genuine preference differences.
- Potential for heatmap or matrix view showing all players' personal rankings side by side.
- Highlights alignment and divergence within the friend group.

---

## 7. Game Flow Summary

```
1. Host creates lobby -> gets join code
2. Players join with code + display name
3. Game starts -> Ranker is assigned for round 1
4. Prompt/category is shown (optional)
5. Non-rankers submit their cards
6. Game auto-fills remaining slots to reach 5
7. Ranker sees all 5 cards (shuffled)
8. (Optional) Ranker guesses who wrote which card + authorship revealed
9. Ranker ranks the cards 1-5
10. Non-rankers guess the ranker's ranking (collective or individual)
11. (Optional) Non-rankers submit their personal ranking
12. Reveal: true ranking shown, scores calculated, personal rankings compared
13. Next round -> new ranker -> repeat from step 4
14. After all rounds: final scores, superlatives, stats
```

---

## 8. Edge Cases & Design Considerations

### Minimum Players (3 players)
- 2 submitters, so 3 of the 5 cards are auto-generated.
- Ensures at least 2 guessers for meaningful social interaction.
- Authorship guessing has enough ambiguity to be interesting.

### Auto-Generated Cards
- By default, card submission is **free-form** — there are no prompts or categories. Players write whatever they want.
- **Prompts/Categories** are an optional feature the host can enable in lobby settings. When enabled, a prompt guides submissions (e.g., "Best pizza toppings").
- Auto-generated cards should be indistinguishable in style from player submissions (to make authorship guessing fair and ranking meaningful).
- In free-form mode, generated cards need to be plausible and varied.
- When prompts are enabled, generated cards must be contextually relevant to the prompt.


### Tie-Breaking in Rankings
- Rankings are strict 1-5 with no ties. The UI must enforce this (drag-to-rank or assign unique numbers).

### Scoring: Exact Position Only
- Only **exact position matches** count. A card ranked 2nd by the ranker and guessed as 3rd scores 0 for that card.

### Round Count
- With N players, a natural game length is N rounds (everyone ranks once).
- Could also allow custom round counts or "infinite" play until the host ends the session.

### Prompt Source (When Enabled)
- If the host enables prompts, sources can include:
  - Game-provided prompt library (curated categories/questions).
  - Player-submitted prompts (the host or a rotating player picks the prompt).

---

## 9. Mode Summary

| Mode | Description |
|------|-------------|
| **Collective Guess** | All guessers agree on one shared ranking prediction |
| **Individual Guess** | Each guesser submits their own ranking prediction independently |
| **Authorship Guess** | Ranker tries to identify who submitted which card |
| **Personal Ranking** | Each player ranks the cards by their own preference (not predicting the ranker) |

These modes can be mixed and matched per game or per round.

---

## 10. Key Takeaways

1. **The core loop is simple**: submit, rank, guess, reveal. Easy to learn, hard to master.
2. **Social deduction is central**: success depends on knowing your friends, not skill or luck.
3. **The 5-card constraint with auto-fill** is elegant — it keeps the game balanced regardless of player count and adds uncertainty (which cards are real?).
4. **Multiple layers of interaction** (predicting rankings, guessing authorship, personal rankings) keep rounds rich without being overwhelming.
5. **The reveal is the payoff** — the game is designed to generate conversation, laughter, and surprises.
6. **Stat tracking** (most/least predictable ranker) adds a persistent meta-game across rounds.
7. **Two guessing modes** (collective vs. individual) allow the game to flex between cooperative and competitive play styles.
