const { contextBridge, ipcRenderer } = require('electron')
const COMMANDS = new Set(["Ping", "MakeRoom", "JoinRoom", "LeaveRoom", "CloseRoom", "InvitePlayer", "KickPlayer", "BanUser", "AddReferee", "RemoveReferee", "ChangeRoomSettings", "EditCurrentPlaylistItem", "AddPlaylistItem", "EditPlaylistItem", "RemovePlaylistItem", "MoveUser", "StartMatch", "StopMatchCountdown", "AbortMatch"]);
const api = {}
for (const cmd of COMMANDS) {
    api[cmd] = (...args) => ipcRenderer.invoke(cmd, ...args);
}
contextBridge.exposeInMainWorld('api', {
  send: api,

  GetConnectionStatus: () => ipcRenderer.invoke('GetConnectionStatus'),
  api: { // calls to the osu api the normal way
      onChatMessage :(callback) => {
      ipcRenderer.on('chat-event', (event, buffer) => callback(buffer))
    },
    GetUser: (user_id) => ipcRenderer.invoke('GetUser', user_id),
    SendMessage: (channel_id, message) => ipcRenderer.invoke('SendMessage', channel_id, message),
    GetBeatmap: (beatmap_id) => ipcRenderer.invoke('GetBeatmap', beatmap_id),
    GetScores: (room_id, playlist_id) => ipcRenderer.invoke('GetScores', room_id, playlist_id),
  },
  config: {
      SendConfig: (client_id, client_secret) => ipcRenderer.invoke('SendConfig', client_id, client_secret),
  },
  onPong: (callback) => {
    ipcRenderer.on('pong-received', (event, message) => callback(message))
  },
  onUserJoined: (callback) => {
    ipcRenderer.on('user-joined', (event, info) => callback(info))
  },
  onUserLeft: (callback) => {
    ipcRenderer.on('user-left', (event, info) => callback(info))
  },
  onUserKicked: (callback) => {
    ipcRenderer.on('user-kicked', (event, info) => callback(info))
  },
  onRoomSettingsChanged: (callback) => {
    ipcRenderer.on('room-settings-changed', (event, info) => callback(info))
  },
  onPlaylistItemAdded: (callback) => {
    ipcRenderer.on('playlist-item-added', (event, info) => callback(info))
  },
  onPlaylistItemChanged: (callback) => {
    ipcRenderer.on('playlist-item-changed', (event, info) => callback(info))
  },
  onPlaylistItemRemoved: (callback) => {
    ipcRenderer.on('playlist-item-removed', (event, info) => callback(info))
  },
  onUserStatusChanged: (callback) => {
    ipcRenderer.on('user-status-changed', (event, info) => callback(info))
  },
  onUserModsChanged: (callback) => {
    ipcRenderer.on('user-mods-changed', (event, info) => callback(info))
  },
  onUserStyleChanged: (callback) => {
    ipcRenderer.on('user-style-changed', (event, info) => callback(info))
  },
  onUserTeamChanged: (callback) => {
    ipcRenderer.on('user-team-changed', (event, info) => callback(info))
  },
  onCountdownStarted: (callback) => {
    ipcRenderer.on('countdown-started', (event, info) => callback(info))
  },
  onCountdownStopped: (callback) => {
    ipcRenderer.on('countdown-stopped', (event, info) => callback(info))
  },
  onMatchStarted: (callback) => {
    ipcRenderer.on('match-started', (event, info) => callback(info))
  },
  onMatchAborted: (callback) => {
    ipcRenderer.on('match-aborted', (event, info) => callback(info))
  },
  onMatchCompleted: (callback) => {
    ipcRenderer.on('match-completed', (event, info) => callback(info))
  }
})
