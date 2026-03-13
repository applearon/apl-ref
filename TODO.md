UI fixes:
- Switching teams should be done with a button on the User (done, needs to be tested)
- Hookup MatchStarted/Aborted/Completed and Countdown to the Match State in the UI (done, Started needs testing)
- Add a second row to the Player cards to show the mods and stuff (and style? will tournaments ever need freestyle support..?) (done, needs testing)
- Hook up /rooms/{room}/playlist/{playlist}/scores api to put in the scores somewhere (done, only UI lightly tested)
- Add ability to see/change Mod Settings (changing might be too hard?)
- Add Ban User to the UI (make sure to wait until it's actually in prod though..)

- Add mp link button
- See if you can give players host (add "Add/Remove Referee" button too)
- Add right sidebar (includes probably prettified events, maybe have user mod settings, and/or have full names for mods selected)
- Remove ping button probably (add "Debug mode" in settings?)
- Make stuff resize properly to smaller window sizes
- Playlist Items (and players?) should be in their own thing for scrolling

Backend fixes:
- Replace the redundant & hardcoded S->C methods with something that can be easily genMethods-ed

New Features:
- Console mode/section for !mp style reffing
- Referee Invited flow to join up


Bugs:
- Investigate broken chat (& add more error handling)
- Players tab is broken (Not removing players when they're gone)
- Calling GetBeatmap more than needs to happen (ie PlaylistItemEdit or whatever but the beatmap_id stays the same)
