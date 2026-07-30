import { idFromUsername, osu, GetBeatmap, MODS, showToast, confirmUI } from './utils.js'

function hideRoomActions() {
    document.getElementById('room-actions').classList.add('hidden')
    document.getElementById('room-badge').classList.remove('visible')
    document.getElementById('room-chat-badge').classList.remove('visible')
    document.getElementById('navbar-room-controls').classList.remove('visible')

    document.getElementById('add-referee').classList.remove('visible')
    document.getElementById('room-chat-id').textContent = ''
    document.getElementById('room-name').textContent = "APL Ref Client"
}

export class User {
    constructor(id, user, team, mods, style, status) {
        this.id = id; // user id
        this.user = user // user json from api
        this.team = team // team: "red", "blue", "none"
        this.mods = mods; // array of Mods (mod acronym, settings)
        this.style = style; // idek man it's freestyle
        this.status = status // spectating or idle or playing or whatever
    }
}

export class Room {
    // stores all information about a room
    constructor(resp) { // RoomJoinedResponse data 
        this.queue = null
        this.active = true // if it's currently showing itself
        this.id = resp.room_id 
        this.chat_channel_id = resp.chat_channel_id
        this.msg_history = []
        window.api.api.GetChannelMessages(resp.chat_channel_id).then(x => {
            for (let msg of x.data) {
                this.msg_history.push({type: "chat", data: [msg.content, msg.sender.username, msg.sender.avatar_url]})
            }
            this.updateUI()
        })
        this.name = resp.name
        this.password = resp.password
        // bumped on every updateUI so async renders can tell whether the DOM
        // they started drawing into is still the current one
        this.ui_generation = 0
        this.playlistItems = {}
        for (const item of resp.playlist) {
            if (!item.was_played) this.playlistItems[item.id] = item
        }
        this.mode = this.updateMode()
        this.players = {}
        this.refs = {}
        // Limit = 0 is working but null works better i dont know why they did it like that
        // i mean really why is ChangeRoomSettingsRequest is nullable but MakeRoomRequest is not
        // and WHY MakeRoomRequest has a documented range of [2, 256] 
        // BUT ChangeRoomSettingsRequest HAS A DOCUMENTED RANGE OF [2, 128] 
        // WHILE THE ServerMultiplayerRoom HAS A DOCUMENTED RANGE OF [2, 16] 
        // AND IT APPLIES ONLY WHEN YOU DO CHANGE ROOM SETTINGS REQUEST 
        // BUT NOT WHEN YOU MAKE THE ROOM ITSELF

        // I CAN MAKE A ROOM WITH 255 SLOTS (NOT 256 BECAUSE BYTE OVERFLOWS)
        // I CAN ***TRY*** TO CHANGE IT TO 128 ONLY BECAUSE DOCUMENTED RANGE
        // AND GET F*CKING REJECTED BECAUSE SERVER LIMIT OF 16?????
        // WTF
        this.max_participants = resp.state.slots?.length ?? null
        // seed the slot list up front: GetUser calls below are async, and
        // updateUI runs before they resolve. null slots to render
        // an empty player list until every user request comes back.
        this.player_slots = resp.state.slots ?? resp.players.map(p => p.user_id)

        for (const ref of resp.referees) {
            this.GetUser(ref.user_id).then(() => {
                this.updateUI()
                //this.refs[ref.user_id] = u
            })
        }
        for (const p of resp.players) {
            this.GetUser(p.user_id, true).then(() => {
                this.players[p.user_id].team = p.team ?? "none" // this is also set somewhere else but whatever
                this.players[p.user_id].mods = p.mods
                this.players[p.user_id].status = p.status
                this.players[p.user_id].style = p.style
                this.players[p.user_id].mods = p.mods
                // TODO: maybe there's a cleaner way to do this?
                // since it gets the stuff too slowly so yeah
                this.updateUI()
            })
        }
        this.type = resp.state.type ?? "head_to_head"
        this.locked = resp.state.locked ?? false

        // "playing", "idle", etc
        this.status = "Idle"
        // i really need to think of a better way to do this
        this.editing_playlist_item = 0;
        this.#showRoomActions()
        
    }
    updateMode() {
        // the '?? 0' bound after the property access, so a missing order==0 item
        // threw instead of falling back. that happens whenever the current item was
        // just played or the playlist is momentarily empty between events.
        this.mode = Object.values(this.playlistItems).find(x => x.order == 0)?.ruleset_id ?? 0
        return this.mode
    }
    async GetUser(user_id, normal) {
        normal = normal ?? false
        user_id = idFromUsername(user_id, this.players, this.refs) ?? user_id
        let user = this.players[user_id] ?? this.refs[user_id]
        if (user != undefined) {
            // presence handlers just miss refs all the time so cache refs in players and refs 
            if (normal) this.players[user_id] = user
            return user
        } else {
            console.log("grabbing new player!!", user_id, normal)
            user = (await window.api.api.GetUser(user_id)).data
            let ret = new User(user.id, user, "none", [], null, normal ? null : "referee")
            if (normal) this.players[user.id] = ret
            if (!normal) this.refs[user.id] = ret
            console.log(ret)
            return ret
        }
    }

