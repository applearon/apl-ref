import { MODS } from "./utils.js";

export function handleModChange(args, mode) {
    const DA_ORDER = [0,2,3,1,4]
    // "FM" and "NM" also
    if (args.length < 1) {
        console.log("bah youre doing it wrong");
        return {success: false, error: "Usage: !mp mods MD MD MD[1,2,3,4]"}
    }
    let mods = args[0].split("+")
    // this is TECHNICALLY not up to spec of lazer tournament
    // but god damnit if stable refs cant have their muscle memory what is even the point
    if (mods.length == 1 && args.length >= 2) mods = args
    const required_mods = []
    let allowed_mods = []
    for (const mod of mods) {
        if (mod.length < 2) {
            return {success: false, error: `Invalid mod acronym: ${mod}`}
        }
        const mod_acronym = mod.slice(0,2).toUpperCase()
        if (mod_acronym == "FM") {
            allowed_mods = MODS[mode].Mods.filter(x => x.ValidForMultiplayerAsFreeMod && x.Type != "System" && x.UserPlayable).map(x => {return {acronym: x.Acronym}}) // i dont care anymore
            continue
        }
        if (mod_acronym == "NM") {
            continue
        }
        if (!MODS[mode].Mods.map(x => x.Acronym).includes(mod_acronym)) {
            return {success: false, error: `Invalid mod acronym: ${mod_acronym}`}
        }
        if (mod.length == 2) {
            required_mods.push({acronym: mod}) // no settings
        } else {
            try {
                const mod_setting_names = MODS[mode].Mods.find(x => x.Acronym == mod_acronym).Settings.map(x => x.Name)
                // ModType.System || !mod.UserPlayable
                // ValidForMultiplayerAsFreeMod
                let settings = JSON.parse(mod.slice(2))
                if (settings.length > mod_setting_names.length) {
                    return {success: false, error: "Invalid settings: " + mod + ": too many arguments"}
                }
                let req_settings = {}
                const is_da = mod_acronym == "DA"
                for (const [i, s] of settings.entries()) { // TODO: i need to order this god dammit
                    // forced order this is some BS im killing myself idk what else to do
                    req_settings[mod_setting_names[is_da ? DA_ORDER[i] : i]] = s
                }
                required_mods.push({acronym: mod_acronym, settings: req_settings})
            } catch {
                return {success: false, error: "Invalid settings: " + mod + ": Couldnt parse settings"}
            }
        }
    }
    allowed_mods = allowed_mods.filter(x => !required_mods.map(x=> x.acronym).includes(x.acronym))
    let required_mods_lst = required_mods.map(x=> x.acronym)
    let incompat_lst = [...new Set(MODS[mode].Mods.filter(x => required_mods_lst.includes(x.Acronym)).map(x => x.IncompatibleMods).flat(1))]
    allowed_mods = allowed_mods.filter(x => !incompat_lst.includes(x.acronym))
    console.log(required_mods)
    console.log(allowed_mods)
    return {
        success: true,
        data: {
            required_mods,
            allowed_mods
        }
    }
}

