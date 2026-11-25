// ── Theme Toggle ────────────────────────────────────────────────────────────

import { User, Event, EventQueue, Room } from "./models.js"
import { idFromUsername, osu, logEvent, MODS, confirmUI, log, showSlotsError, isUnlimited, setUnlimited, refreshRoomList } from "./utils.js"
import { handleModChange } from "./modHandler.js";

window.console.error = (...args) => {
    log.error(args.join(', '))
}
const themeToggle = document.getElementById('theme-toggle')

function updateThemeIcon() {
    const isDark = document.documentElement.classList.contains('dark')
    console.log(isDark)
    themeToggle.textContent = isDark ? '☀️' : '🌙'
}

themeToggle.addEventListener('click', () => {
    const html = document.documentElement
    html.classList.toggle('dark')
    localStorage.setItem('theme', html.classList.contains('dark') ? 'dark' : 'light')
    updateThemeIcon()
})

// Load saved theme
const savedTheme = localStorage.getItem('theme')
if (savedTheme === 'light') {
    document.documentElement.classList.remove('dark')
}
updateThemeIcon()

document.title = document.title + ": " + window.version

window.beatmaps = {}; // global cause like
// i cant imagine that will cause problems?

let rooms = {};
let room_ids = [] // TODO: unused? moved to utils.js
let room;
let connected = false;

window.api.api.GetSelf().then (x => {
    window.me = x.data
})

function switchRoom(id) {
    if (rooms[id] == undefined) {
        // room hasn't been joined yet bleh
        osu.JoinRoom(id).then((result) => {
            if (result.success) {
                if (room != undefined) room.active = false
                room = new Room(result.data)
                rooms[result.data.room_id] = room
                room.queue = new EventQueue(room)
                hideRoomCreation()
                room.showRoomActions()
                room.updateUI()
            } else return
        })
    } else {
        if (room != undefined) room.active = false
        room = rooms[id]
        room.active = true
        hideRoomCreation()
        room.showRoomActions()
        room.updateUI()
    }
    let tab = document.getElementById("tabs").querySelector(`[data-room_id="${id}"]`)
    tab.querySelector("#notification").classList.add("hidden")
}

async function ircStyleUsername(str) { // old mode is #14573534 for user id, and username otherwise
    if (str[0] == '#') {
        return parseInt(str.substring(1))
    }
    return (await room.GetUser(str, true)).id
}

