UI fixes:
- Sometimes players joing with the wrong team (maybe since username lookup takes some time, maybe force it to queue? or fallback to user_id until the lookup suceeds)
- Player Mod Row Should also show freestyle
- Add ability to change Mod Settings
- Add Ban User to the UI

- Make stuff resize properly to smaller window sizes
- Playlist Items (and players?) should be in their own thing for scrolling
- Rename some of the classes to be more accurate/generic
    - Replace some of them with tailwind equivalents

New Features:
- Console mode/section for !mp style reffing (bancho commands done some UI updating problems, new commands not done)
    - Rework them to align with lazer ref guide
- Referee Invited popup to join up
- Rewrite it to support operating multiple rooms
- Add more error handling on the osu api side
- system message when everyone is ready
- resize scores or starting size or something to make it not scroll down when scores are added
    - (make it scroll in its own thing?)
- Implement UI redesign (thank you dGeist)


Bugs:
- Room Settings UI element (and maybe others) aren't being updated on the requisite Events
- Getting kicked from a room as a referee doesn't reset the UI (done, needs more testing)
- still some OK: null kicking around (inviting ref)
- how do you properly leave a room now lmao (restarting the app i guess...)
- weirdness with dragging text around closing UIs? (i cant reproduce)
- reloading page not retaining the state of referee-ing
- (IMPORTANT) Occasionally osu!api doesn't work??? only recounted once (mumei)
