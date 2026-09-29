const log = {}
const modes = ['debug', 'info', 'warn', 'error']
modes.forEach(x => log[x] = (text) => {
    window.api.api.Log(x, text)
    console.log(x + ":", text)
})

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
    const log_div = document.getElementById('event-log')
    const placeholder = log_div.querySelector('.event-placeholder')
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
    log_div.prepend(entry)
    const str = JSON.stringify(data)
    log.info(name + ":" + str);
}

export function addSystemMsg(msg) {
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

export function showToast(message, duration = 3000) {
    const toast = document.getElementById('toast')
    toast.textContent = message
    toast.classList.remove('hidden')
    setTimeout(() => toast.classList.add('hidden'), duration)
}

export function confirmUI(title, body) {
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

export { osu, MODS, log }

export function showSlotsError(id, msg) {
    const el = document.getElementById(id)
    el.textContent = msg ?? ""
    el.classList.toggle("hidden", !msg)
}

export function isUnlimited(id) { return document.getElementById(id).getAttribute('aria-pressed') === 'true' }

// unlimited and count are mutually exclusive; gray out instead of leaving a number
export function setUnlimited(button_id, input_id, error_id, on) {
    const btn = document.getElementById(button_id)
    btn.setAttribute('aria-pressed', String(on))
    btn.classList.toggle('bg-pink-500', on)
    btn.classList.toggle('hover:bg-pink-600', on)
    btn.classList.toggle('bg-gray-400', !on)
    btn.classList.toggle('hover:bg-gray-500', !on)
    document.getElementById(input_id).disabled = on
    if (on) showSlotsError(error_id, null)
}
