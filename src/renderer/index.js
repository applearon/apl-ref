// ── Theme Toggle ────────────────────────────────────────────────────────────

import { User, Event, EventQueue, Room } from "./models.js"
import { idFromUsername, osu, logEvent, MODS, addSystemMsg } from "./utils.js"
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

// Stored Data TODO: make this into a proper class
//             ^ blocking step for supporting multiple rooms
let players = {};
let other_players = {}; // removes calling too much, should be partially(?) replaced with referee list
let playlistItems = {};
window.beatmaps = {}; // global cause like
// i cant imagine that will cause problems?
let connected = false;

let Queue;
let room;

let password = ""
let room_name = ""

let countdown_id;
// TODO this is so cursed and i have to like rewrite a significant portion of this
// but it works for now so whatever
const addingUser = new Map();

let me;
window.api.api.GetSelf().then (x => {
    me = x.data
    window.me = x.data
    other_players[x.data.id] = new User(x.data.id, x.data)
})


async function ircStyleUsername(str) { // old mode is #14573534 for user id, and username otherwise
    if (str[0] == '#') {
        return parseInt(str.substring(1))
    }
    return (await room.GetUser(str, true)).id
}

// TODO most of these don't update the UI
async function cmdRunner(room_id, cmd, ...args) {
    const map = { 
        "name": () => {return osu.ChangeRoomSettings(room_id, {name: args.join(' ')})},
        "invite": async () => {return osu.InvitePlayer(room_id, await ircStyleUsername(args[0]))},
        "lock": () => {return osu.SetLockState(room_id, {locked: true})},
        "unlock": () => {return osu.SetLockState(room_id, {locked: false})},
        "set": () => {return osu.ChangeRoomSettings(room_id, {type: args[0] == 0 ? "head_to_head" : "team_versus"})},
        "start": () => {return osu.StartMatch(room_id, {countdown: parseInt(args[0])})},
        "abort": () => {return osu.AbortMatch(room_id)},
        "team": async () => {return osu.MoveUser(room_id, {user_id: await ircStyleUsername(args[0]), team: args[1]})},
        "move": () => {return addSystemMsg("Unimplemented Command")},
        "map": () => {return osu.EditCurrentPlaylistItem(room_id, {beatmap_id: parseInt(args[0]), ruleset_id: parseInt(args[1]) ?? 0 })},
        "mods": () => {return osu.EditCurrentPlaylistItem(room_id, handleModChange(args))},
        "allowed_mods": () => {
            let mods = args[0].split("+")
            // this is TECHNICALLY not up to spec of lazer tournament
            // but god damnit if stable refs cant have their muscle memory what is even the point
            if (mods.length == 1 && args.length >= 2) mods = args
            
            mods = mods.map(x => {return {acronym: x.toUpperCase()}});
            return osu.EditCurrentPlaylistItem(room_id, {allowed_mods: mods});

        }, // CUSTOM COMMAND
        "timer": () => {
            clearInterval(countdown_id);
            countdown_id = startTimer(parseInt(args[0]));
        },
        "aborttimer": () => { // TODO for this and the button, dont make it erroneously osu.StopMatchCountdown
            osu.StopMatchCountdown(room_id)
            if (countdown_id != null) {
                clearInterval(countdown_id)
                addSystemMsg("Countdown aborted")
                countdown_id = null
            }
        },
        "kick": async () => {return osu.KickPlayer(room_id, await ircStyleUsername(args[0]))},
        "ban": async () => {return osu.BanUser(room_id, await ircStyleUsername(args[0]))},
        "password": () => {return osu.ChangeRoomSettings(room_id, {password: args[0]})},
        "addref": async () => {return osu.AddReferee(room_id, await ircStyleUsername(args[0]))}, // technically needs to be tested
        "removeref": async () => {return osu.RemoveReferee(room_id, await ircStyleUsername(args[0]))},
        "listrefs": () => {return addSystemMsg("Unimplemented")}, // need custom logic
        "close": () => {
            osu.CloseRoom(room_id)
            hideRoomActions() // copied around, TODO generalize
            showRoomCreation()
            connected = false
            players = {}
            playlistItems = {}
    
            document.getElementById("chat-messages").innerHTML = '<div id="no-messages" class="text-gray-500 dark:text-gray-400 text-sm italic">No messages yet...</div>'
        },
        "help": () => {
            // TODO: add explainations for subcommands
            return addSystemMsg(Object.keys(map).join(', '))
        },
    }
    if (!map[cmd]) {
        addSystemMsg(`Invalid command: ${cmd}`)
        return false;
    }
    await map[cmd]()
}

