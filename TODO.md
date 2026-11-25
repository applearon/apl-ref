UI fixes:
- Player Mod Row Should also show freestyle
- Add ability to change Mod Settings (works with !mp mods)
- Add Ban User to the UI

- Make stuff resize properly to smaller window sizes
- Rename some of the classes to be more accurate/generic
    - Replace some of them with tailwind equivalents

New Features:
- Referee Invited popup to join up
- Notifications + sound effects for when things happen (all ready, map end etc)
- Add more error handling on the osu api side
- resize scores or starting size or something to make it not scroll down when scores are added
    - (make it scroll in its own thing?)
    - Add Accuracy somewhere too
- Add Map Stats (length, cs, ar, etc) somewhere (maybe only current?)
- Colours for player state
- Coloured player names (per team) + refs different colour
- Add !mp settings
- Group messages from the same user (ie discord style instead of irc style)
- Investigate sending messages along with invites
Bugs
- Getting kicked from a room as a referee doesn't reset the UI (done, needs more testing)
- still some OK: null kicking around (inviting ref)
- weirdness with dragging text around closing UIs? (i cant reproduce)
    - Probably should just fully remove that for now
- Chat is sometimes broken on first run (token doesn't exist yet or something)
    - Maybe with refreshing the token not working??
    - Seems to only happen the first time????
- addref is broken?
- Able to brick on authentication: https://discord.com/channels/1074126777582096394/1550882179226275932/1551999920104542289
# 1.0 Blocking Issues
- Notification sounds
    - All players ready (or spectating)
    - MatchEnded
    - Timer Ended
- Finish dGeist UI Redesign
    - Incl. fix score UI scrolling
- Make resizing not completely kill itself
    - Shrink sidebars on smaller screens
- Edit required_mod settings
- Host a proper scrim/tournament with apl!ref
- !mp commands tested (addref, removeref need testing)
    - Make sure they all align with lazer mp standards
- Figure out how to determine the proper mod settings order
    - Maybe just check every single one from the docs but that's cursed
- Create unit tests
Tabs:
- "Status: Idle" is broken