// TODO: double check that these all update the UI (or will call a UI update)
async function cmdRunner(room_id, cmd, ...args) {
    const needs_resp = ["invite"]
    const map = { 
        "name": () => {return osu.ChangeRoomSettings(room_id, {name: args.join(' ')})},
        "invite": async () => {return osu.InvitePlayer(room_id, await ircStyleUsername(args[0]))},
        "lock": () => {return osu.SetLockState(room_id, {locked: true})},
        "unlock": () => {return osu.SetLockState(room_id, {locked: false})},
        "size": () => {
            const size = slotLimitArg(parseInt(args[0]))
            if (size === undefined) return {success: true}
            return osu.ChangeRoomSettings(room_id, {max_participants: size})
        },
        "set": () => {
            let size = args[2] ?? args[1] // scoremode doesn't exist yet bleh
            if (size) {
                size = slotLimitArg(parseInt(size))
                if (size === undefined) return {success: true}
            }
            return osu.ChangeRoomSettings(room_id, {type: args[0] == 0 ? "head_to_head" : "team_versus", max_participants: size})
        },
        "start": () => {return osu.StartMatch(room_id, {countdown: parseInt(args[0])})},
        "abort": () => {return osu.AbortMatch(room_id)},
        "team": async () => {return osu.MoveUser(room_id, {user_id: await ircStyleUsername(args[0]), team: args[1]})},
        "move": async () => {return osu.MoveUser(room_id, {user_id: await ircStyleUsername(args[0]), slot: parseInt(args[1])-1})},
        "map": () => {return osu.EditCurrentPlaylistItem(room_id, {beatmap_id: parseInt(args[0]), ruleset_id: parseInt(args[1]) ?? 0 })},
        "mods": () => {
            let mods = handleModChange(args, room.mode);
            console.log(mods.data)
            if (mods.success) return osu.EditCurrentPlaylistItem(room_id, mods.data)
            return mods; // otherwise failed
        },
        "allowed_mods": () => {
            let mods = args[0].split("+")
            // this is TECHNICALLY not up to spec of lazer tournament
            // but god damnit if stable refs cant have their muscle memory what is even the point
            if (mods.length == 1 && args.length >= 2) mods = args
            
            mods = mods.map(x => {return {acronym: x.toUpperCase()}});
            return osu.EditCurrentPlaylistItem(room_id, {allowed_mods: mods});

        }, // CUSTOM COMMAND
        "timer": () => {
            room.startTimer(parseInt(args[0]));
        },
        "aborttimer": () => { // TODO for this and the button, dont make it erroneously osu.StopMatchCountdown
            osu.StopMatchCountdown(room_id)
            room.stopTimer()
        },
        "kick": async () => {return osu.KickPlayer(room_id, await ircStyleUsername(args[0]))},
        "ban": async () => {return osu.BanUser(room_id, await ircStyleUsername(args[0]))},
        "password": () => {return osu.ChangeRoomSettings(room_id, {password: args[0]})},
        "addref": async () => {return osu.AddReferee(room_id, await ircStyleUsername(args[0]))}, // technically needs to be tested
        "removeref": async () => {return osu.RemoveReferee(room_id, await ircStyleUsername(args[0]))},
        "listrefs": () => {return room.addSystemMsg("Unimplemented")}, // need custom logic
        "close": () => {
            osu.CloseRoom(room.id)
            let id = room.id;
            room.close()
            room = null
            // drop the queue too, otherwise it keeps a stale room id around and
            // events for the next room get matched against the old one

            delete rooms[id]
            document.getElementById("chat-messages").innerHTML = '<div id="no-messages" class="text-gray-500 dark:text-gray-400 text-sm italic">No messages yet...</div>'
        },
        "help": () => {
            // TODO: add explainations for subcommands
            return room.addSystemMsg(Object.keys(map).join(', '))
        },
    }
    if (!map[cmd]) {
        room.addSystemMsg(`Invalid command: ${cmd}`)
        return false;
    }
    let suc = await map[cmd]()
    if (suc != undefined) {
        let x = suc.success ? "Succeded" : "Failed"
        let err = suc.error ?? ""
        if (needs_resp.includes(cmd) || !suc.success) {
            room.addSystemMsg(`Command ${cmd} ${x}. ${err}`)
        }
    }
}

// ── UI helpers ──────────────────────────────────────────────────────────────

function showSettingsDropdown() {
    document.getElementById('settings-name').value = room.name
    document.getElementById('settings-password').value = room.password
    document.getElementById('settings-dropdown').classList.add('visible')
}

function hideSettingsDropdown() {
    document.getElementById('settings-dropdown').classList.remove('visible')
}

document.getElementById('settings-trigger').addEventListener('click', (e) => {
    e.stopPropagation()
    const dropdown = document.getElementById('settings-dropdown')
    if (dropdown.classList.contains('visible')) {
        hideSettingsDropdown()
    } else {
        showSettingsDropdown()
    }
})

document.addEventListener('click', (e) => {
    // hide settings
    const dropdown = document.getElementById('settings-dropdown')
    const trigger = document.getElementById('settings-trigger')
    if (!dropdown.contains(e.target) && !trigger.contains(e.target)) {
        hideSettingsDropdown()
    }
    // hide playlist modal
    const addPlaylistModal = document.getElementById('add-playlist-modal')
    let modalContent = addPlaylistModal.querySelector(".modal-content")
    const addPlaylistTrigger = document.getElementById('add-playlist-btn')
    if (!modalContent.contains(e.target) && !addPlaylistTrigger.contains(e.target)) {
        addPlaylistModal.classList.remove('visible')
    }
    // edit playlist modal
    const editPlaylistModal = document.getElementById('edit-playlist-modal')
    modalContent = editPlaylistModal.querySelector(".modal-content")
    //const editPlaylistTrigger = document.getElementById('edit-playlist-btn')
    const editPlaylistTriggers = document.querySelectorAll('.edit-playlist-btn')
    if (Object.values(editPlaylistTriggers) && !modalContent.contains(e.target) && !Object.values(editPlaylistTriggers).some((x) => x.contains(e.target))) {
        editPlaylistModal.classList.remove('visible')
    }

    // hide invite player
    const invitePlayerModal = document.getElementById('invite-player-modal')
    modalContent = invitePlayerModal.querySelector(".modal-content")
    const invitePlayerTrigger = document.getElementById('invite-player-btn')
    if (invitePlayerTrigger && !modalContent.contains(e.target) && !invitePlayerTrigger.contains(e.target)) {
        invitePlayerModal.classList.remove('visible')
    }
    // hide invite ref
    const inviteRefModal = document.getElementById('invite-ref-modal')
    modalContent = inviteRefModal.querySelector(".modal-content")
    const inviteRefTrigger = document.getElementById('add-referee')
    if (inviteRefTrigger && !modalContent.contains(e.target) && !inviteRefTrigger.contains(e.target)) {
        inviteRefModal.classList.remove('visible')
    }
})

