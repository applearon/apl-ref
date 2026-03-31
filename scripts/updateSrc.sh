#!/usr/bin/env bash

# if anyone knows what to do that isn't this
# cursed as hell thing pls tell me lmao
rm IRefereeHubClient.cs IRefereeHubServer.cs ../src/renderer/mods.json
wget https://github.com/ppy/osu-server-spectator/raw/refs/heads/master/osu.Server.Spectator/Hubs/Referee/IRefereeHubClient.cs
wget https://github.com/ppy/osu-server-spectator/raw/refs/heads/master/osu.Server.Spectator/Hubs/Referee/IRefereeHubServer.cs
# uh for legal reasons I actually generated the mods from osu-tools or something pls dont sue me ppy
wget https://github.com/ppy/osu-web/raw/refs/heads/master/database/mods.json
mv mods.json ../src/renderer/
