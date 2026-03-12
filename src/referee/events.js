function setupEventHandlers(connection, callbacks) {
  connection.on('Pong', (message) => {
    console.log('Pong received:', message)
    if (callbacks.onPong) {
      callbacks.onPong(message)
    }
  })

  connection.on('UserJoined', (info) => {
    console.log('User joined:', info)
    if (callbacks.onUserJoined) {
      callbacks.onUserJoined(info)
    }
  })

  connection.on('UserLeft', (info) => {
    console.log('User left:', info)
    if (callbacks.onUserLeft) {
      callbacks.onUserLeft(info)
    }
  })

  connection.on('UserKicked', (info) => {
    console.log('User kicked:', info)
    if (callbacks.onUserKicked) {
      callbacks.onUserKicked(info)
    }
  })

  connection.on('RoomSettingsChanged', (info) => {
    console.log('Room settings changed:', info)
    if (callbacks.onRoomSettingsChanged) {
      callbacks.onRoomSettingsChanged(info)
    }
  })

  connection.on('PlaylistItemAdded', (info) => {
    console.log('Playlist item added:', info)
    if (callbacks.onPlaylistItemAdded) {
      callbacks.onPlaylistItemAdded(info)
    }
  })

  connection.on('PlaylistItemChanged', (info) => {
    console.log('Playlist item changed:', info)
    if (callbacks.onPlaylistItemChanged) {
      callbacks.onPlaylistItemChanged(info)
    }
  })

  connection.on('PlaylistItemRemoved', (info) => {
    console.log('Playlist item removed:', info)
    if (callbacks.onPlaylistItemRemoved) {
      callbacks.onPlaylistItemRemoved(info)
    }
  })

  connection.on('UserStatusChanged', (info) => {
    console.log('User status changed:', info)
    if (callbacks.onUserStatusChanged) {
      callbacks.onUserStatusChanged(info)
    }
  })

  connection.on('UserModsChanged', (info) => {
    console.log('User mods changed:', info)
    if (callbacks.onUserModsChanged) {
      callbacks.onUserModsChanged(info)
    }
  })

  connection.on('UserStyleChanged', (info) => {
    console.log('User style changed:', info)
    if (callbacks.onUserStyleChanged) {
      callbacks.onUserStyleChanged(info)
    }
  })

  connection.on('UserTeamChanged', (info) => {
    console.log('User team changed:', info)
    if (callbacks.onUserTeamChanged) {
      callbacks.onUserTeamChanged(info)
    }
  })

  connection.on('CountdownStarted', (info) => {
    console.log('Countdown started:', info)
    if (callbacks.onCountdownStarted) {
      callbacks.onCountdownStarted(info)
    }
  })

  connection.on('CountdownStopped', (info) => {
    console.log('Countdown stopped:', info)
    if (callbacks.onCountdownStopped) {
      callbacks.onCountdownStopped(info)
    }
  })

  connection.on('MatchStarted', (info) => {
    console.log('Match started:', info)
    if (callbacks.onMatchStarted) {
      callbacks.onMatchStarted(info)
    }
  })

  connection.on('MatchAborted', (info) => {
    console.log('Match aborted:', info)
    if (callbacks.onMatchAborted) {
      callbacks.onMatchAborted(info)
    }
  })

  connection.on('MatchCompleted', (info) => {
    console.log('Match completed:', info)
    if (callbacks.onMatchCompleted) {
      callbacks.onMatchCompleted(info)
    }
  })

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

module.exports = { setupEventHandlers }