// ── Helpers ───────────────────────────────────────────────────────────────

// automatically log all incoming events
let objs = Object.entries(window.api.on)
for (const cmd of objs) {
    cmd[1](info => {
        // ok so dont log it first since logEvent deletes room_id off the event so
        // save it before logging because we need it later
        const room_id = info?.room_id
        
        logEvent(cmd[0], info)
        rooms[room_id].queue.add(new Event(cmd[0], info))
    })
}

function setResult(id, result) {
    const el = document.getElementById(id)
    if (!el) return
    if (result.success) {
        el.className = 'result-msg ok'
        el.textContent = 'OK' + (result.data !== undefined ? ': ' + JSON.stringify(result.data) : '')
    } else {
        el.className = 'result-msg err'
        el.textContent = 'Error: ' + result.error
    }
}

function hideRoomCreation() {
    document.getElementById('room-setup').classList.add('hidden')
}

function debugMode() { // this is kinda useless now but wtvs
    document.getElementById('room-setup').classList.remove('hidden')
    document.getElementById('refresh-room-list').classlist.remove('hidden')
    const ping = document.getElementById("debug-menu")
    ping.classList.add('visible')
    document.getElementById('navbar-room-controls').classList.add('visible')
    document.getElementById('settings-dropdown').classList.add('visible')
}

// Scores
function addSoloScore(username, score) {
    const template = document.getElementById("player-score")
    const clone = template.content.cloneNode(true);
    
    clone.querySelector('.score-player-name').textContent = username
    clone.querySelector('.score-player-score').textContent = score
    
    document.querySelector(".score-players-solo").appendChild(clone)
}

function addTeamSoloScore(username, score, team) {
    const x = team == "red" ? 0 : 1
    const team_div = document.querySelectorAll(".score")[x].querySelector('.score-players')
    const template = document.getElementById("player-score")
    const clone = template.content.cloneNode(true);
    
    clone.querySelector('.score-player-name').textContent = username
    clone.querySelector('.score-player-score').textContent = score
    team_div.appendChild(clone)
}

function scoreMode(head_to_head) {
    const teams = document.querySelectorAll(".score")
    if (head_to_head) {
        for (const team of teams) {
            team.classList.remove("visible")
        }
    } else {
        for (const team of teams) {
            team.classList.add("visible")
        }
    }
}

function removeAllScores() {
    document.querySelector(".score-players-solo").innerHTML = ""
    const team_div = document.querySelectorAll(".score");
    for (const team of team_div) {
        team.querySelector('.score-players').innerHTML = ""
    }
}

