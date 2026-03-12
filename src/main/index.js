const { app, BrowserWindow } = require('electron')
const path = require('path')
const { RefereeClient, SPECTATOR_SERVER_URL } = require('../referee')
const { setupIpcHandlers, setupWSEvents } = require('./ipc')
const { getAccessToken } = require('../auth')

let mainWindow = null
let refereeClient = null

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 900,
    webPreferences: {
      blinkFeatures: 'OverlayScrollbars',
      preload: path.join(__dirname, '..', '..', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  mainWindow.loadFile(path.join(__dirname, '..', 'renderer', 'index.html'))
}

// Opens a small window that navigates directly to the osu! OAuth URL.
// The redirect to localhost:8084 is intercepted via will-redirect in auth.js
// before it hits the network — no HTTP server is needed.
function createLoginWindow(authUrl) {
  const win = new BrowserWindow({
    width: 600,
    height: 700,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  win.loadURL(authUrl)
  return win
}

function createConfigPopup(authUrl) {
  const win = new BrowserWindow({
    width: 600,
    height: 700,
    webPreferences: {
      preload: path.join(__dirname, '..', '..', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  win.loadFile(path.join(__dirname, '..', 'renderer', 'config.html'))
  return win
}

function sendToRenderer(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data)
  }
}

async function initializeApp(accessToken) {
  createMainWindow()

  // Replace the startup no-op handler with the real quit-on-close behaviour
  // now that the main window exists.
  app.removeAllListeners('window-all-closed')
  app.on('window-all-closed', async () => {
    await cleanup()
  })

  refereeClient = new RefereeClient(SPECTATOR_SERVER_URL, {
    onPong: (message) => sendToRenderer('pong-received', message),
    onUserJoined: (info) => sendToRenderer('user-joined', info),
    onUserLeft: (info) => sendToRenderer('user-left', info),
    onUserKicked: (info) => sendToRenderer('user-kicked', info),
    onRoomSettingsChanged: (info) => sendToRenderer('room-settings-changed', info),
    onPlaylistItemAdded: (info) => sendToRenderer('playlist-item-added', info),
    onPlaylistItemChanged: (info) => sendToRenderer('playlist-item-changed', info),
    onPlaylistItemRemoved: (info) => sendToRenderer('playlist-item-removed', info),
    onUserStatusChanged: (info) => sendToRenderer('user-status-changed', info),
    onUserModsChanged: (info) => sendToRenderer('user-mods-changed', info),
    onUserStyleChanged: (info) => sendToRenderer('user-style-changed', info),
    onUserTeamChanged: (info) => sendToRenderer('user-team-changed', info),
    onCountdownStarted: (info) => sendToRenderer('countdown-started', info),
    onCountdownStopped: (info) => sendToRenderer('countdown-stopped', info),
    onMatchStarted: (info) => sendToRenderer('match-started', info),
    onMatchAborted: (info) => sendToRenderer('match-aborted', info),
    onMatchCompleted: (info) => sendToRenderer('match-completed', info)
  }, accessToken)

  try {
    await refereeClient.connect()
  } catch (err) {
    console.error('Failed to connect to referee server:', err)
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createMainWindow()
  })
  setupWSEvents(accessToken, sendToRenderer)
}

async function cleanup() {
  if (refereeClient) {
    await refereeClient.disconnect()
  }
  if (process.platform !== 'darwin') app.quit()
}

function start() {
  setupIpcHandlers(
    () => refereeClient,
    () => mainWindow
  )
  // Prevent Electron from quitting automatically when windows close during
  // the OAuth flow. Once the main window is open, cleanup() takes over.
  app.on('window-all-closed', (event) => {
    event.preventDefault()
  })
  //app.commandLine.appendSwitch('enable-features', 'OverlayScrollbar')
  app.whenReady().then(async () => {
    try {
      const accessToken = await getAccessToken(createLoginWindow, createConfigPopup)
      await initializeApp(accessToken)
    } catch (err) {
      console.error('Failed to authenticate:', err)
      setTimeout(() => app.quit(), 500)
    }
  })
}

module.exports = { start }
