UI fixes:
- Sometimes players joing with the wrong team (maybe since username lookup takes some time, maybe force it to queue? or fallback to user_id until the lookup suceeds)
- Player Mod Row Should also show freestyle
- Add ability to change Mod Settings (works with !mp mods)
- Add Ban User to the UI

- Make stuff resize properly to smaller window sizes
- Playlist Items (and players?) should be in their own thing for scrolling (done!)
- Rename some of the classes to be more accurate/generic
    - Replace some of them with tailwind equivalents

New Features:
- Referee Invited popup to join up
- Rewrite it to support operating multiple rooms
    - Class rewrite needs to be done
    - Notifications/sound effects for when things happen (all ready, map end etc)
- Add more error handling on the osu api side
- system message when everyone is ready
- resize scores or starting size or something to make it not scroll down when scores are added
    - (make it scroll in its own thing?)


Bugs:
- Room Settings UI element (and maybe others) aren't being updated on the requisite Events
- Getting kicked from a room as a referee doesn't reset the UI (done, needs more testing)
- still some OK: null kicking around (inviting ref)
- how do you properly leave a room now lmao (restarting the app i guess...)
- weirdness with dragging text around closing UIs? (i cant reproduce)
    - Probably should just fully remove that for now
- reloading page not retaining the state of referee-ing
- (IMPORTANT) Occasionally osu!api doesn't work??? only recounted once (mumei)

# 1.0 Blocking Issues
- Support operating multiple rooms at once
- Notification sounds
    - All players ready (or spectating)
    - MatchEnded
    - Timer Ended
- Finish dGeist UI Redesign
    - Incl. fix score UI scrolling
- Make resizing not completely kill itself
    - Shrink sidebars on smaller screens
- Show required_mod settings
- Edit required_mod settings
- Host a proper scrim/tournament with apl!ref
- !mp commands tested and properly update all UI elements
    - Make sure no bad states can be reached
    - Make sure they all align with lazer mp standards
