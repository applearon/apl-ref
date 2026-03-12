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


// Stored Data TODO: make this into a proper class
let players = {};
let other_players = {}; // removes calling too much, should be partially(?) replaced with referee list
let playlistItems = {};
let chat_channel_id = ""
let connected = false;

let editing_playlist_item = 0;
let password = ""
let room_name = ""

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
  const dropdown = document.getElementById('settings-dropdown')
  const trigger = document.getElementById('settings-trigger')
  if (!dropdown.contains(e.target) && !trigger.contains(e.target)) {
    hideSettingsDropdown()
  }
})

// ── State ─────────────────────────────────────────────────────────────────
let currentRoomId = null


// ── Helpers ───────────────────────────────────────────────────────────────

const osu = window.api.send;

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

function logEvent(name, data) {
  const log = document.getElementById('event-log')
  const placeholder = log.querySelector('.event-placeholder')
  if (placeholder) placeholder.remove()
  const entry = document.createElement('div')
  entry.className = 'event-entry'
  entry.textContent = '[' + new Date().toLocaleTimeString() + '] ' + name + ': ' + JSON.stringify(data)
  log.prepend(entry)
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
  document.getElementById('room-info-id').textContent = roomId
  document.getElementById('room-chat-id').textContent = channelId
  document.getElementById('room-name').textContent = name

}

function hideRoomActions() {
  currentRoomId = null
  document.getElementById('room-actions').classList.add('hidden')
  document.getElementById('room-chat-badge').classList.remove('visible')
  document.getElementById('navbar-room-controls').classList.remove('visible')
  document.getElementById('room-info-id').textContent = ''
  document.getElementById('room-chat-id').textContent = ''
  document.getElementById('room-name').textContent = "APL Ref Client"
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
        // done, untested
        if(teamSpan.classList.contains("team-none")) return;
        const result = await osu.MoveUser(currentRoomId, {
            user_id,
            team: teamSpan.classList.contains("team-red") ? "red" : "blue"
        })
        console.log(result)
    })
    teamSpan.style.cursor = 'pointer';
    clone.querySelector(".player-item").classList.add(user_id)
    
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
      const playlistItem = clone.querySelector(".playlist-item")
      
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
    const beatmap = (await window.api.api.GetBeatmap(beatmap_id)).data
    document.querySelector(`[class~="${playlist_id}"]`).querySelector('.playlist-item-id').textContent = beatmap.beatmapset.title + ` [${beatmap.version}]`
}

function removePlayer(user_id) {
    document.querySelector(`[class~="${user_id}"]`).remove()
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

    document.getElementById("chat-messages").appendChild(clone)
}

function refreshPlaylistItems() {
    document.getElementById("playlist-items").innerHTML = ""
    for (const item of Object.values(playlistItems)) {
        addPlaylistItem(item.id, item.ruleset_id, item.beatmap_id, item.required_mods, item.allowed_mods, item.freestyle, item.was_played)
    }
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
        for (team of teams) {
            team.classList.remove("visible")
        }
    } else {
        for (team of teams) {
            team.classList.add("visible")
        }
    }
}

function removeAllScores() {
    document.querySelector(".score-players-solo").innerHTML = ""
    for (team of team_div = document.querySelectorAll(".score")) {
        team.querySelector('.score-players').innerHTML = ""
    }
}

async function addScore(room_id, playlist_id) {
    removeAllScores()
    const head_to_head = document.getElementById('cur-match-type').textContent == "head_to_head"
    scoreMode(head_to_head);
    //const addFunc = head_to_head ? addSoloScore : addTeamSoloScore

    const scores = (await window.api.api.GetScores(room_id, playlist_id)).data
    console.log(scores)
    let red_score = 0
    let blue_score = 0
    for (score of scores.scores) {
        if (head_to_head) {
            addSoloScore(score.user.username, score.total_score)
        } else {
            const team = document.querySelector(`[class~="${score.user_id}"]`).querySelector(".player-team").classList.contains('team-red') ? 'red' : 'blue'
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
        user_id = user.id
    }
    const result = await osu.InvitePlayer(currentRoomId, user_id)
    //console.log(result)
    setResult('invite-player-result', result)
    // we probably want to invite a lot at once
    // invitePlayerModal.classList.remove('visible')

    
})


