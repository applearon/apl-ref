const fs = require("fs");
const path = require("path");
const https = require("https");

const files = [
  {
    url: "https://raw.githubusercontent.com/ppy/osu-server-spectator/master/osu.Server.Spectator/Hubs/Referee/IRefereeHubClient.cs",
    dest: "IRefereeHubClient.cs",
  },
  {
    url: "https://raw.githubusercontent.com/ppy/osu-server-spectator/master/osu.Server.Spectator/Hubs/Referee/IRefereeHubServer.cs",
    dest: "IRefereeHubServer.cs",
  },
  {
    url: "https://raw.githubusercontent.com/ppy/osu-web/master/database/mods.json",
    dest: "../src/renderer/mods.json",
  },
];

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, (response) => {
      response.pipe(file);
      file.on("finish", () => {
        file.close(resolve);
      });
    }).on("error", (err) => {
      fs.unlink(dest, () => reject(err));
    });
  });
}

async function run() {
  // remove old files
  ["IRefereeHubClient.cs", "IRefereeHubServer.cs", "../src/renderer/mods.json"]
    .forEach((f) => {
      const p = path.resolve(__dirname, f);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    });

  // download new ones
  for (const f of files) {
    const destPath = path.resolve(__dirname, f.dest);
    await download(f.url, destPath);
    console.log(`Downloaded ${f.dest}`);
  }
}

run().catch(console.error);
