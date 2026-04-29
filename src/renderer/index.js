// ── Theme Toggle ────────────────────────────────────────────────────────────
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
let MODS;
fetch('mods.json').then(mod_res => {
    mod_res.json().then(mods => MODS = mods)
})

// Stored Data TODO: make this into a proper class
let me;
window.api.api.GetSelf().then (x => me = x.data)
let players = {};
let other_players = {}; // removes calling too much, should be partially(?) replaced with referee list
let playlistItems = {};
let beatmaps = {};
let chat_channel_id = ""
let connected = false;

let editing_playlist_item = 0;
let password = ""
let room_name = ""

let countdown_id;

async function ircStyleUsername(str) { // old mode is #14573534 for user id, and username otherwise
    if (str[0] == '#') {
        return parseInt(str.substring(1))
    }
    return (await GetUser(str)).id
}

// TODO most of these don't update the UI
async function cmdRunner(cmd, ...args) {
    const map = { 
        "name": () => {return osu.ChangeRoomSettings(currentRoomId, {name: args.join(' ')})},
        "invite": async () => {return osu.InvitePlayer(currentRoomId, await ircStyleUsername(args[0]))},
        "lock": () => {return osu.SetLockState(currentRoomId, {locked: true})},
        "unlock": () => {return osu.SetLockState(currentRoomId, {"locked": false})},
        "set": () => {return osu.ChangeRoomSettings(currentRoomId, {type: args[0] == 0 ? "head_to_head" : "team_versus"})},
        "start": () => {return osu.StartMatch(currentRoomId, {countdown: parseInt(args[0])})},
        "abort": () => {return osu.AbortMatch(currentRoomId)},
        "team": async () => {return osu.MoveCustom(currentRoomId, {user_id: await ircStyleUsername(args[0]), team: args[0]})},
        "map": () => {return osu.EditCurrentPlaylistItem(currentRoomId, {beatmap_id: parseInt(args[0]), ruleset_id: parseInt(args[1]) ?? 0 })},
        "mods": () => {return osu.EditCurrentPlaylistItem(currentRoomId, handleModChange(args))},
        "timer": () => {
            clearInterval(countdown_id);
            countdown_id = startTimer(parseInt(args[0]));
        },
        "aborttimer": () => { // TODO for this and the button, dont make it erroneously osu.StopMatchCountdown
            osu.StopMatchCountdown(currentRoomId)
            if (countdown_id != null) {
                clearInterval(countdown_id)
                addSystemMsg("Countdown aborted")
                countdown_id = null
            }
        },
        "kick": async () => {return osu.KickPlayer(currentRoomId, await ircStyleUsername(args[0]))},
        "ban": async () => {return osu.BanUser(currentRoomId, await ircStyleUsername(args[0]))},
        "password": () => {return osu.ChangeRoomSettings(currentRoomId, {password: args[0]})},
        "addref": async () => {return osu.AddReferee(currentRoomId, await ircStyleUsername(args[0]))},
        "removeref": async () => {return osu.RemoveReferee(currentRoomId, await ircStyleUsername(args[0]))},
        "listrefs": () => {return addSystemMsg("Unimplemented")}, // need custom logic
        "close": () => {return osu.CloseRoom(currentRoomId)}, // needs to update UI
        "help": () => {
            return addSystemMsg(Object.keys(map).join(', '))
        }, // expected 0 args and also needs custom logic
    }
    if (!map[cmd]) {
        addSystemMsg(`Invalid command: ${cmd}`)
        return false;
    }
    await map[cmd]()
    //for (const x of Object.entries(await map[cmd])) {
    //    osu[x[0]](currentRoomId, x[1])
    //}
}

function handleModChange(args) {
    // this is so stupid
    const fm = args.map((x) => x.toLowerCase()).includes('freemod')
    const mods = [ 'hd', 'hr', 'ez', 'fl', 'rx', 'so', 'nf', 'ap' ].map(m => ({acronym: m}))
    return {
        required_mods: fm ? null : args.map((x) => {return {acronym: x}}),
        allowed_mods: fm ? mods : [] // assuming only want normal mods..
    }
}

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

// ── State ─────────────────────────────────────────────────────────────────
let currentRoomId = null


