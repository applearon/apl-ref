import fs = require('node:fs');
// downloaded from https://raw.githubusercontent.com/ppy/osu-server-spectator/refs/heads/master/osu.Server.Spectator/Hubs/Referee/IRefereeHubServer.cs
const x = fs.readFileSync('./IRefereeHubServer.cs', 'utf8');
const y = x.split('\n')
const COMMANDS = []
for (const z of y) {
    if (z.trim().startsWith('//')) continue;
    if (z.trim() == "") continue;
    if (z.trim().startsWith('[')) continue;
    if (z.trim().startsWith('using')) continue;
    if (z.trim().startsWith('public')) continue;
    if (z.trim().startsWith('namespace')) continue;
    if (z.trim().startsWith('{') || z.trim().startsWith('}')) continue;
    const a = z.trim().split(' ')
    a.shift()
    const done = a.toString().slice(0, -2).split(/\(|\,/).filter(i => i).filter((_, i) =>  i % 2 == 0);
    // this is a generic array list
    //process.stdout.write('"' + done[0] + "\", ");

    // so this one is for referee/commands.js, aka the part that is sending the commands out through SignalR
    console.log(done[0] + "(" + done.slice(1).toString() + ")" + "{return this.connection.invoke(\"" + done[0] + "\", " + done.slice(1).toString() + ")},")
}
//console.log(COMMANDS)