function handleModChange(args) {
    const DA_ORDER = [0,2,3,1,4]
    // "FM" and "NM" also
    if (args.length < 1) {
        console.log("bah youre doing it wrong");
        // TODO add system message saying it's wrong
        addSystemMsg("Invalid command")
        return false;
    }
    let mods = args[0].split("+")
    // this is TECHNICALLY not up to spec of lazer tournament
    // but god damnit if stable refs cant have their muscle memory what is even the point
    if (mods.length == 1 && args.length >= 2) mods = args
    const required_mods = []
    let allowed_mods = []
    for (const mod of mods) {
        if (mod.length < 2) {
            addSystemMsg("Invalid command")
            return false
        }
        const mod_acronym = mod.slice(0,2)
        if (mod_acronym.toLowerCase() == "fm") {
            allowed_mods = MODS[0].Mods.filter(x => x.ValidForMultiplayerAsFreeMod && x.Type != "System" && x.UserPlayable).map(x => {return {acronym: x.Acronym}}) // i dont care anymore
            // TODO: make this work with other gamemodes
            continue
        }
        if (mod_acronym.toLowerCase() == "nm") {
            continue
        }
        if (mod.length == 2) {
            required_mods.push({acronym: mod}) // no settings
        } else {
            try {
                const mod_setting_names = MODS[0].Mods.find(x => x.Acronym == mod_acronym).Settings.map(x => x.Name)
                // ModType.System || !mod.UserPlayable
                // ValidForMultiplayerAsFreeMod
                let settings = JSON.parse(mod.slice(2))
                if (settings.length > mod_setting_names.length) {
                    addSystemMsg("Invalid settings: " + mod + ": too many arguments")
                    return false
                }
                let req_settings = {}
                const is_da = mod_acronym.toLowerCase() == "da"
                for (const [i, s] of settings.entries()) { // TODO: i need to order this god dammit
                    // forced order this is some BS im killing myself idk what else to do
                    req_settings[mod_setting_names[is_da ? DA_ORDER[i] : i]] = s
                }
                required_mods.push({acronym: mod_acronym, settings: req_settings})
            } catch {
                addSystemMsg("Invalid settings: " + mod + ": Couldnt parse settings")
                return false
            }
        }
    }
    allowed_mods = allowed_mods.filter(x => !required_mods.map(x=> x.acronym).includes(x.acronym))
    let required_mods_lst = required_mods.map(x=> x.acronym)
    let incompat_lst = [...new Set(MODS[0].Mods.filter(x => required_mods_lst.includes(x.Acronym)).map(x => x.IncompatibleMods).flat(1))]
    allowed_mods = allowed_mods.filter(x => !incompat_lst.includes(x.acronym))
    console.log(required_mods)
    console.log(allowed_mods)
    return {
        required_mods,
        allowed_mods
    }
}
// this is the old version that uses bancho-style !mp mods
//function handleModChange(args) {
//    // this is so stupid
//    const fm = args.map((x) => x.toLowerCase()).includes('freemod')
//    const mods = [ 'hd', 'hr', 'ez', 'fl', 'rx', 'so', 'nf', 'ap' ].map(m => ({acronym: m}))
//    return {
//        required_mods: fm ? null : args.map((x) => {return {acronym: x}}),
//        allowed_mods: fm ? mods : [] // assuming only want normal mods..
//    }
//}

// ── UI helpers ──────────────────────────────────────────────────────────────

