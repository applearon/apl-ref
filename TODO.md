UI fixes:
- Switching teams should be done with a button on the User (broken when originally joining/when grey team)
    - might not properly change since username lookup takes some time, maybe force it to queue? or fallback to user_id until the lookup suceeds)
- Player Mod Row Should also show freestyle
- Add ability to change Mod Settings
- Add Ban User to the UI

- Make stuff resize properly to smaller window sizes
- Playlist Items (and players?) should be in their own thing for scrolling
- Rename some of the classes to be more accurate/generic
    - Replace some of them with tailwind equivalents

New Features:
- Console mode/section for !mp style reffing (bancho commands done some UI updating problems, new commands not done)
- Referee Invited popup to join up
- Rewrite it to support operating multiple rooms
- Add more error handling on the osu api side
- system message when everyone is ready
- resize scores or starting size or something to make it not scroll down when scores are added
    - (make it scroll in its own thing?)

Bugs:
- Joining room doesn't properly set status (done, needs testing)
- Make scores comma seperated
- Room Settings UI element (and maybe others) aren't being updated on the requisite Events
- Getting kicked from a room as a referee doesn't reset the UI
- still some OK: null kicking around (inviting ref)
- how do you properly leave a room now lmao
- weirdness with dragging text around closing UIs? (i cant reproduce)
- reloading page not retaining the state of referee-ing