// ── Helpers ───────────────────────────────────────────────────────────────
let objs = Object.entries(window.api.send)
let osu = {}
for (const cmd of objs) {
    osu[cmd[0]] = (...args) => {
        const res = cmd[1](...args)
        logEvent(cmd[0], res)
        return res
    }
}

// automatically log all incoming events
objs = Object.entries(window.api.on)
for (const cmd of objs) {
    cmd[1](info => {
        logEvent(cmd[0], info)
    })
}

async function GetUser(user_id, normal) { // normal is true if it's a player, false if it's a random
    normal = normal ?? false
    user_id = idFromUsername(user_id) ?? user_id
    let user = players[user_id] ?? other_players[user_id]
    if (user != undefined) {
        return user
    } else {
        console.log("grabbing new player!!")
        user = (await window.api.api.GetUser(user_id)).data
        if (normal) players[user.id] = user
        if (!normal) other_players[user.id] = user
        return user
    }
}

async function GetBeatmap(beatmap_id) {
    if (beatmaps[beatmap_id]) return beatmaps[beatmap_id]
    let map = await window.api.api.GetBeatmap(beatmap_id)
    console.log("grabbing beatmap data")
    beatmaps[beatmap_id] = map.data
    return map.data
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

async function logEvent(name, data) {
    let isRes = false;
    const keep_room_id = ["RefereeInvited"]
    if (data instanceof Promise) { // if it's a method we sent
        data = await data
        isRes = true;
    }
    console.log(name, data)
    const log = document.getElementById('event-log')
    const placeholder = log.querySelector('.event-placeholder')
    if (placeholder) placeholder.remove()
    const entry = document.createElement('div')
    entry.className = 'event-entry'
    const time = document.createElement('div');
    time.textContent = name + ': [' + new Date().toLocaleTimeString() + ']'
    if (isRes) {
        time.textContent += data.success ? " Succeeded" : " Failed"
        data = data.success ? data.data : data.error
    } else {
        if (!keep_room_id.includes(name)) delete data.room_id // dont need since this client only works 1 room at a time
    }
    const logData = document.createElement('div');
    if (data == null) {data = ''}
    if (typeof data == 'string') {
        logData.textContent = data
    } else {
        for(const [key, value] of Object.entries(data)) {
            const x = document.createElement('div');
            x.textContent = key + ": " + (typeof value == 'string' ? value : JSON.stringify(value, null, ' '))
            logData.append(x)
        }
    }
    entry.append(time)
    entry.append(logData)
    log.prepend(entry)
}


function idFromUsername(username) {
    let user = Object.keys(players).find(key => players[key].username == username)
    if (user == undefined) user = Object.keys(other_players).find(key => other_players[key].username == username)
    if (user != undefined) {
        return user;
    } else {
        return null;
    }
}

function hideRoomCreation() {
    document.getElementById('room-setup').classList.add('hidden')
}

function showRoomCreation() {
    document.getElementById('room-setup').classList.remove('hidden')
}


function showRoomActions(roomId, channelId, name, rm_password) {
    currentRoomId = roomId
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
    currentRoomId = null
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
function addPlayer(user_id, player_status, name, team) {
    // "idle", "ready", "playing", "finished_play", "spectating"
    const team_class = "team-" + team.toLowerCase() // only red and blue or none
    const template = document.getElementById("player-item")
    const clone = template.content.cloneNode(true);
    clone.querySelector(".player-status").textContent = player_status
    clone.querySelector(".player-name").textContent = name
    const teamSpan = clone.querySelector(".player-team")
    teamSpan.classList.add(team_class)
    clone.getElementById("player-mods").textContent = "N/A"
    teamSpan.addEventListener("click", async () => {
        // TODO change to if it's head-to-head
        //if(teamSpan.classList.contains("team-none")) return;
        //^ i think it'll just fail?? maybe check specifically if the mode is head-to-head
        //cant do this cause something something they start out as grey
        const result = await osu.MoveUser(currentRoomId, {
            user_id,
            team: teamSpan.classList.contains("team-red") ? "blue" : "red"
        })
        console.log(result)
    })
    teamSpan.style.cursor = 'pointer';

    clone.querySelector(".player-item").dataset.user_id =user_id
    

    const kickBtn = clone.querySelector(".kick-btn")
    kickBtn.addEventListener("click", async () => {
        const confirmed = await confirm("Kick Player", "Are you sure you want to kick " + name + "?")
        if (confirmed) {
            await osu.KickPlayer(currentRoomId, user_id)
        }
    })
    
    document.getElementById("player-list").appendChild(clone)
}

async function addPlaylistItem(playlist_id, ruleset_id, beatmap_id, required_mods, allowed_mods, freestyle, was_played) {
    const modes = ["osu!", "taiko", "catch", "mania"]
    const template = document.getElementById("playlist-item")
    const textTemplate = document.getElementById("playlist-text")
    const beatmap_text = textTemplate.content.cloneNode(true);
    const clone = template.content.cloneNode(true);
    beatmap_text.querySelector(".label").textContent = "Beatmap ID"
    beatmap_text.querySelector(".value").textContent = beatmap_id
    clone.querySelector(".playlist-item").appendChild(beatmap_text);

    const req_mods_text = textTemplate.content.cloneNode(true);
    req_mods_text.querySelector(".label").textContent = "Required Mods"
    let req_mod_readable = required_mods.map(item => item.acronym).join(" ");
    req_mods_text.querySelector(".value").textContent = req_mod_readable
    clone.querySelector(".playlist-item").appendChild(req_mods_text);

    const alw_mods_text = textTemplate.content.cloneNode(true);
    alw_mods_text.querySelector(".label").textContent = "Allowed Mods"
    let alw_mod_readable = allowed_mods.map(item => item.acronym).join(" ");
    alw_mods_text.querySelector(".value").textContent = alw_mod_readable
    clone.querySelector(".playlist-item").appendChild(alw_mods_text);

    const freestyle_text = textTemplate.content.cloneNode(true);
    freestyle_text.querySelector(".label").textContent = "Freestyle"
    freestyle_text.querySelector(".value").textContent = freestyle.toString()
    clone.querySelector(".playlist-item").appendChild(freestyle_text);

    const played_text = textTemplate.content.cloneNode(true);
    played_text.querySelector(".label").textContent = "Played"
    played_text.querySelector(".value").textContent = was_played.toString()
    clone.querySelector(".playlist-item").appendChild(played_text);


    clone.querySelector(".playlist-item-ruleset").textContent = modes[ruleset_id]

    clone.querySelector(".playlist-item").classList.add(playlist_id)


    const edit_btn = clone.querySelector(".edit-playlist-btn")
    edit_btn.addEventListener('click', () => {
        console.log("hi chat")
        const modes = ["osu!", "taiko", "catch", "mania"]
      
        const textElements = edit_btn.parentNode.parentNode.parentNode.querySelectorAll(".playlist-item-text")
        let beatmapId = ""
        let requiredMods = ""
        let allowedMods = ""
        let freestyle = false
        for (const el of textElements) {
            const label = el.querySelector(".label").textContent
            const value = el.querySelector(".value").textContent
            if (label === "Beatmap ID") beatmapId = value
            else if (label === "Required Mods") requiredMods = value
            else if (label === "Allowed Mods") allowedMods = value
            else if (label === "Freestyle") freestyle = value === "true"
        }
      
        const rulesetText = edit_btn.parentNode.parentNode.parentNode.querySelector(".playlist-item-ruleset").textContent
        const rulesetId = modes.indexOf(rulesetText)
      
        document.getElementById("popup-edit-beatmap-id").value = beatmapId
        document.getElementById("popup-edit-ruleset-id").value = rulesetId >= 0 ? rulesetId : ""
        document.getElementById("popup-edit-required-mods").value = requiredMods
        document.getElementById("popup-edit-allowed-mods").value = allowedMods
        document.getElementById("popup-edit-freestyle").checked = freestyle
        editing_playlist_item = playlist_id
        editPlaylistModal.classList.add('visible')
    })

    document.getElementById("playlist-items").appendChild(clone)
    const beatmap = await GetBeatmap(beatmap_id)
    document.querySelector(`[class~="${playlist_id}"]`).querySelector('.playlist-item-id').textContent = beatmap.beatmapset.title + ` [${beatmap.version}]`
}

function removePlayer(user_id) {
    document.querySelector(`[data-user_id="${user_id}"]`).remove()
    return delete players[user_id]
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

function addSystemMsg(msg) {
    document.getElementById("no-messages")?.remove()
    const template = document.getElementById("sys-message")
    const clone = template.content.cloneNode(true);
    
    clone.querySelector('.sys-message').textContent = msg
    
    const chatbox = document.getElementById("chat-messages")
    chatbox.appendChild(clone)

    if (chatbox.scrollHeight - chatbox.scrollTop - chatbox.clientHeight < 50) {
        chatbox.scrollTop = chatbox.scrollHeight;
    }

}

function refreshPlaylistItems() {
    document.getElementById("playlist-items").innerHTML = ""
    for (const item of Object.values(playlistItems)) {
        console.log(item)
        addPlaylistItem(item.id, item.ruleset_id, item.beatmap_id, item.required_mods, item.allowed_mods, item.freestyle, item.was_played)
    }
}


function addVerboseMods(user_id, mods) { // might work, **definitely** needs testing
    // TODO add the user's name to the UI & make it pretty
    let user = players[user_id] ?? other_players[user_id] // other players is literally just for testing
    const verboseMods = document.getElementById("mods-verbose-container");
    const cur = verboseMods.querySelector(`[data-user_id="${user_id}"]`)
    const template = document.getElementById("player-mods-verbose");
    const mod_template = document.getElementById("player-mod-item")
    const clone = template.content.cloneNode(true);
    const mod_div = cur != null ? cur : clone.querySelector(".mods-container")
    const mod_list = mod_div.querySelector(".mods-list")
    let empty = true
    mod_list.innerHTML = ""
    for (const mod of mods) { // TODO split it again and such
        const mod_clone = mod_template.content.cloneNode(true);
        const settings_div = mod_clone.querySelector(".mod-item")
        let user_div = mod_div.querySelector(".mods-user")
        let mod_name = settings_div.querySelector(".mod-item-name")
        let mod_settings = settings_div.querySelector(".mod-item-settings")
        const mod_info = MODS[0].Mods.find(x => x.Acronym == mod.acronym)
        // settings is in the form of {option: number|string|boolean} im pretty sure
        let settings_text = ""
        for (const setting of Object.entries(mod.settings)) {
            settings_text += `${setting[0]}:${setting[1]}, `
        }
        const undefault_settings = mod.settings != null && Object.entries(mod.settings).length != 0
        if (undefault_settings) {
            empty = false
            user_div.textContent = user != undefined ? user.username : user_id
            mod_name.textContent = mod_info.Name
            mod_settings.textContent = settings_text
        }
        if (undefault_settings) mod_list.appendChild(mod_clone)
    }
    if (empty) {
        if (cur != null) cur.remove() // delete it if previously modded
        return;
    }
    mod_div.dataset.user_id = user_id
    if (cur == null) verboseMods.appendChild(clone)
}


// Timer
function startTimer(seconds) {
    const informTimes = [30, 15, 10, 5]
    window.api.api.SendMessage(chat_channel_id, `Started a countdown for ${seconds} seconds`)
    let elapsed = 0
    countdown_id = setInterval(() => {
        console.log(elapsed, seconds)
        if (elapsed >= seconds) {
            clearInterval(countdown_id)
            window.api.api.SendMessage(chat_channel_id, "The countdown has ended.")
            countdown_id = null
            return;
        }
        if (informTimes.includes(seconds-elapsed) || (seconds - elapsed) % 60 == 0) {
            let msg = "The countdown has "
            msg += (seconds-elapsed) >= 60 ? `${Math.floor(seconds / 60)} minutes ` : ""
            msg += `${(seconds-elapsed) % 60} seconds remaining.`
            window.api.api.SendMessage(chat_channel_id, msg)
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
        teams[0].querySelector('.score-team-total').textContent = red_score
        teams[1].querySelector('.score-team-total').textContent = blue_score
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

    const result = await osu.AddPlaylistItem(currentRoomId, {
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
    await osu.RemovePlaylistItem(currentRoomId, {
        playlist_item_id: editing_playlist_item
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

    const result = await osu.EditPlaylistItem(currentRoomId, {
        playlist_item_id: editing_playlist_item,
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
    const result = await osu.InvitePlayer(currentRoomId, user_id)
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
    const result = await osu.SetLockState(currentRoomId, {"locked": !unlocked});
    if (result.success) {
        toggleLockBtn.textContent = (!unlocked) ? "Unlocked" : "Locked";
    }
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
    const result = await osu.AddReferee(currentRoomId, user_id)
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
        showRoomActions(result.data.room_id, result.data.chat_channel_id, result.data.name, result.data.password)
        hideRoomCreation()
        connected = true
        chat_channel_id = result.data.chat_channel_id;
        const playlist = result.data.playlist[0]
        addPlaylistItem(playlist.id, playlist.ruleset_id, playlist.beatmap_id, playlist.required_mods, playlist.allowed_mods, playlist.freestyle, playlist.was_played)
        playlistItems[playlist.id] = playlist

        document.getElementById('cur-match-type').textContent = result.data.type
    }
})

document.getElementById('join-room-btn').addEventListener('click', async () => {
    const roomId = int('join-room-id')
    const result = await osu.JoinRoom(roomId)
    if (result.success) {
        showRoomActions(roomId, result.data.chat_channel_id, result.data.name, result.data.password)
        hideRoomCreation()
        connected = true
        chat_channel_id = result.data.chat_channel_id;
        const playlists = result.data.playlist
        for (const playlist of playlists) {
            addPlaylistItem(playlist.id, playlist.ruleset_id, playlist.beatmap_id, playlist.required_mods, playlist.allowed_mods, playlist.freestyle, playlist.was_played)
            playlistItems[playlist.id] = playlist
        }
        for (const p of result.data.players) {
            let user = await GetUser(p.user_id)
            addPlayer(p.user_id, p.status, user.username, p.team ?? "none")
        }

        document.getElementById('cur-match-type').textContent = result.data.type
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
    const result = await osu.ChangeRoomSettings(currentRoomId, settings)
    hideSettingsDropdown()
})

// ── Match Control ──────────────────────────────────────────────────────────
document.getElementById('start-match-btn').addEventListener('click', async () => {
    const result = await osu.StartMatch(currentRoomId, {
        'countdown': int('start-match-seconds')
    })
})

document.getElementById('timer-btn').addEventListener('click', async () => {
    clearInterval(countdown_id);
    countdown_id = startTimer(int('start-match-seconds'));
})

document.getElementById('stop-countdown-btn').addEventListener('click', async () => {
    const result = await osu.StopMatchCountdown(currentRoomId)
    if (countdown_id != null) {
        clearInterval(countdown_id)
        addSystemMsg("Countdown aborted")
        countdown_id = null
    }
})

document.getElementById('abort-match-btn').addEventListener('click', async () => {
    const result = await osu.AbortMatch(currentRoomId)
})

document.getElementById('close-room-btn').addEventListener('click', async () => {
    const ok = await confirm(
        'Close Room',
        'Are you sure you want to permanently close room ' + currentRoomId + '? This cannot be undone.'
    )
    if (!ok) return
    const result = await osu.CloseRoom(currentRoomId)
    if (result.success) {
        hideRoomActions() // copied around, TODO generalize
        showRoomCreation()
        connected = false
        players = {}
        playlistItems = {}
        refreshPlaylistItems()
        chat_channel_id = ""

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
    if (chat_channel_id != "" && str('chat-input').trim()) {
        window.api.api.SendMessage(chat_channel_id, str('chat-input'))
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
            osu.Roll(currentRoomId, {max: parseInt(max)})
        },
        "!mp": (args) => {
            cmdRunner(args.shift(), ...args)
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
window.api.on.UserJoined(async info => {
    const user = await GetUser(info.user_id, true)
    console.log(user.username, "has joined!!")
    addPlayer(info.user_id, "idle", user.username, "none")
    players[info.user_id].state = "idle" // scuffed as hell but whatever
    console.log("buh")

})
window.api.on.UserLeft(info => {
    removePlayer(info.user_id)
})
window.api.on.UserKicked(info => {
    console.log(me)
    console.log(me.id)
    if (info.kicked_user_id == me.id) {
        hideRoomActions()
        showRoomCreation()
        connected = false
        players = {}
        playlistItems = {}
        refreshPlaylistItems()
        chat_channel_id = ""

        document.getElementById("chat-messages").innerHTML = '<div id="no-messages" class="text-gray-500 dark:text-gray-400 text-sm italic">No messages yet...</div>'
    }
    removePlayer(info.kicked_user_id)
})
window.api.on.RoomSettingsChanged(info => {
    room_name = info.name
    password = info.password
    document.getElementById('room-name').textContent = info.name
    document.getElementById('cur-match-type').textContent = info.type
})
window.api.on.PlaylistItemAdded(info => {
    const data = info.playlist_item
    if (data.was_played) {
        removePlaylistItem(data.id)
        delete playlistItems[data.id]
    } else {
        addPlaylistItem(data.id, data.ruleset_id, data.beatmap_id, data.required_mods, data.allowed_mods, data.freestyle, data.was_played)
        playlistItems[data.id] =data
    }
})
window.api.on.PlaylistItemChanged(info => {
    const data = info.playlist_item
    const playlist_id = data.id
    //const playlist = document.querySelector(`[class~="${playlist_id}"]`)
    if (data.was_played) {
        removePlaylistItem(data.id)
        delete playlistItems[data.id]
    } else {
        Object.keys(data).forEach(key => {
            playlistItems[playlist_id][key] = data[key]
        })
    }
    refreshPlaylistItems()
})
window.api.on.PlaylistItemRemoved(info => {
    delete playlistItems[info.playlist_item_id]
    refreshPlaylistItems()
})
window.api.on.UserStatusChanged(info => {
    const user_id = info.user_id
    const playerDiv = document.querySelector(`[data-user_id="${user_id}"]`)
    playerDiv.querySelector(".player-status").textContent = info.status
    players[user_id].state = info.status
})

window.api.on.UserModsChanged(info => { // TODO: check if when playlistItem changes/removes if user mods get reset
    const mods = info.mods
    const user_id = info.user_id
    const playerDiv = document.querySelector(`[data-user_id="${user_id}"]`)
    let mod_str = mods.map(item => item.acronym).join(" ");
    playerDiv.querySelector(".player-mods").textContent = mod_str ? mod_str : "N/A"
    addVerboseMods(user_id, mods)
})

window.api.on.UserStyleChanged(info => {
    // idk man if your tourmament has freestyle you have bigger problems
    // TODO fix this i guess
})

window.api.on.UserTeamChanged(info => {
    const user_id = info.user_id;
    const user_UI = document.querySelector(`[data-user_id="${user_id}"]`).querySelector(".player-team")
    console.log(user_id)
    console.log(user_UI)
    user_UI.classList.remove("team-none", "team-red", "team-blue")
    user_UI.classList.add("team-" + info.team)
})
window.api.on.CountdownStarted(info => {
    document.getElementById('cur-match-countdown').textContent = info.seconds
})
window.api.on.CountdownStopped(info => {
    document.getElementById('cur-match-countdown').textContent = "-"
})
window.api.on.MatchStarted(info => {
    document.getElementById('cur-match-status').textContent = "Playing"
})
window.api.on.MatchAborted(info => {
    document.getElementById('cur-match-status').textContent = "Aborted"
})
window.api.on.MatchCompleted(info => {
    document.getElementById('cur-match-status').textContent = "Idle"
    addScore(currentRoomId, info.playlist_item_id)
})

window.api.on.RollCompleted(async info => {
    let user = await GetUser(info.user_id)
    addSystemMsg(`${user.username} rolled ${info.result}/${info.max}.`)
})

window.api.api.onChatMessage(async buffer => {
    if (chat_channel_id == "") return;
    const data = JSON.parse(buffer)
    if (data.event != "chat.message.new") return;
    const messages = data.data.messages
    for (const msg of messages) {
        if (msg.channel_id == chat_channel_id) {
            //console.log("ohmygah")
            console.log(msg.sender_id, msg.content)
            let user = await GetUser(msg.sender_id)
            addChatMsg(msg.content, user.username, user.avatar_url)
            //if (!commandHandler(user.username, msg.content)) addChatMsg(msg.content, user.username, user.avatar_url)
        }
    }
})

