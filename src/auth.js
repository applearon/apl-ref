const { app, ipcMain } = require('electron')
const fs = require('fs')
const path = require('path')

const userDataPath = app.getPath('userData');

const CONFIG_PATH = path.join(userDataPath, 'config.json')
const TOKEN_PATH = path.join(userDataPath, 'token.json')

// This URI must match what is registered in the osu! OAuth app settings.
// We never actually listen on this port — Electron intercepts the redirect
// via webContents will-redirect before it hits the network.
const REDIRECT_URI = 'http://localhost:8084'
const OSU_AUTH_BASE = 'https://osu.ppy.sh/oauth/authorize'
const OSU_TOKEN_URL = 'https://osu.ppy.sh/oauth/token'
const OAUTH_SCOPES = 'public identify multiplayer.write_manage chat.read chat.write'

function readConfig() {
    try {
        if (!fs.existsSync(TOKEN_PATH)) return null
        const raw = fs.readFileSync(CONFIG_PATH, 'utf8')
        const config = JSON.parse(raw)
        if (!config.client_id || !config.client_secret) {
            throw new Error('config.json is missing client_id or client_secret')
        }
        return config
    } catch (err) { // if something's gone wrong, ggs
        throw new Error(`Failed to read config.json: ${err.message}`, {cause: err})
    }
}

function readToken() {
    try {
        if (!fs.existsSync(TOKEN_PATH)) return null
        const raw = fs.readFileSync(TOKEN_PATH, 'utf8')
        return JSON.parse(raw)
    } catch (err) {
        console.warn('Could not read token.json, will re-authenticate:', err.message)
        return null
    }
}

function saveToken(tokenData) {
    fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokenData, null, 2), 'utf8')
}

function saveConfig(configData) {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(configData, null, 2), 'utf8')
}


// Check the JWT exp claim to see if the token is still valid.
// Adds a 60-second buffer so we don't use a token that expires mid-session.
function isTokenValid(tokenData) {
    if (!tokenData || !tokenData.access_token) return false
    try {
        const payload = tokenData.access_token.split('.')[1]
        if (!payload) return false
        const decoded = JSON.parse(Buffer.from(payload, 'base64').toString('utf8'))
        if (!decoded.exp) return false
        const nowSeconds = Math.floor(Date.now() / 1000)
        return decoded.exp > nowSeconds + 60
    } catch (err) {
        console.warn('Could not parse token expiry, treating as invalid:', err.message)
        return false
    }
}

// Exchange an authorization code for an access token via osu! OAuth.
async function exchangeCodeForToken(code, clientId, clientSecret) {
    const body = new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: REDIRECT_URI
    })

    const res = await fetch(OSU_TOKEN_URL, {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: body.toString()
    })

    const data = await res.json()
    if (!data.access_token) {
        throw new Error(`Token exchange failed: ${JSON.stringify(data)}`)
    }
    return data
}

// Build the full OAuth authorization URL.
function buildAuthUrl(clientId) {
    const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: REDIRECT_URI,
        response_type: 'code',
        scope: OAUTH_SCOPES,
        state: Math.random().toString(36).slice(2)
    })
    return `${OSU_AUTH_BASE}?${params.toString()}`
}

// Wait for the osu! OAuth redirect to localhost:8084 by intercepting it inside
// the Electron login window via will-redirect. No HTTP server is needed —
// Electron sees the 3xx redirect before it hits the network and we cancel it.
function waitForAuthCode(loginWindow) {
    return new Promise((resolve, reject) => {
        let settled = false

        function settle(fn, value) {
            if (settled) return
            settled = true
            fn(value)
        }

        loginWindow.webContents.on('will-redirect', (event, url) => {
            let parsed
            try { parsed = new URL(url) } catch { return }
            if (parsed.hostname !== 'localhost' || parsed.port !== '8084') return

            event.preventDefault()

            const code = parsed.searchParams.get('code')
            const error = parsed.searchParams.get('error')

            if (error) {
                settle(reject, new Error(`OAuth error: ${error}`))
            } else if (code) {
                settle(resolve, code)
            } else {
                settle(reject, new Error('OAuth redirect contained neither code nor error'))
            }
        })

        loginWindow.on('closed', () => {
            settle(reject, new Error('Login window was closed before authentication completed'))
        })
    })
}

function waitForConfig(configWindow) {
    return new Promise((resolve, reject) => {
        let settled = false;

        function settle(fn, value) {
            if (settled) return
            settled = true
            fn(value)
        }

        ipcMain.handle('SendConfig', (event, client_id, client_secret) => {
            console.log(client_secret)
            settle(resolve, { client_id, client_secret })
        })

        configWindow.on('closed', () => {
            settle(reject, new Error('Login window was closed before authentication completed'))
        })
    })
}

// Full OAuth flow: opens the auth URL in a new BrowserWindow, intercepts the
// redirect to localhost:8084, exchanges the code, saves the token, and returns
// the access_token string.
//
// createLoginWindow(url) must be provided by the caller (main process) since
// this module has no Electron dependency.
async function startOAuthFlow(createLoginWindow, createConfigPopup) {
    let config = readConfig()
    if (config == null) {
        const configWindow = createConfigPopup()
        try {
            config = await waitForConfig(configWindow)
            saveConfig(config)
        } finally {
            if (!configWindow.isDestroyed()) configWindow.close()
        }
    }
    const authUrl = buildAuthUrl(config.client_id)
    const loginWindow = createLoginWindow(authUrl)

    let code
    try {
        code = await waitForAuthCode(loginWindow)
    } finally {
        if (!loginWindow.isDestroyed()) loginWindow.close()
    }

    console.log('Auth code received, exchanging for token...')
    const tokenData = await exchangeCodeForToken(code, config.client_id, config.client_secret)
    console.log('Token exchange response keys:', Object.keys(tokenData))
    saveToken(tokenData)
    return tokenData.access_token
}

// Entry point called by main process on startup.
// Returns the access_token string — either from the saved file (if still valid)
// or by running the full OAuth flow.
async function getAccessToken(createLoginWindow, createConfigPopup) {
    const saved = readToken()
    if (isTokenValid(saved)) {
        console.log('Using saved access token')
        return saved.access_token
    }

    console.log('No valid token found, starting OAuth flow')
    return await startOAuthFlow(createLoginWindow, createConfigPopup)
}

module.exports = { getAccessToken, readConfig, readToken, saveToken, isTokenValid }
