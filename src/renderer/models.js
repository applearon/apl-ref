import { idFromUsername, osu } from './utils.js'

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
        this.playlistItems = resp.playlist
        // TODO do GetUser-y stuff here
        // i guess it's fine for each to have their own user list?
        // ^ since they really shouldn't ever overlap (besides yourself)
        this.players = {}
        this.refs = {}
        this.player_ids = resp.players
        for (const ref of resp.referees) {
            this.GetUser(ref.user_id).then((u) => {
                this.refs[ref.user_id] = u
            })
        }
        this.type = resp.state.type ?? "head_to_head"
        this.locked = resp.state.locked ?? false
    }
    async GetUser(user_id, normal) {
        normal = normal ?? false
        console.log("WHAT")
        console.log(this.players)
        console.log(this.refs)
        user_id = idFromUsername(user_id, this.players, this.refs) ?? user_id
        let user = this.players[user_id] ?? this.refs[user_id]
        if (user != undefined) {
            return user
        } else {
            console.log("grabbing new player!!")
            user = (await window.api.api.GetUser(user_id)).data
            let ret = new User(user_id, user, null, null, null, null)
            if (normal) this.players[user.id] = ret
            if (!normal) this.refs[user.id] = ret
            return ret
        }
    }

    updateUI() {

        // Players
        document.getElementById("player-list").innerHTML = ''
        console.log("wha", this.players)
        for (const player of Object.values(this.players)) {
            console.log("updating player:", player)
            const team_class = "team-" + player.team.toLowerCase() // only red and blue or none
            const template = document.getElementById("player-item")
            const clone = template.content.cloneNode(true);
            clone.querySelector(".player-status").textContent = player.status
            clone.querySelector(".player-name").textContent = player.user.username
            const teamSpan = clone.querySelector(".player-team")
            teamSpan.classList.add(team_class)
            clone.getElementById("player-mods").textContent = "N/A"
            teamSpan.addEventListener("click", async () => {
                // TODO change to if it's head-to-head
                //if(teamSpan.classList.contains("team-none")) return;
                //^ i think it'll just fail?? maybe check specifically if the mode is head-to-head
                //cant do this cause something something they start out as grey
                const result = await osu.MoveUser(this.id, { // TODO: i dont love calling from here but wtv
                    user_id: player.id,
                    team: teamSpan.classList.contains("team-red") ? "blue" : "red"
                })
                console.log(result)
            })
            teamSpan.style.cursor = 'pointer';
        
            clone.querySelector(".player-item").dataset.user_id = player.id
            
        
            const kickBtn = clone.querySelector(".kick-btn")
            kickBtn.addEventListener("click", async () => {
                const confirmed = await confirm("Kick Player", "Are you sure you want to kick " + name + "?")
                if (confirmed) {
                    await osu.KickPlayer(this.id, player.id)
                }
            })
            
            document.getElementById("player-list").appendChild(clone)

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

    async #queueLoop() {
        this.processing = true;
        while (this.arr.length > 0) {
            const ev = this.arr.shift()
            const data = ev.data
            switch (ev.name) {
            case "UserJoined": {
                console.log(data)
                const user = await this.room.GetUser(data.user_id, true)
                console.log(user.user.username, "has joined!!")
                //addPlayer(info.user_id, "idle", user.user.username, "none")
                this.room.players[data.user_id].status = "idle"
                this.room.players[data.user_id].team = "none"
            } break;

            
            }
            this.room.updateUI()
        }

        this.processing = false;
    }
}