async function addScore(room_id, playlist_id) {
    // this entire thing is kinda cooked
    // TODO: decouple this and store the previous scores too
    removeAllScores()
    const head_to_head = document.getElementById('cur-match-type').textContent == "head_to_head"
    scoreMode(head_to_head);
    //const addFunc = head_to_head ? addSoloScore : addTeamSoloScore
    let scores = (await window.api.api.GetScores(room_id, playlist_id)).data
    log.info(`Got scores from room ${room_id} and playlist ${playlist_id}`)
    console.log(scores)
    if (scores.error != null) {
        logEvent('GetScores', scores)
        return; // TODO idk if it failed then ggs
    }
    let red_score = 0
    let blue_score = 0
    for (const score of scores.scores) {
        if (head_to_head) {
            addSoloScore(score.user.username, score.total_score)
        } else {
            const team = document.querySelector(`[data-user_id="${score.user_id}"]`).querySelector(".player-team").classList.contains('team-red') ? 'red' : 'blue'
            if (team == 'red') red_score += score.total_score
            if (team == 'blue') blue_score += score.total_score
            addTeamSoloScore(score.user.username, score.total_score, team)
        }
    }
    if (!head_to_head) {
        const teams = document.querySelectorAll(".score")
        teams[0].querySelector('.score-team-total').textContent = red_score.toLocaleString()
        teams[1].querySelector('.score-team-total').textContent = blue_score.toLocaleString()
    }
    
}

function int(id) { return parseInt(document.getElementById(id).value, 10) }
// womp womp f*ck you servermultiplayerroom for your [2, 16]
const MIN_SLOTS = 2
const MAX_SLOTS = 16
function slotsError(n) {
    if (Number.isNaN(n)) return "Enter a slot count between 2 and 16."
    if (n < MIN_SLOTS || n > MAX_SLOTS) return `Slot count must be between ${MIN_SLOTS} and ${MAX_SLOTS}.`
    return null
}
function slotLimitArg(n) {
    if (n === 0) return 0
    const err = slotsError(n)
    if (err) {
        room.addSystemMsg(err)
        return undefined
    }
    return n
}
function str(id) { return document.getElementById(id).value.trim() }

// Go back to Home Menu
document.getElementById('home-button').addEventListener('click', async () => {
    if (room != undefined) {
        room.active = false;
        room.close();
        room = undefined;
    }
})


// Refresh Room List
document.getElementById('refresh-room-list').addEventListener('click', refreshRoomList)

// tab list
function addTab(room_id) {
    const template = document.getElementById("tab-template")
    const clone = template.content.cloneNode(true);
    clone.firstElementChild.dataset.room_id = room_id
    clone.querySelector(".tab-label").textContent = room_id
    clone.querySelectorAll('*')[0].addEventListener('click', () => {
        switchRoom(room_id)
    })
    document.getElementById("tabs").appendChild(clone)
}

function bindUnlimitedToggle(button_id, input_id, error_id) {
    const btn = document.getElementById(button_id)
    btn.addEventListener('click', () => {
        setUnlimited(button_id, input_id, error_id, !isUnlimited(button_id))
    })
    setUnlimited(button_id, input_id, error_id, isUnlimited(button_id))
}
bindUnlimitedToggle('make-room-unlimited', 'make-room-max-participants', 'make-room-slots-error')
bindUnlimitedToggle('settings-unlimited', 'settings-maximum-participants', 'settings-slots-error')

// ── Add Playlist Modal ───────────────────────────────────────────────────
const addPlaylistModal = document.getElementById('add-playlist-modal')
document.getElementById('add-playlist-btn').addEventListener('click', () => {
    addPlaylistModal.classList.add('visible')
})
document.getElementById('add-playlist-cancel').addEventListener('click', () => {
    addPlaylistModal.classList.remove('visible')
})
document.getElementById('add-playlist-confirm').addEventListener('click', async () => {
    const beatmap_id = parseInt(document.getElementById('popup-beatmap-id').value, 10) || 0
    const ruleset_id = parseInt(document.getElementById('popup-ruleset-id').value, 10) || 0
    const required_mod_lst = (document.getElementById('popup-required-mods').value || '').split(' ').filter(m => m)
    const allowed_mod_lst = (document.getElementById('popup-allowed-mods').value || '').split(' ').filter(m => m)
    const freestyle = document.getElementById('popup-freestyle').checked
    const required_mods = []
    for (const mod of required_mod_lst) {
        required_mods.push({acronym: mod})
    }
    const allowed_mods = []
    for (const mod of allowed_mod_lst) {
        allowed_mods.push({acronym: mod})
    }

    const result = await osu.AddPlaylistItem(room.id, {
        beatmap_id,
        ruleset_id,
        required_mods,
        allowed_mods,
        freestyle
    })
  
    addPlaylistModal.classList.remove('visible')
    document.getElementById('popup-beatmap-id').value = ''
    document.getElementById('popup-ruleset-id').value = ''
    document.getElementById('popup-required-mods').value = ''
    document.getElementById('popup-allowed-mods').value = ''
    document.getElementById('popup-freestyle').checked = false
})

