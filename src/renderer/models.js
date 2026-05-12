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
