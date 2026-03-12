UI fixes:
- Switching teams should be done with a button on the User (done, needs to be tested)
- Hookup MatchStarted/Aborted/Completed and Countdown to the Match State in the UI (done, Started needs testing)
- Add a second row to the Player cards to show the mods and stuff (and style? will tournaments ever need freestyle support..?) (done, needs testing)
- Hook up /rooms/{room}/playlist/{playlist}/scores api to put in the scores somewhere (done, only UI lightly tested)
- Add ability to see/change Mod Settings (changing might be too hard?)
- Add Ban User to the UI (make sure to wait until it's actually in prod though..)

Backend fixes:
- Replace the redundant & hardcoded S->C methods with something that can be easily genMethods-ed