// edit playlist
const editPlaylistModal = document.getElementById('edit-playlist-modal');
document.getElementById('edit-playlist-cancel').addEventListener('click', () => {
    editPlaylistModal.classList.remove('visible')
})

document.getElementById('edit-playlist-remove').addEventListener('click', async () => {
    await osu.RemovePlaylistItem(room.id, {
        playlist_item_id: room.editing_playlist_item
    })
    editPlaylistModal.classList.remove('visible')
})


document.getElementById('edit-playlist-confirm').addEventListener('click', async () => {
    const beatmap_id = parseInt(document.getElementById('popup-edit-beatmap-id').value, 10) || 0
    const ruleset_id = parseInt(document.getElementById('popup-edit-ruleset-id').value, 10) || 0
    const required_mod_lst = (document.getElementById('popup-edit-required-mods').value || '').split(' ').filter(m => m)
    const allowed_mod_lst = (document.getElementById('popup-edit-allowed-mods').value || '').split(' ').filter(m => m)
    const freestyle = document.getElementById('popup-edit-freestyle').checked
    const required_mods = []
    for (const mod of required_mod_lst) {
        required_mods.push({acronym: mod})
    }
    const allowed_mods = []
    for (const mod of allowed_mod_lst) {
        allowed_mods.push({acronym: mod})
    }

    const result = await osu.EditPlaylistItem(room.id, {
        playlist_item_id: room.editing_playlist_item,
        beatmap_id,
        ruleset_id,
        required_mods,
        allowed_mods,
        freestyle
    })
  
    editPlaylistModal.classList.remove('visible')
    document.getElementById('popup-beatmap-id').value = ''
    document.getElementById('popup-ruleset-id').value = ''
    document.getElementById('popup-required-mods').value = ''
    document.getElementById('popup-allowed-mods').value = ''
    document.getElementById('popup-freestyle').checked = false
  
})


const invitePlayerModal = document.getElementById('invite-player-modal')

document.getElementById('invite-player-btn').addEventListener('click', () => {
    invitePlayerModal.classList.add('visible')
})
document.getElementById('invite-player-cancel').addEventListener('click', () => {
    invitePlayerModal.classList.remove('visible')
})

document.getElementById('invite-player-confirm').addEventListener('click', async () => {
    const username = str('popup-invite-username')
    let user_id = int('popup-invite-userid')
    if (username) {
        const user = (await window.api.api.GetUser(username)).data;
        console.log("wow,", user)
        user_id = user.id
    }
    const result = await osu.InvitePlayer(room.id, user_id)
    if (result.data == null) {
        result.data = user_id
    }
    setResult('invite-player-result', result)
    document.getElementById('popup-invite-username').value = ""
    document.getElementById('popup-invite-userid').value = ""

    // we probably want to invite a lot at once
    // invitePlayerModal.classList.remove('visible')

    
})
const toggleLockBtn = document.getElementById('toggle-lock-btn')
toggleLockBtn.addEventListener('click', async () => {
    const unlocked = toggleLockBtn.textContent == "Unlocked"
    const result = await osu.SetLockState(room.id, {"locked": unlocked});
    console.log(unlocked)
    ///if (result.success) {
    ///    toggleLockBtn.textContent = (!unlocked) ? "Unlocked" : "Locked";
    ///}
})

document.getElementById('popup-invite-username').addEventListener('keydown', (event) => { // clicks when press enter
    if (event.key === 'Enter') {
        document.getElementById('invite-player-confirm').click()
    }
})
document.getElementById('popup-invite-userid').addEventListener('keydown', (event) => { // clicks when press enter
    if (event.key === 'Enter') {
        document.getElementById('invite-player-confirm').click()
    }
})


const inviteRefModal = document.getElementById('invite-ref-modal')

document.getElementById('add-referee').addEventListener('click', () => {
    inviteRefModal.classList.add('visible')
})
document.getElementById('invite-ref-cancel').addEventListener('click', () => {
    inviteRefModal.classList.remove('visible')
})

