const EVENTS = ["Pong", "UserJoined", "UserLeft", "UserKicked", "UserBanned", "RefereeAdded", "RefereeRemoved", "RefereeInvited", "RoomSettingsChanged", "MatchStateChanged", "PlaylistItemAdded", "PlaylistItemChanged", "PlaylistItemRemoved", "RollCompleted", "UserStatusChanged", "UserModsChanged", "UserStyleChanged", "UserTeamChanged", "CountdownStarted", "CountdownStopped", "MatchStarted", "MatchAborted", "MatchCompleted"]
function setupEventHandlers(connection, callbacks, sendToRenderer) {
  for (const ev of EVENTS) {
    connection.on(ev, (info) => {
        console.log(ev, info)
        sendToRenderer(ev, info)
    })
  }

  connection.onclose(() => {
    console.log('Connection closed')
    if (callbacks.onClose) {
      callbacks.onClose()
    }
  })

  connection.onreconnecting(() => {
    console.log('Reconnecting...')
    if (callbacks.onReconnecting) {
      callbacks.onReconnecting()
    }
  })

  connection.onreconnected(() => {
    console.log('Reconnected')
    if (callbacks.onReconnected) {
      callbacks.onReconnected()
    }
  })
}

module.exports = { setupEventHandlers, EVENTS }
