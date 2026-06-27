const { ipcMain } = require('electron')
const { WebSocket } = require('ws')
const { CMDS_SET } = require('../referee/commands')
const { EVENTS } = require('../referee/events')
const { version } = require('../../package.json')
const { getLogger } = require("@logtape/logtape")
const IS_PROD = process.env.DEV_SERVER == null
const  OSU_SERVER = IS_PROD ? "osu.ppy.sh" : "dev.ppy.sh"

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

function setupIpcHandlers(getRefereeClient) {
    ipcMain.handle('get-api-data', async () => {
        return [CMDS_SET, EVENTS, version]
    })
    CMDS_SET.forEach(cmd => {
        ipcMain.handle(cmd, genericHandler(getRefereeClient, cmd));
    })
    ipcMain.handle('Log', createQueryHandler(getRefereeClient, (client, type, text) => {
        const logger = getLogger(["apl-ref", "web"]);
        return logger[type]("{text}", {text})
    }))
    ipcMain.handle('GetUser', createQueryHandler(getRefereeClient, (client, user_id) => {
        const accessToken = client.accessToken;
        const url = new URL(`https://${OSU_SERVER}/api/v2/users/${user_id}/osu`);
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
    ipcMain.handle('GetSelf', createQueryHandler(getRefereeClient, (client) => {
        const accessToken = client.accessToken;
        const url = new URL(`https://${OSU_SERVER}/api/v2/me`);
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
        const url = new URL(`https://${OSU_SERVER}/api/v2/chat/channels/${channel_id}/messages`);
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
    ipcMain.handle('JoinChannel', createQueryHandler(getRefereeClient, (client, channel_id, username) => {
        const accessToken = client.accessToken;
        const url = new URL(`https://${OSU_SERVER}/api/v2/chat/channels/${channel_id}/users/${username}`);
        const headers = {
            "Content-Type": "application/json",
            "Accept": "application/json",
            Authorization: `Bearer ${accessToken}`,
        }
        
        return fetch(url, {
            method: "PUT",
            headers,
        }).then(response => response.json());
    }))
    ipcMain.handle('GetBeatmap', createQueryHandler(getRefereeClient, (client, beatmap_id) => {
        const accessToken = client.accessToken;
        const url = new URL(`https://${OSU_SERVER}/api/v2/beatmaps/${beatmap_id}`);
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
        const url = new URL(`https://${OSU_SERVER}/api/v2/rooms/${room_id}/playlist/${playlist_id}/scores`);
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

    ipcMain.handle('CloseWS', createQueryHandler(getRefereeClient, (client) => {
        return client.ws_close();
    }))

    ipcMain.handle('GetConnectionStatus', createQueryHandler(getRefereeClient, (client) => {
        return { connected: client?.connected || false }
    }))

}

function setupWSEvents(accessToken, sendFunc) {
    const logger  = getLogger (["apl-ref", "WS"]);
    const headers = { Authorization: `Bearer ${accessToken}`};
    const url = IS_PROD ? "wss://notify.ppy.sh" : "wss://dev.ppy.sh/home/notifications/feed"
    let ws;
    let reconnectTimer = null
    let attempts = 0;
    function connect() {
        ws = new WebSocket(url, [], { headers });
        ws.on('open', () => {
            ws.send(JSON.stringify({ event: 'chat.start' }));
            logger.info("Opened!")
            attempts = 0
        })
        ws.on('message', (buffer) => {
            //console.log(buffer.toString())
            sendFunc('chat-event', buffer.toString())
        });
        ws.on('close', (ev) => {
            logger.error("Closed: {ev}", ev)
            const delay = Math.min(1000 * (2 ** attempts), 16_000) // exponential backoff i think, max 16sec
            attempts += 1
            logger.info(`Attempting reconnection in ${delay}ms..`)
            clearTimeout(reconnectTimer);
            reconnectTimer = setTimeout(connect, delay)

        })
        ws.on('error', (ev) => {
            logger.error("Error: {ev}", ev)
            ws.close() // i assume i need this??
        })
    }
    connect()
    return () => {
        ws.close()
    }
}

module.exports = { setupIpcHandlers, createHandler, createQueryHandler, setupWSEvents }
