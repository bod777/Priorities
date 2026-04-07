# Outstanding Tasks

- [X] Let's add a hidden side bar on the right hand side of the screen that will show you is in the lobby. It would be nice to see quickly what your display name is in that top right corner. After clicking on it, the sidebar should appear and show all the players, who you are, who is the host and whether a player disconnects. Additionally, it should have the users scores and the current game settings. Another ask separate to the sidebar is that there should be an alert pop up if a player disconnects in general. Don't implement anything, write a docs/lobby_list_plan.md to describe how you would implement and include a detailed todo list.

- [X] Implement guess authorship, a feature where after the cards are submitted by the guessers, the ranker must guess who submitted what card. It should be optional in the game settings. Every one the ranker guess correctly gets them a point at the end of the round. The guessing includes the auto generated cards.

- [X] Fix disconnection issue
- [X] Fix the authorship so it's not unknown even with disconnection
- [X] Move the authorship reveal to before the ranking
- [X] Capitalise the AI stuff
- [X] Let the ranker to see the changes in the ranking of the guessers
- [X] Hide how many cards have been submitted

- [X] Animation when the items move for the players

- [ ] Implement individual guessing

- [ ] Ranker can pick the funniest card from a round and the guesser who submitted that card gets a point. Alternative its a vote among all the users and the top card gets the point.

- [ ] In the settings, there should be a timer for how long card submission takes and ranker rankings and the guesser's deliberation. Defaulting to 90 seconds for the submission, 60 seconds for the ranking, 5 minutes for the ranking.

- [ ] I would like to add a new setting changing how the points work. Currently, you get a point for every card ranked correctly. This setting will award a half point if you rank a card within 1 card of its correct position. For example, we have these cards ["Apples","Baths","World Peace","A Sunday Roast","Kangeroos"]

The correct ranking is:
1. Apples
2. Baths
3. World Peace
4. A Sunday Roast
5. Kangeroos

The guessed ranking was:
1. Apples
2. World Peace
3. A Sunday Roast
4. Kangeroos
5. Baths

In the current scoring setting, the score would be:
1. Apples (+1)
2. World Peace (0)
3. A Sunday Roast (0)
4. Kangeroos (0)
5. Baths (0)

with a total of just 1.

So the points in the new system would be:
1. Apples (+1)
2. World Peace (+0.5)
3. A Sunday Roast (+0.5)
4. Kangeroos (+0.5)
5. Baths (0)

So the total is 2.5.

I am not sure what the usual name of this scoring system would be, could you research and work out an appropriate name? Don't implement anything yet.


- [ ] Add a game setting to let the guessers see the submitted cards of other guessers while they are submitting their own. 

- [ ] As a separate game setting, I think it would also be cool to implement a way for the guesser to see suggested cards from the system and use them if they want or refresh to see more suggestions. How would you implement? This is just a discussion, don't implement or create anything yet.

- [ ] Based on our session, what documentation should we write up to describe the changes that were made?

- [ ] Saving the results from the game. This is a big addition and needs a discussion on what is involved.