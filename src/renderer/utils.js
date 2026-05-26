export function idFromUsername(username, arr, refs) {
    arr = Object.assign({}, arr, refs)
    let user = Object.keys(arr).find(key => arr[key].user.username == username)
    if (user != undefined) {
        return user;
    } else {
        return null;
    }
}

export async function GetBeatmap(beatmap_id) {
    if (window.beatmaps[beatmap_id]) return window.beatmaps[beatmap_id]
    let map = await window.api.api.GetBeatmap(beatmap_id)
    console.log("grabbing beatmap data")
    window.beatmaps[beatmap_id] = map.data
    return map.data
}


export async function logEvent(name, data) {
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

let objs = Object.entries(window.api.send)
let osu = {}
for (const cmd of objs) {
    osu[cmd[0]] = (...args) => {
        const res = cmd[1](...args)
        logEvent(cmd[0], res)
        return res
    }
}
let MODS;
fetch('mods.json').then(mod_res => {
    mod_res.json().then(mods => MODS = mods)
})

export { osu, MODS }
