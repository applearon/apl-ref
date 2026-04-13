const signalR = require('@microsoft/signalr')
const { setupEventHandlers } = require('./referee/events')
const { COMMANDS } = require('./referee/commands')

const SPECTATOR_SERVER_URL = 'https://spectator.ppy.sh'

class RefereeClient {
    constructor(url = SPECTATOR_SERVER_URL, accessToken = null, sendToRenderer) {
        this.connection = null
        this.url = url
        this.connected = false
        this.callbacks = {}
        this.accessToken = accessToken
        this.sendToRenderer = sendToRenderer
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
            onClose: () => { this.connected = false },
            onReconnecting: this.callbacks.onReconnecting,
            onReconnected: () => { this.connected = true }
        }, this.sendToRenderer)


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