function showSettingsDropdown() {
    document.getElementById('settings-name').value = room_name
    document.getElementById('settings-password').value = password
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
        Queue.add(new Event(cmd[0], info))
        logEvent(cmd[0], info)
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

function showRoomCreation() {
    document.getElementById('room-setup').classList.remove('hidden')
}


function showRoomActions(roomId, channelId, name, rm_password) {
    password = rm_password;
    room_name = name;
    document.getElementById('room-actions').classList.remove('hidden')
    document.getElementById('room-badge').classList.add('visible')
    document.getElementById('room-chat-badge').classList.add('visible')
    document.getElementById('navbar-room-controls').classList.add('visible')

    document.getElementById('add-referee').classList.add('visible')
    document.getElementById('room-badge').addEventListener('click', () => {
        try {
            navigator.clipboard.writeText("https://osu.ppy.sh/multiplayer/rooms/" + roomId)
            showToast("Copied to clipboard!")
        } catch {
            showToast("Failed to copy. idk what happened")
        }
    })
    document.getElementById('room-chat-id').textContent = channelId
    document.getElementById('room-name').textContent = name

}

function hideRoomActions() {
    document.getElementById('room-actions').classList.add('hidden')
    document.getElementById('room-badge').classList.remove('visible')
    document.getElementById('room-chat-badge').classList.remove('visible')
    document.getElementById('navbar-room-controls').classList.remove('visible')

    document.getElementById('add-referee').classList.remove('visible')
    document.getElementById('room-chat-id').textContent = ''
    document.getElementById('room-name').textContent = "APL Ref Client"
}

function showToast(message, duration = 3000) {
    const toast = document.getElementById('toast')
    toast.textContent = message
    toast.classList.remove('hidden')
    setTimeout(() => toast.classList.add('hidden'), duration)
}


function debugMode() {
    showRoomActions()
    showRoomCreation()
    const ping = document.getElementById("debug-menu")
    ping.classList.add('visible')
}

function removePlaylistItem(playlist_id) {
    document.querySelector(`[class~="${playlist_id}"]`).remove()
}

function addChatMsg(msg, username, pfp) {
    document.getElementById("no-messages")?.remove()
    const template = document.getElementById("chat-message")
    const clone = template.content.cloneNode(true);
    
    clone.querySelector('.chat-avatar').src = pfp
    clone.querySelector('.chat-username').textContent = username
    clone.querySelector('.chat-message').textContent = msg
    
    const chatbox = document.getElementById("chat-messages")
    chatbox.appendChild(clone)

    if (chatbox.scrollHeight - chatbox.scrollTop - chatbox.clientHeight < 50) {
        chatbox.scrollTop = chatbox.scrollHeight;
    }

}

// Timer
function startTimer(seconds) {
    const informTimes = [30, 15, 10, 5]
    window.api.api.SendMessage(room.chat_channel_id, `Started a countdown for ${seconds} seconds`)
    let elapsed = 0
    countdown_id = setInterval(() => {
        //console.log(elapsed, seconds)
        if (elapsed >= seconds) {
            clearInterval(countdown_id)
            window.api.api.SendMessage(room.chat_channel_id, "The countdown has ended.")
            countdown_id = null
            return;
        }
        if (informTimes.includes(seconds - elapsed) || (seconds - elapsed) % 60 == 0) {
            let msg = "The countdown has "
            msg += (seconds-elapsed) >= 60 ? `${Math.floor((seconds - elapsed) / 60)} minutes ` : ""
            msg += (seconds - elapsed) % 60 != 0 ? `${(seconds - elapsed) % 60} seconds remaining.` : "remaining."
            window.api.api.SendMessage(room.chat_channel_id, msg)
        }
        elapsed += 1;
    }, 1000)
    return countdown_id;
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
    console.log(`Got scores from room ${room_id} and playlist ${playlist_id}`)
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
function str(id) { return document.getElementById(id).value.trim() }

// ── Confirmation modal ────────────────────────────────────────────────────
function confirm(title, body) {
    return new Promise((resolve) => {
        document.getElementById('confirm-title').textContent = title
        document.getElementById('confirm-body').textContent = body
        const modal = document.getElementById('confirm-modal')
        modal.classList.add('visible')

        const okBtn = document.getElementById('confirm-ok')
        const cancelBtn = document.getElementById('confirm-cancel')

        function settle(value) {
            modal.classList.remove('visible')
            resolve(value)
        }

        okBtn.onclick = () => settle(true)
        cancelBtn.onclick = () => settle(false)
    })
}

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
    const connected = status.data ? status.data.connected : false
    statusDot.classList.toggle('connected', connected)
    statusText.textContent = connected ? 'Connected' : 'Disconnected'
}
updateStatus()
setInterval(updateStatus, 5000)

// ── Room Setup ─────────────────────────────────────────────────────────────
document.getElementById('make-room-btn').addEventListener('click', async () => { // TODO centralize logic for here and joining room
    const result = await osu.MakeRoom({
        ruleset_id: int('make-ruleset-id'),
        beatmap_id: int('make-beatmap-id'),
        name: str('make-room-name')
    })
    if (result.success && result.data) {
        room = new Room(result.data)
        Queue = new EventQueue(room)
        showRoomActions(result.data.room_id, result.data.chat_channel_id, result.data.name, result.data.password)
        hideRoomCreation()
        connected = true
        room.updateUI()
    }
})

document.getElementById('join-room-btn').addEventListener('click', async () => {
    const roomId = int('join-room-id')
    const result = await osu.JoinRoom(roomId)
    if (result.success) {
        showRoomActions(roomId, result.data.chat_channel_id, result.data.name, result.data.password)
        hideRoomCreation()
        connected = true
        const playlists = result.data.playlist
        for (const playlist of playlists) {
            //addPlaylistItem(playlist.id, playlist.ruleset_id, playlist.beatmap_id, playlist.required_mods, playlist.allowed_mods, playlist.freestyle, playlist.was_played)
            playlistItems[playlist.id] = playlist
        }
        for (const p of result.data.players) {
            //let user = await GetUser(p.user_id)
            //addPlayer(p.user_id, p.status, user.user.username, p.team ?? "none")
        }

        document.getElementById('cur-match-type').textContent = result.data.state.type
    }
})

// ── Room Settings (navbar dropdown) ───────────────────────────────────────
document.getElementById('change-settings-btn').addEventListener('click', async () => {
    const settings = {}
    const name = str('settings-name')
    const password = str('settings-password')
    settings.type = document.getElementsByName("match_type")[0].checked ? "head_to_head" : "team_versus";
    if (name) settings.name = name
    if (password) settings.password = password
    const result = await osu.ChangeRoomSettings(room.id, settings)
    hideSettingsDropdown()
})

// ── Match Control ──────────────────────────────────────────────────────────
document.getElementById('start-match-btn').addEventListener('click', async () => {
    const result = await osu.StartMatch(room.id, {
        'countdown': int('start-match-seconds')
    })
})

document.getElementById('timer-btn').addEventListener('click', async () => {
    clearInterval(countdown_id);
    countdown_id = startTimer(int('start-match-seconds'));
})

document.getElementById('stop-countdown-btn').addEventListener('click', async () => {
    const result = await osu.StopMatchCountdown(room.id)
    if (countdown_id != null) {
        clearInterval(countdown_id)
        addSystemMsg("Countdown aborted")
        countdown_id = null
    }
})

document.getElementById('abort-match-btn').addEventListener('click', async () => {
    const result = await osu.AbortMatch(room.id)
})

document.getElementById('close-room-btn').addEventListener('click', async () => {
    const ok = await confirm(
        'Close Room',
        'Are you sure you want to permanently close room ' + room.id + '? This cannot be undone.'
    )
    if (!ok) return
    const result = await osu.CloseRoom(room.id)
    if (result.success) {
        hideRoomActions() // copied around, TODO generalize
        showRoomCreation()
        connected = false
        players = {}
        playlistItems = {}

        document.getElementById("chat-messages").innerHTML = '<div id="no-messages" class="text-gray-500 dark:text-gray-400 text-sm italic">No messages yet...</div>'
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
    if (!room?.chat_channel_id) return;
    const data = JSON.parse(buffer)
    if (data.event != "chat.message.new") {
        console.log(data)
        return;
    };
    const messages = data.data.messages
    for (const msg of messages) {
        if (msg.channel_id == room.chat_channel_id) {
            //console.log("ohmygah")
            console.log(msg.sender_id, msg.content)
            let user = (await room.GetUser(msg.sender_id)).user
            addChatMsg(msg.content, user.username, user.avatar_url)
            //if (!commandHandler(user.username, msg.content)) addChatMsg(msg.content, user.username, user.avatar_url)
        }
    }
})

// just for personal use of testing
window.osu = osu
window.players = () => {return players}
window.other_players = () => {return other_players}
window.debugMode = () => debugMode()
window.playlistItems = () => {return playlistItems}
window.ircStyleUsername = (str) => {return ircStyleUsername(str)}
window.MODS = () => {return MODS};
