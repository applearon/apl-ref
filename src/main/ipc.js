const { ipcMain } = require('electron')
const { WebSocket } = require('ws')
const COMMANDS = ["Ping", "MakeRoom", "JoinRoom", "LeaveRoom", "CloseRoom", "InvitePlayer", "KickPlayer", "AddReferee", "RemoveReferee", "ChangeRoomSettings", "EditCurrentPlaylistItem", "AddPlaylistItem", "EditPlaylistItem", "RemovePlaylistItem", "MoveUser", "StartMatch", "StopMatchCountdown", "AbortMatch"]

function createHandler(getRefereeClient, handlerFn) {
  return async (event, ...args) => {
    const refereeClient = getRefereeClient()
    if (!refereeClient) {
      return { success: false, error: 'Client not initialized' }
    }
    try {
      const result = await handlerFn(refereeClient, ...args)
      return { success: true, data: result }
    } catch (err) {
      return { success: false, error: err.message }
    }
  }
}

function genericHandler(getRefereeClient, cmd) {
    return async (event, ...args) => {
        const refereeClient = getRefereeClient();
        if (!refereeClient) {
        return { success: false, error: 'Client not initialized' }
        }
        try {
            const result = await refereeClient[cmd](...args)
            return { success: true, data: result }
        } catch (err) {
          console.log(err, "oh")
          console.log(cmd);
            console.log(...args)
          //console.log(refereeClient)
          return { success: false, error: err.message }
        }

    }
}

function createQueryHandler(getRefereeClient, queryFn) {
  return async (event, ...args) => {
    const refereeClient = getRefereeClient()
    try {
      return { success: true, data: await queryFn(refereeClient, ...args) }
    } catch (err) {
      return { success: false, error: err.message }
    }
  }
}

function setupIpcHandlers(getRefereeClient, getMainWindow) {
    COMMANDS.forEach(cmd => {
        ipcMain.handle(cmd, genericHandler(getRefereeClient, cmd));
    })
  ipcMain.handle('GetUser', createQueryHandler(getRefereeClient, (client, user_id) => {
    const accessToken = client.accessToken;
    const url = new URL(`https://osu.ppy.sh/api/v2/users/${user_id}/osu`);
    //url.searchParams.append("key", "at")
    // ^ technically we want either or so...
    const headers = {
    "Content-Type": "application/json",
    "Accept": "application/json",
    Authorization: `Bearer ${accessToken}`,
    }

    const x = fetch(url, {
        method: "GET",
        headers,
    }).then(response => response.json())
    //console.log(x)
    return x;
  }))
    ipcMain.handle('SendMessage', createQueryHandler(getRefereeClient, (client, channel_id, message) => {
        const accessToken = client.accessToken;
        const url = new URL(`https://osu.ppy.sh/api/v2/chat/channels/${channel_id}/messages`);
        const headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
            Authorization: `Bearer ${accessToken}`,
        }
        
        const body = {
            "message": message,
            "is_action": false
        };
        return fetch(url, {
            method: "POST",
            headers,
            body: JSON.stringify(body),
        }).then(response => response.json());
    }))
    ipcMain.handle('GetBeatmap', createQueryHandler(getRefereeClient, (client, beatmap_id) => {
        const accessToken = client.accessToken;
        const url = new URL(`https://osu.ppy.sh/api/v2/beatmaps/${beatmap_id}`);
        const headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
            Authorization: `Bearer ${accessToken}`,
        }
        
        return fetch(url, {
            method: "GET",
            headers,
        }).then(response => response.json());
    }))
    ipcMain.handle('GetScores', createQueryHandler(getRefereeClient, (client, room_id, playlist_id) => {
        const accessToken = client.accessToken;
        const url = new URL(`https://osu.ppy.sh/api/v2/rooms/${room_id}/playlist/${playlist_id}/scores`);
        const headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
            Authorization: `Bearer ${accessToken}`,
        }
        
        return fetch(url, {
            method: "GET",
            headers,
        }).then(response => response.json());
    }))

    ipcMain.handle('GetConnectionStatus', createQueryHandler(getRefereeClient, (client) => {
    return { connected: client?.connected || false }
  }))

}

function setupWSEvents(accessToken, sendFunc) {
    const headers = { Authorization: `Bearer ${accessToken}`};
    
    const ws = new WebSocket('wss://notify.ppy.sh', [], { headers });
    ws.on('open', (_) => {
        ws.send(JSON.stringify({ event: 'chat.start' }));
    })
    ws.on('message', (buffer) => {
        //console.log(buffer.toString())
        sendFunc('chat-event', buffer.toString())
    });
}

module.exports = { setupIpcHandlers, createHandler, createQueryHandler, setupWSEvents }
