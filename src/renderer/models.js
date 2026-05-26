import { idFromUsername, osu, GetBeatmap, MODS } from './utils.js'

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
        this.id = resp.room_id 
        this.chat_channel_id = resp.chat_channel_id
        this.name = resp.name
        this.password = resp.password
        this.playlistItems = {}
        for (const item of resp.playlist) {
            this.playlistItems[item.id] = item
        }
        // TODO do GetUser-y stuff here
        // i guess it's fine for each to have their own user list?
        // ^ since they really shouldn't ever overlap (besides yourself)
        this.players = {}
        this.refs = {}
        this.player_slots = resp.players // the ordering
        for (const ref of resp.referees) {
            this.GetUser(ref.user_id).then((u) => {
                this.refs[ref.user_id] = u
            })
        }
        this.type = resp.state.type ?? "head_to_head"
        this.locked = resp.state.locked ?? false

        // i really need to think of a better way to do this
        this.editing_playlist_item = 0;
    }
    async GetUser(user_id, normal) {
        normal = normal ?? false
        user_id = idFromUsername(user_id, this.players, this.refs) ?? user_id
        let user = this.players[user_id] ?? this.refs[user_id]
        if (user != undefined) {
            return user
        } else {
            console.log("grabbing new player!!", user_id, normal)
            user = (await window.api.api.GetUser(user_id)).data
            let ret = new User(user_id, user, null, [], null, null)
            if (normal) this.players[user.id] = ret
            if (!normal) this.refs[user.id] = ret
            return ret
        }
    }


    // UI Helpers and stuff
    #addPlayer(user_id, player_status, name, team) {
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
            const result = await osu.MoveUser(this.id, {
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
            // TODO bring over the real confirm function
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

        document.getElementById("playlist-items").appendChild(clone)
        const beatmap = await GetBeatmap(beatmap_id)
        document.querySelector(`[class~="${playlist_id}"]`).querySelector('.playlist-item-id').textContent = beatmap.beatmapset.title + ` [${beatmap.version}]`
    }
    
    async #addVerboseMods(user_id, mods) {
        // TODO add the user's name to the UI & make it pretty
        let user = await this.GetUser(user_id, true)
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
                user_div.textContent = user != undefined ? user.user.username : user_id
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

    updateUI() {

        // Players
        document.getElementById("player-list").innerHTML = ''
        for (const player of Object.values(this.players)) {
            console.log("UI Updating", player)
            this.#addPlayer(player.id, player.status, player.user.username, player.team)
            const playerDiv = document.querySelector(`[data-user_id="${player.id}"]`)
            let mod_str = player.mods.map(item => item.acronym).join(" ")
            console.log("mod_str", mod_str)
            playerDiv.querySelector(".player-mods").textContent = mod_str ? mod_str : "N/A"
            this.#addVerboseMods(player.id, player.mods)
        }

        // Room Settings
        document.getElementById('room-name').textContent = this.name
        document.getElementById('cur-match-type').textContent = this.type
        document.getElementById('settings-name').value = this.name
        document.getElementById('settings-password').value = this.password
        document.getElementsByName("match_type")[0].checked = this.type == "head_to_head"
        document.getElementsByName("match_type")[1].checked = this.type != "head_to_head"
        
        // Match State
        document.getElementById('toggle-lock-btn').textContent = this.locked ? "Locked" : "Unlocked"

        // Playlist Items
        document.getElementById("playlist-items").innerHTML = ""
        for (const playlist_item of Object.values(this.playlistItems)) {
            // (playlist_id, ruleset_id, beatmap_id, required_mods, allowed_mods, freestyle)
            this.#addPlaylistItem(playlist_item.id, playlist_item.ruleset_id, playlist_item.beatmap_id, playlist_item.required_mods, playlist_item.allowed_mods, playlist_item.freestyle)
        }
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
        while (this.arr.length > 0) {
            const ev = this.arr.shift()
            const data = ev.data
            switch (ev.name) {
            case "UserJoined": {
                const user = await this.room.GetUser(data.user_id, true)
                console.log(user.user.username, "has joined!!")
                //addPlayer(info.user_id, "idle", user.user.username, "none")
                this.room.players[data.user_id].status = "idle"
                this.room.players[data.user_id].team = "none"
                this.room.player_slots.push(data.user_id)
            } break;
            case "UserLeft": {
                delete this.room.players[data.user_id]
            } break;
            case "UserKicked": {
                if (data.kicked_user_id == window.me.id) {
                    // IDK MAN LIKE
                    // it needs to kill itself
                    // TODO HELP
                    // hideRoomActions()
                    // showRoomCreation()
                    // connected = false
                    // players = {}
                    // playlistItems = {}
                    // refreshPlaylistItems()
                    // chat_channel_id = ""

                    // document.getElementById("chat-messages").innerHTML = '<div id="no-messages" class="text-gray-500 dark:text-gray-400 text-sm italic">No messages yet...</div>'

                }
                delete this.room.players[data.user_id]
            } break;
            case "RoomSettingsChanged": {
                this.room.name = data.name
                this.room.password = data.password
                this.room.type = data.type
            } break;
            case "MatchStateChanged": {
                this.room.locked = data.state.locked;
                this.room.type = data.state.type
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
                delete this.room.playlistItems[data.playlist_item.id]
            } break;
            case "UserStatusChanged": {
                this.room.players[data.user_id].status = data.status
            } break;
            case "UserModsChanged": {
                this.room.players[data.user_id].mods = data.mods
            } break;
            case "UserStyleChanged": {
                // yeah i continue to question your sanity
                // if you need this for your tournament
            } break;
            case "UserTeamChanged": {
                this.room.players[data.user_id].team = data.team
            } break;
            }
            this.room.updateUI()
        }

        this.processing = false;
    }
}
