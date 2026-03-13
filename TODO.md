UI fixes:
- Switching teams should be done with a button on the User (done, needs to be tested)
- Add a second row to the Player cards to show the mods and stuff (and style? will tournaments ever need freestyle support..?) (done, needs testing)
- Add ability to see/change Mod Settings (changing might be too hard?)
- Add Ban User to the UI (make sure to wait until it's actually in prod though..)

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
- Players tab is broken (Not removing players when they're gone, & mods selection not working)
- Calling GetBeatmap more than needs to happen (ie PlaylistItemEdit or whatever but the beatmap_id stays the same)