// change team
const player_team_btns = document.querySelectorAll('player-team')

for (team_btn of player_team_btns) {
    team_btn.addEventListener()
}
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
document.getElementById('make-room-btn').addEventListener('click', async () => {
  const result = await osu.MakeRoom({
    ruleset_id: int('make-ruleset-id'),
    beatmap_id: int('make-beatmap-id'),
    name: str('make-room-name')
  })
  setResult('make-room-result', result)
  console.log(result)
  if (result.success && result.data) {
    showRoomActions(result.data.room_id, result.data.chat_channel_id, result.data.name, result.data.password)
    hideRoomCreation()
    osu.StartMatch(currentRoomId, {}) // Jank as hell but this should properly give the Playlist info I need
    connected = true
    chat_channel_id = result.data.chat_channel_id;
    console.log(result.data)
  }
})

document.getElementById('join-room-btn').addEventListener('click', async () => {
  const roomId = int('join-room-id')
  const result = await osu.JoinRoom(roomId)
  setResult('join-room-result', result)
  if (result.success) {
    showRoomActions(roomId, result.data.chat_channel_id, result.data.name, result.data.password)
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
  setResult('change-settings-result', result)
  hideSettingsDropdown()
})

// ── Match Control ──────────────────────────────────────────────────────────
document.getElementById('start-match-btn').addEventListener('click', async () => {
  const result = await osu.StartMatch(currentRoomId, {
      'countdown': int('start-match-seconds')
  })
  setResult('start-match-result', result)
})

document.getElementById('stop-countdown-btn').addEventListener('click', async () => {
  const result = await osu.StopMatchCountdown(currentRoomId)
  setResult('stop-countdown-result', result)
})

document.getElementById('abort-match-btn').addEventListener('click', async () => {
  const result = await osu.AbortMatch(currentRoomId)
  setResult('abort-match-result', result)
})

// ── Leave / Close Room (with confirmation) ─────────────────────────────────
document.getElementById('leave-room-btn').addEventListener('click', async () => {
  const ok = await confirm(
    'Leave Room',
    'Are you sure you want to leave room ' + currentRoomId + '? Your referee privileges will be removed.'
  )
  if (!ok) return
  const result = await osu.LeaveRoom(currentRoomId)
  if (result.success) {
    hideRoomActions()
    showRoomCreation()
    connected = false;
    players = {}
    playlistItems = {}
    chat_channel_id = ""

    document.getElementById("chat-messages").innerHTML = '<div id="no-messages" class="text-gray-500 dark:text-gray-400 text-sm italic">No messages yet...</div>'
  } else {
    setResult('join-room-result', result)
  }
})

document.getElementById('close-room-btn').addEventListener('click', async () => {
  const ok = await confirm(
    'Close Room',
    'Are you sure you want to permanently close room ' + currentRoomId + '? This cannot be undone.'
  )
  if (!ok) return
  const result = await osu.CloseRoom(currentRoomId)
  if (result.success) {
    hideRoomActions()
    showRoomCreation()
    connected = false
    players = {}
    playlistItems = {}
    chat_channel_id = ""

    document.getElementById("chat-messages").innerHTML = '<div id="no-messages" class="text-gray-500 dark:text-gray-400 text-sm italic">No messages yet...</div>'
  } else {
    setResult('join-room-result', result)
  }
})

// Messaging

document.getElementById('chat-send-btn').addEventListener('click', async () => {
    // str('chat-input')
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
function commandHandler(username, message) {
    const commands = {
        "!roll": () => {
            const max = 100;
            const roll = Math.floor(Math.random() * max) + 1; // add one so we're not indexing by 0
            window.api.api.SendMessage(chat_channel_id, `${username} has rolled ${roll}.`)
        }
    }
    if (commands[message.trim()] != undefined) {
        commands[message.trim()]();
    }
}

// ── Event listeners ────────────────────────────────────────────────────────
window.api.onPong(msg => logEvent('Pong', msg))
window.api.onUserJoined(async info => {
    logEvent('UserJoined', info)
    const user = await window.api.api.GetUser(info.user_id)
    console.log(user.data.username, "has joined!!")
    addPlayer(info.user_id, "idle", user.data.username, "none")
    players[info.user_id] = user.data

})
window.api.onUserLeft(info => {
    logEvent('UserLeft', info)
    removePlayer(info.user_id)
})
window.api.onUserKicked(info => {
    logEvent('UserKicked', info)
    removePlayer(info.user_id)
})
window.api.onRoomSettingsChanged(info => {
    logEvent('RoomSettingsChanged', info);
    room_name = info.name
    password = info.password
    document.getElementById('room-name').textContent = info.name
    document.getElementById('cur-match-type').textContent = info.type
})
window.api.onPlaylistItemAdded(info => {
    logEvent('PlaylistItemAdded', info)
    const data = info.playlist_item
    if (data.was_played) {
        removePlaylistItem(data.id)
        delete playlistItems[data.id]
    } else {
        addPlaylistItem(data.id, data.ruleset_id, data.beatmap_id, data.required_mods, data.allowed_mods, data.freestyle, data.was_played)
        playlistItems[data.id] =data
    }
})
window.api.onPlaylistItemChanged(info => {
    logEvent('PlaylistItemChanged', info)
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
window.api.onPlaylistItemRemoved(info => {
    logEvent('PlaylistItemRemoved', info)

    delete playlistItems[info.playlist_item_id]
    refreshPlaylistItems()
})
window.api.onUserStatusChanged(info => {
    logEvent('UserStatusChanged', info)
    const user_id = info.user_id
    const playerDiv = document.querySelector(`[class~="${user_id}"]`)
    playerDiv.querySelector(".player-status").textContent = info.status
})

window.api.onUserModsChanged(info => {
    logEvent('UserModsChanged', info)
    const mods = info.mods
    const user_id = info.user_id
    const playerDiv = document.querySelector(`[class~="${user_id}"]`)
    playerDiv.getElementById("player-mods").textContent = mods.map(item => item.acronym).join(" ");
})
window.api.onUserStyleChanged(info => {
    logEvent('UserStyleChanged', info)
    // idk man if your tourmament has freestyle you have bigger problems
    // TODO fix this i guess
})

window.api.onUserTeamChanged(info => {
    logEvent('UserTeamChanged', info)
    const user_id = info.user_id;
    const user_UI = document.querySelector(`[class~="${user_id}"]`).querySelector(".player-team")
    user_UI.classList.remove(["team-none", "team-red", "team-blue"])
    user_UI.classList.add("team-" + info.team)
})
window.api.onCountdownStarted(info => {
    document.getElementById('cur-match-countdown').textContent = info.seconds
    logEvent('CountdownStarted', info)
})
window.api.onCountdownStopped(info => {
    logEvent('CountdownStopped', info)
    document.getElementById('cur-match-countdown').textContent = "-"
})
window.api.onMatchStarted(info => {
    logEvent('MatchStarted', info)
    document.getElementById('cur-match-status').textContent = "Playing"
})
window.api.onMatchAborted(info => {
    logEvent('MatchAborted', info)
    document.getElementById('cur-match-status').textContent = "Aborted"
})
window.api.onMatchCompleted(info => {
    logEvent('MatchCompleted', info)
    document.getElementById('cur-match-status').textContent = "Idle"
    addScore(info.room_id, info.playlist_item_id)
})

window.api.api.onChatMessage(async buffer => {
    if (chat_channel_id == "") return;
    const data = JSON.parse(buffer)
    if (data.event != "chat.message.new") return;
    const messages = data.data.messages
    for (msg of messages) {
        if (msg.channel_id == chat_channel_id) {
            //console.log("ohmygah")
            console.log(msg.sender_id, msg.content)
            let user = players[msg.sender_id] ?? other_players[msg.sender_id]
            if (user != undefined) {
                addChatMsg(msg.content, user.username, user.avatar_url)
            } else {
                console.log("grabbing new player!!")
                user = (await window.api.api.GetUser(msg.sender_id)).data
                other_players[msg.sender_id] = user
                addChatMsg(msg.content, user.username, user.avatar_url)
            }
            commandHandler(user.username, msg.content)
        } //else {
          //  console.log(msg.sender_id, msg.content)
          //}
    }
})
