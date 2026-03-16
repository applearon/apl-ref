const { contextBridge, ipcRenderer } = require('electron')
const COMMANDS = new Set(["Ping", "MakeRoom", "JoinRoom", "LeaveRoom", "CloseRoom", "InvitePlayer", "KickPlayer", "BanUser", "AddReferee", "RemoveReferee", "ChangeRoomSettings", "EditCurrentPlaylistItem", "AddPlaylistItem", "EditPlaylistItem", "RemovePlaylistItem", "MoveUser", "StartMatch", "StopMatchCountdown", "AbortMatch"]);

const EVENTS = new Set(["Pong", "UserJoined", "UserLeft", "UserKicked", "UserBanned", "RefereeAdded", "RefereeRemoved", "RefereeInvited", "RoomSettingsChanged", "MatchStateChanged", "PlaylistItemAdded", "PlaylistItemChanged", "PlaylistItemRemoved", "RollCompleted", "UserStatusChanged", "UserModsChanged", "UserStyleChanged", "UserTeamChanged", "CountdownStarted", "CountdownStopped", "MatchStarted", "MatchAborted", "MatchCompleted"])
const api = {}
for (const cmd of COMMANDS) {
    api[cmd] = (...args) => ipcRenderer.invoke(cmd, ...args);
}
const on = {}
for (const ev of EVENTS) {
    on[ev] = (callback) => {
        ipcRenderer.on(ev, (event, info) => callback(info))
    }
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
  on: on,
})
