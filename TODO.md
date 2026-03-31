UI fixes:
- Switching teams should be done with a button on the User (done, still needs to be tested)
- Player Mod Row Should also show freestyle
- Add ability to change Mod Settings
- Add Ban User to the UI

- Make stuff resize properly to smaller window sizes
- Playlist Items (and players?) should be in their own thing for scrolling
- Rename some of the classes to be more accurate/generic
    - Replace some of them with tailwind equivalents

New Features:
- Console mode/section for !mp style reffing
- Referee Invited popup to join up
- Rewrite it to support operating multiple rooms
- Add more error handling on the osu api side

- Calling GetBeatmap more than needs to happen (ie PlaylistItemEdit or whatever but the beatmap_id stays the same)


Bugs:
- Playlist item score lookup fails hard (fixed, needs testing on team_versus)
- Joining room doesn't properly set status (done, needs testing)
