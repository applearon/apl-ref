const signalR = require('@microsoft/signalr')
const { setupEventHandlers } = require('./referee/events')
const { COMMANDS } = require('./referee/commands')

const SPECTATOR_SERVER_URL = 'https://spectator.ppy.sh'

class RefereeClient {
  constructor(url = SPECTATOR_SERVER_URL, callbacks = {}, accessToken = null) {
    this.connection = null
    this.url = url
    this.connected = false
    this.callbacks = callbacks
    this.accessToken = accessToken
  }

  async connect() {
    this.connection = new signalR.HubConnectionBuilder()
      .withUrl(new URL('/referee', this.url).toString(), {
        accessTokenFactory: () => this.accessToken
      })
      .withAutomaticReconnect()
      .configureLogging(signalR.LogLevel.Information)
      .build()

    setupEventHandlers(this.connection, {
      onPong: this.callbacks.onPong,
      onUserJoined: this.callbacks.onUserJoined,
      onUserLeft: this.callbacks.onUserLeft,
      onUserKicked: this.callbacks.onUserKicked,
      onRoomSettingsChanged: this.callbacks.onRoomSettingsChanged,
      onPlaylistItemAdded: this.callbacks.onPlaylistItemAdded,
      onPlaylistItemChanged: this.callbacks.onPlaylistItemChanged,
      onPlaylistItemRemoved: this.callbacks.onPlaylistItemRemoved,
      onUserStatusChanged: this.callbacks.onUserStatusChanged,
      onUserModsChanged: this.callbacks.onUserModsChanged,
      onUserStyleChanged: this.callbacks.onUserStyleChanged,
      onUserTeamChanged: this.callbacks.onUserTeamChanged,
      onCountdownStarted: this.callbacks.onCountdownStarted,
      onCountdownStopped: this.callbacks.onCountdownStopped,
      onMatchStarted: this.callbacks.onMatchStarted,
      onMatchAborted: this.callbacks.onMatchAborted,
      onMatchCompleted: this.callbacks.onMatchCompleted,
      onClose: () => { this.connected = false },
      onReconnecting: this.callbacks.onReconnecting,
      onReconnected: () => { this.connected = true }
    })


    try {
      await this.connection.start()
      this.connected = true
      console.log('Connected to referee server')
    } catch (err) {
      console.error('Failed to connect:', err)
      throw err
    }
  }
  isConnected() {
      if (!this.connected) {
          throw new Error('Not connected to server')
      }
  }

  async disconnect() {
    if (this.connection) {
      await this.connection.stop()
      this.connected = false
    }
  }
}
Object.assign(RefereeClient.prototype, COMMANDS)
module.exports = { RefereeClient, SPECTATOR_SERVER_URL }
