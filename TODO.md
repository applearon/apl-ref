UI fixes:
- Switching teams should be done with a button on the User (done, needs to be tested)
- Player Mod Row Should also show freestyle
- Add ability to see/change Mod Settings (changing might be too hard?)
- Add Ban User to the UI (make sure to wait until it's actually in prod though..)

- See if you can give players host (add "Add/Remove Referee" button too (done, untested))
- Add add user mod settings & have full names for mods selected to rightbar
- Remove ping button probably (add "Debug mode" in settings?)
- Make stuff resize properly to smaller window sizes
- Playlist Items (and players?) should be in their own thing for scrolling

Backend fixes:
- Replace the redundant & hardcoded S->C methods with something that can be easily genMethods-ed (done, not fully tested)

New Features:
- Console mode/section for !mp style reffing
- Referee Invited popup to join up
- Rewrite it to support operating multiple rooms

Bugs:
- Investigate broken chat (& add more error handling)
- Calling GetBeatmap more than needs to happen (ie PlaylistItemEdit or whatever but the beatmap_id stays the same)