document.getElementById('invite-ref-confirm').addEventListener('click', async () => {
    const username = str('ref-invite-username')
    let user_id = int('ref-invite-userid')
    if (username) {
        const user = (await window.api.api.GetUser(username)).data;
        user_id = user.id
    }
    const result = await osu.AddReferee(room.id, user_id)
    //console.log(result)
    setResult('invite-ref-result', result)

    inviteRefModal.classList.remove('visible')
})


// ── Connection status ──────────────────────────────────────────────────────
const statusDot = document.getElementById('status-dot')
const statusText = document.getElementById('status-text')

async function updateStatus() {
    const status = await window.api.GetConnectionStatus()
    let is_connected = status.data ? status.data.connected : false
    if (is_connected && !connected) {
        console.log(is_connected,connected, status)
        refreshRoomList()
    }
    connected = is_connected;
    statusDot.classList.toggle('connected', connected)
    statusText.textContent = connected ? 'Connected' : 'Disconnected'
}
updateStatus()
setInterval(updateStatus, 5000)

// ── Room Setup ─────────────────────────────────────────────────────────────
document.getElementById('make-room-btn').addEventListener('click', async () => {
    let max_participants = 0
    if (!isUnlimited('make-room-unlimited')) {
        max_participants = int('make-room-max-participants')
        const err = slotsError(max_participants)
        showSlotsError('make-room-slots-error', err)
        if (err) return
    }
    const result = await osu.MakeRoom({
        ruleset_id: int('make-ruleset-id'),
        beatmap_id: int('make-beatmap-id'),
        name: str('make-room-name'),
        max_participants: max_participants
    })
    if (result.success && result.data) {
        room = new Room(result.data)
        rooms[result.data.room_id] = room
        room.queue = new EventQueue(room)
        hideRoomCreation()
        room.updateUI()
        refreshRoomList()
    }
})

document.getElementById('join-room-btn').addEventListener('click', async () => {
    const roomId = int('join-room-id')
    const result = await osu.JoinRoom(roomId)
    if (result.success) {
        room = new Room(result.data)
        rooms[result.data.room_id] = room
        room.queue = new EventQueue(room)
        hideRoomCreation()
        room.updateUI()
    }
})

// ── Room Settings (navbar dropdown) ───────────────────────────────────────
document.getElementById('change-settings-btn').addEventListener('click', async () => {
    const settings = {}
    const name = str('settings-name')
    const password = str('settings-password')
    settings.type = document.getElementsByName("match_type")[0].checked ? "head_to_head" : "team_versus";
    settings.queue_mode = Array.from(document.getElementsByName("queue_mode")).findIndex(cb => cb.checked)
    // unlimited sends 0, a filled box sends that size, an empty box sends
    // nothing at all so the room keeps the limit it already has
    if (isUnlimited('settings-unlimited')) {
        showSlotsError('settings-slots-error', null)
        settings.max_participants = 0
    } else {
        const max_participants = int('settings-maximum-participants')
        if (!Number.isNaN(max_participants)) {
            const err = slotsError(max_participants)
            showSlotsError('settings-slots-error', err)
            if (err) return
            settings.max_participants = max_participants
        } else {
            showSlotsError('settings-slots-error', null)
        }
    }
    if (name) settings.name = name
    if (password) settings.password = password
    const result = await osu.ChangeRoomSettings(room.id, settings)
    if (!result.success) room.addSystemMsg(`Settings change failed. ${result.error ?? ""}`)
    hideSettingsDropdown()
})

// ── Match Control ──────────────────────────────────────────────────────────

const timer_times = [120, 90, 60]
const start_times = [10, 5, 0]
for (let t of timer_times) {
    document.getElementById(`timer-${t}`).addEventListener('click', async () => {
        room.startTimer(t);
    })
}

for (let t of start_times) {
    document.getElementById(`start-${t}`).addEventListener('click', async () => {
        await osu.StartMatch(room.id, {
            'countdown': t
        })
    })
}

document.getElementById('stop-countdown-btn').addEventListener('click', async () => {
    room.stopTimer();
})