    #showRoomActions() {
        document.getElementById('room-actions').classList.remove('hidden')
        document.getElementById('room-badge').classList.add('visible')
        document.getElementById('room-chat-badge').classList.add('visible')
        document.getElementById('navbar-room-controls').classList.add('visible')

        document.getElementById('add-referee').classList.add('visible')
        document.getElementById('room-badge').addEventListener('click', () => {
            try {
                navigator.clipboard.writeText("https://osu.ppy.sh/multiplayer/rooms/" + this.id)
                showToast("Copied to clipboard!")
            } catch {
                showToast("Failed to copy. idk what happened")
            }
        })
        document.getElementById('room-chat-id').textContent = this.chat_channel_id
        document.getElementById('room-name').textContent = this.name
    }

    // UI Helpers and stuff
    #addPlayer(user_id, player_status, name, team, is_ref) {
        // "idle", "ready", "playing", "finished_play", "spectating"
        if (is_ref) team = "none"
        const team_class = "team-" + team.toLowerCase() // only red and blue or none
        const template = document.getElementById("player-item")
        const clone = template.content.cloneNode(true);
        clone.querySelector(".player-status").textContent = player_status
        clone.querySelector(".player-name").textContent = name
        const teamSpan = clone.querySelector(".player-team")
        teamSpan.classList.add(team_class)
        clone.getElementById("player-mods").textContent = "N/A"
        if (!is_ref) teamSpan.addEventListener("click", async () => {
            if(this.players[user_id].team == "none") return;
            // hi if this is causing problems just comment it
            // it stops it from erroring of changing team when it's head-to-head
            const result = await osu.MoveUser(this.id, {
                user_id,
                team: this.players[user_id].team == "red" ? "blue" : "red"
            })
            console.log(result)
        })
        teamSpan.style.cursor = 'pointer';

        clone.querySelector(".player-item").dataset.user_id =user_id
        
        
        const kickBtn = clone.querySelector(".kick-btn")
        kickBtn.addEventListener("click", async () => {
            const confirmed = await confirmUI("Kick Player", "Are you sure you want to kick " + name + "?")
            if (confirmed) {
                await osu.KickPlayer(this.id, user_id)
            }
        })
        
        document.getElementById("player-list").appendChild(clone)
    }

    async #addPlaylistItem(playlist_id, ruleset_id, beatmap_id, required_mods, allowed_mods, freestyle) {
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
            this.editing_playlist_item = playlist_id
            document.getElementById('edit-playlist-modal').classList.add('visible')
        })

        // grab the node before appending: 'clone' empties out once appended 
        // and looking the node up globally after the await runs
        // with another updateUI that already wiped and rebuilt the list.
        // playlist item ids dont change on edit, so old and new nodes share
        // the same class and querySelector would return the stale one.
        const item_el = clone.querySelector(".playlist-item")
        const title_el = item_el.querySelector('.playlist-item-id')
        document.getElementById("playlist-items").appendChild(clone)

        const gen = this.ui_generation
        const beatmap = await GetBeatmap(beatmap_id)
        // a newer updateUI() ran while we were waiting; this node is orphaned
        if (gen !== this.ui_generation || !item_el.isConnected) return
        title_el.textContent = beatmap.beatmapset.title + ` [${beatmap.version}]`
    }
    #addModSettingUI(mod_list, mod, mod_template) {
        let empty = true
        const mod_clone = mod_template.content.cloneNode(true);
        const settings_div = mod_clone.querySelector(".mod-item")
        let mod_name = settings_div.querySelector(".mod-item-name")
        let mod_settings = settings_div.querySelector(".mod-item-settings")
        const mod_info = MODS[this.mode].Mods.find(x => x.Acronym == mod.acronym)
        // settings is in the form of {option: number|string|boolean} im pretty sure
        let settings_text = []
        for (const setting of Object.entries(mod.settings)) {
            // MODS()[0].Mods.find(x => x.Acronym == "DA").Settings.find(x => x.Name == "circle_size").Label
            let label = mod_info.Settings.find(x => x.Name == setting[0]).Label;
            settings_text.push(`${label}:${setting[1]}`)
        }
        settings_text = settings_text.join(", ")
        const undefault_settings = mod.settings != null && Object.entries(mod.settings).length != 0
        if (undefault_settings) {
            empty = false
            
            mod_name.textContent = mod_info.Name
            mod_settings.textContent = settings_text
        }
        if (undefault_settings) mod_list.appendChild(mod_clone)
        return {empty, undefault_settings}
    }
    async #addVerboseMods(user_id, mods) {
        const gen = this.ui_generation
        let user = await this.GetUser(user_id, true)
        // GetUser can hit the api; return if the UI was rebuilt while we waited
        if (gen !== this.ui_generation) return
        const verboseMods = document.getElementById("mods-verbose-container");
        const cur = verboseMods.querySelector(`[data-user_id="${user_id}"]`)
        const template = document.getElementById("player-mods-verbose");
        const mod_template = document.getElementById("player-mod-item")
        const clone = template.content.cloneNode(true);
        const mod_div = cur != null ? cur : clone.querySelector(".mods-container")
        const mod_list = mod_div.querySelector(".mods-list")
        let user_div = mod_div.querySelector(".mods-user")
        let empty = true
        mod_list.innerHTML = ""
        for (const mod of mods) {
            let res = this.#addModSettingUI(mod_list, mod, mod_template)
            empty = empty && res.empty
            let undefault_settings = res.undefault_settings
            if (undefault_settings) user_div.textContent = user != undefined ? user.user.username : user_id
        }
        if (empty) {
            if (cur != null) cur.remove() // delete it if previously modded
            return;
        }
        mod_div.dataset.user_id = user_id
        if (cur == null) verboseMods.appendChild(clone)
    }
    addSystemMsg(msg) {
        this.msg_history.push({type: "system", data: [msg]})
        this.updateUI()
    }
    addChatMsg(msg, username, pfp) {
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
    updateUI() {

        // Players
        console.log("Updating UI")
        // invalidates any async render still on the way from a previous call
        this.ui_generation++
        document.getElementById("player-list").innerHTML = ''
        for (const pid of this.player_slots) { // ordered properly
            const player = this.players[pid] ?? this.refs[pid]
            if (!pid || !player) { // empty slot
                const template = document.getElementById("empty-slot")
                const clone = template.content.cloneNode(true);
                document.getElementById("player-list").appendChild(clone)
            } else {
                this.#addPlayer(player.id, player.status, player.user.username, player.team)
                const playerDiv = document.querySelector(`[data-user_id="${player.id}"]`)
                let mod_str = player.mods.map(item => item.acronym).join(" ")
                playerDiv.querySelector(".player-mods").textContent = mod_str ? mod_str : "N/A"
                this.#addVerboseMods(player.id, player.mods)
            }
        }

        // Room Settings
        document.getElementById('room-name').textContent = this.name
        document.getElementById('cur-match-type').textContent = this.type
        document.getElementById('settings-name').value = this.name
        document.getElementById('settings-password').value = this.password
        // unlimited shows as a blank field rather than the string "null"
        document.getElementById('settings-maximum-participants').value = this.max_participants ?? ''
        document.getElementsByName("match_type")[0].checked = this.type == "head_to_head"
        document.getElementsByName("match_type")[1].checked = this.type != "head_to_head"
        
        // Required Mods
        let cur = Object.values(this.playlistItems).filter(y => y.order == 0)[0];
        const req_mods_div = document.getElementById('req-verbose-mods')
        const mod_list = req_mods_div.querySelector(".mods-list")
        const mod_template = document.getElementById("player-mod-item")
        mod_list.innerHTML = ""
        if (cur != undefined) { // only happens during inbetween but
            for (const mod of cur.required_mods) {
                this.#addModSettingUI(mod_list, mod, mod_template)
            }
        }
        // Match State
        document.getElementById('toggle-lock-btn').textContent = this.locked ? "Locked" : "Unlocked"

        // Playlist Items
        document.getElementById("playlist-items").innerHTML = ""
        for (const playlist_item of Object.values(this.playlistItems)) {
            this.#addPlaylistItem(playlist_item.id, playlist_item.ruleset_id, playlist_item.beatmap_id, playlist_item.required_mods, playlist_item.allowed_mods, playlist_item.freestyle)
        }

        // Match Status
        document.getElementById('cur-match-status').textContent = this.status

        // Chat
        document.getElementById("chat-messages").innerHTML = '<div id="no-messages" class="text-gray-500 dark:text-gray-400 text-sm italic">No messages yet...</div>'
        for (const msg of this.msg_history) {
            if (msg.type == "chat") {
                this.addChatMsg(...msg.data)
            } else if (msg.type == "system") {
                document.getElementById("no-messages")?.remove()
                const template = document.getElementById("sys-message")
                const clone = template.content.cloneNode(true);
                
                clone.querySelector('.sys-message').textContent = msg.data
                
                const chatbox = document.getElementById("chat-messages")
                chatbox.appendChild(clone)

                if (chatbox.scrollHeight - chatbox.scrollTop - chatbox.clientHeight < 50) {
                    chatbox.scrollTop = chatbox.scrollHeight;
                }
            }
        }
    }
    close() {
        document.getElementById("playlist-items").innerHTML = ""
        const req_mods_div = document.getElementById('req-verbose-mods')
        req_mods_div.querySelector(".mods-list").innerHTML = ""
        document.getElementById("player-list").innerHTML = ''
        hideRoomActions()
        document.getElementById('room-setup').classList.remove('hidden')

        document.getElementById("chat-messages").innerHTML = '<div id="no-messages" class="text-gray-500 dark:text-gray-400 text-sm italic">No messages yet...</div>'
    }
}

export class Event {
    name;
    data;
    constructor(name, data) {
        this.name = name
        this.data = data
    }
}

export class EventQueue {
    constructor(room) {
        this.room = room
        this.arr = [] // array of Event
        this.processing = false
    }
    add(ev) {
        this.arr.push(ev)
        if (!this.processing) this.#queueLoop()
    }

    async #queueLoop() { // TODO maybe add a flag for if we want to update UI
        this.processing = true;
        try {
            await this.#drain()
        } finally {
            // must always clear. if this stays always true, the queue never restarts
            // and every later event is silently dropped while the UI stays frozen
            this.processing = false;
        }
    }

    async #drain() {
        while (this.arr.length > 0) {
            const ev = this.arr.shift()
            const data = ev.data
            try {
                switch (ev.name) {
                case "UserJoined": {
                    const user = await this.room.GetUser(data.user_id, true)
                    console.log(user.user.username, "has joined!!")
                    //addPlayer(info.user_id, "idle", user.user.username, "none")
                    // use what GetUser gave you, why read dict if all data is right here...
                    // andalso  status doubles as the role marker, so don't kill a ref
                    if (user.status != "referee") {
                        user.status = "idle"
                        user.team = "none"
                    }
                    // only track slots when the room is unlimited; 
                    // a sized room gets its slot array from MatchStateChanged
                    if (this.room.max_participants == null) this.room.player_slots.push(data.user_id)
                } break;
                case "UserLeft": {
                    // fix on my stupid attempt
                    delete this.room.players[data.user_id]
                    if (this.room.max_participants == null) this.room.player_slots = this.room.player_slots.filter(x => x != data.user_id)
                } break;
                case "UserKicked": {
                    if (data.kicked_user_id == window.me.id) {
                        this.close()
                    // TODO: make sure this works
                    }
                    delete this.room.players[data.kicked_user_id]
                    if (this.room.max_participants == null) this.room.player_slots = this.room.player_slots.filter(x => x != data.kicked_user_id)
                } break;
                case "RefereeAdded": {
                    // privilege, not presence: they may not have joined yet.
                    // without this they get fetched cold by UserJoined as a
                    // normal player and render as "idle" instead of "referee"
                    const user = await this.room.GetUser(data.user_id)
                    user.status = "referee"
                } break;
                case "RefereeRemoved": {
                    delete this.room.refs[data.user_id]
                } break;
                case "UserBanned": {
                    delete this.room.players[data.user_id]
                    delete this.room.refs[data.user_id]
                    if (this.room.max_participants == null) this.room.player_slots = this.room.player_slots.filter(x => x != data.user_id)
                } break;
                case "RoomSettingsChanged": {
                    this.room.name = data.name
                    this.room.password = data.password
                    this.room.type = data.type
                    // server reports unlimited as null or 0 depending on
                    // how the room was set up; normalize both to null
                    this.room.max_participants = data.max_participants || null
                    // drop to unlimited: hide the padded empty slots away.
                    // growing or shrinking a sized room is left to MatchStateChanged,
                    // which the server always sends alongside this.
                    if (this.room.max_participants == null) this.room.player_slots = this.room.player_slots.filter(x => x != null)
                } break;
                case "MatchStateChanged": {
                    this.room.locked = data.state.locked;
                    this.room.type = data.state.type
                    // if settings box still show stale count after resizing the room
                    if (data.state.slots) {
                        this.room.player_slots = data.state.slots
                        this.room.max_participants = data.state.slots.length
                    }
                } break;
                case "PlaylistItemAdded": {
                    if (data.playlist_item.was_played) {
                        delete this.room.playlistItems[data.playlist_item.id]
                    } else {
                        this.room.playlistItems[data.playlist_item.id] = data.playlist_item
                    }
                } break;
                case "PlaylistItemChanged": {
                    if (data.playlist_item.was_played) {
                        delete this.room.playlistItems[data.playlist_item.id]
                    } else {
                        Object.keys(data.playlist_item).forEach(key => {
                            this.room.playlistItems[data.playlist_item.id][key] = data.playlist_item[key]
                        })
                    }
                } break;
                case "PlaylistItemRemoved": {
                    delete this.room.playlistItems[data.playlist_item_id]
                } break;
                case "UserStatusChanged": {
                    if (this.room.players[data.user_id] == undefined) break;
                    this.room.players[data.user_id].status = data.status
                    if (Object.values(this.room.players).every(p => p.status == "ready" || p.status == "referee")) {
                        const msg = "All Players are ready"
                        this.room.addSystemMsg(msg)
                    }
                } break;
                case "UserModsChanged": {
                    this.room.players[data.user_id].mods = data.mods
                } break;
                case "UserStyleChanged": {
                // yeah i continue to question your sanity
                // if you need this for your tournament

                // decordy_: bruh if someone makes cross-mode tournament,
                // that would be f*cking sick ngl
                } break;
                case "UserTeamChanged": {
                    this.room.players[data.user_id].team = data.team
                } break;
                case "CountdownStarted":
                case "CountdownStopped":
                    break;
                case "MatchStarted": {
                    this.room.status = "Playing"
                } break;
                case "MatchAborted": {
                    this.room.status = "Aborted"
                } break;
                case "MatchCompleted": {
                    this.room.status = "Idle"
                } break;
                case "RollCompleted": {
                // Again i don't love doing UI changes here but
                // chat stuff is ephemeral rn anyways so
                // TODO: store chat messages somewhere and also figure out the
                // flow to get the previous messages
                    let user = await this.room.GetUser(data.user_id)
                    this.room.addSystemMsg(`${user.user.username} rolled ${data.result}/${data.max}`)
                } break;
                }
                this.room.updateMode()
                if (this.room.active) this.room.updateUI()
            } catch (err) {
                // one bad event shouldnt stop the rest of the queue from moving; just log it
                console.error(`Failed to handle ${ev.name}:`, err)
            }
        }
    }
}