document.getElementById('abort-match-btn').addEventListener('click', async () => {
    console.log(room.status)
    if (room.status == "Playing") {
        await osu.AbortMatch(room.id)
    } else {
        await osu.StopMatchCountdown(room.id)
    }
})

document.getElementById('close-room-btn').addEventListener('click', async () => {
    const ok = await confirmUI(
        'Close Room',
        'Are you sure you want to permanently close room ' + room.id + '? This cannot be undone.'
    )
    if (!ok) return
    const result = await osu.CloseRoom(room.id)
    if (result.success) {
        room.close()
        // same as on line 107
        room = null
    } else {
        console.log("How the hell")
    }
})

// Messaging

document.getElementById('chat-send-btn').addEventListener('click', async () => {
    // str('chat-input')
    if(commandHandler(str('chat-input').trim())) {
        document.getElementById('chat-input').value = ''
        return;
    }
    if (room.chat_channel_id != "" && str('chat-input').trim()) {
        window.api.api.SendMessage(room.chat_channel_id, str('chat-input'))
        document.getElementById('chat-input').value = ''
    } else {
        console.log("not sending msg")
    }
})

document.getElementById('chat-input').addEventListener('keydown', (event) => { // clicks when press enter
    if (event.key === 'Enter') {
        document.getElementById('chat-send-btn').click()
    }
})

// ── Debug ──────────────────────────────────────────────────────────────────
document.getElementById('ping-btn').addEventListener('click', async () => {
    const result = await osu.Ping('PING TEST WORKING YAY')
    setResult('ping-result', result)
})

// chat parsing
function commandHandler(message) {
    const commands = {
        "/roll": (max) => {
            osu.Roll(room.id, {max: parseInt(max)})
            console.log(room.id)
        },
        "/savelog": () => {
            window.api.api.SaveDialog(
                "Save Chat Logs",
                `apl_ref mp_${room.id}.txt`,
                room.msg_history.map(
                    x => `[${x.timestamp}] ${x.type == "chat" ? x.data[1] : "System"}: ${x.type == "chat" ? x.data[0] : x.data}`
                ).join('\n')
            )
        },
        "!mp": (args) => {
            cmdRunner(room.id, args.shift(), ...args)
        }
    }
    commands["!roll"] = commands["/roll"] // same as bancho
    let cmd = message.trim().split(' ')
    if (commands[cmd[0]] != undefined) {
        commands[cmd.shift()](cmd);
        return true;
    }
    return false;
}

// ── Event listeners ────────────────────────────────────────────────────────
window.api.on.MatchCompleted(info => {
    addScore(room.id, info.playlist_item_id)
})

window.api.api.onChatMessage(async buffer => {
    // need this for debugging because i suspect the problems are caused *before* making a room
    log.info("Chat Event:" + buffer)
    if (!room?.chat_channel_id) return;
    const data = JSON.parse(buffer)
    if (data.event != "chat.message.new") {
        log.info("Not message:" + JSON.stringify(data))
        return;
    };
    const messages = data.data.messages
    for (const msg of messages) {
        let r = Object.values(rooms).find(x => x.chat_channel_id == msg.channel_id)
        if (r != undefined) {
            //console.log("ohmygah")
            console.log(msg.sender_id, msg.content)
            let user = (await room.GetUser(msg.sender_id)).user
            //room.addChatMsg(msg.content, user.username, user.avatar_url)
            r.msg_history.push({type: "chat", data: [msg.content, user.username, user.avatar_url, msg.timestamp], timestamp: msg.timestamp})
            room.updateUI() // TODO: remove this line
            //if (!commandHandler(user.username, msg.content)) addChatMsg(msg.content, user.username, user.avatar_url)
        }
    }
})

window.api.onConnectionUpdate(is_connected => {
    updateStatus()
})

// just for personal use of testing
window.osu = osu
window.debugMode = () => debugMode()
window.ircStyleUsername = (str) => {return ircStyleUsername(str)}
window.MODS = () => {return MODS};
window.room = () => {return room}
window.rooms = () => {return rooms}
window.switchRoom = (id) => {switchRoom(id)}
window.addTab = (id) => {addTab(id)}
window.log = log
window.sendNotification = (room, type) => {room.sendNotification(room, type)}
