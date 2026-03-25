const CMDS_SET = new Set(["Ping", "MakeRoom", "JoinRoom", "LeaveRoom", "CloseRoom", "InvitePlayer", "KickPlayer", "BanUser", "AddReferee", "RemoveReferee", "ChangeRoomSettings", "EditCurrentPlaylistItem", "AddPlaylistItem", "EditPlaylistItem", "RemovePlaylistItem", "Roll", "MoveUser", "SetLockState", "StartMatch", "StopMatchCountdown", "AbortMatch"]);

const COMMANDS = { // i realize this might be bad form?
    Ping(message){return this.connection.invoke("Ping", message)},
    MakeRoom(request){return this.connection.invoke("MakeRoom", request)},
    JoinRoom(roomId){return this.connection.invoke("JoinRoom", roomId)},
    LeaveRoom(roomId){return this.connection.invoke("LeaveRoom", roomId)},
    CloseRoom(roomId){return this.connection.invoke("CloseRoom", roomId)},
    InvitePlayer(roomId,userId){return this.connection.invoke("InvitePlayer", roomId,userId)},
    KickPlayer(roomId,userId){return this.connection.invoke("KickPlayer", roomId,userId)},
    BanUser(roomId,bannedUserId){return this.connection.invoke("BanUser", roomId,bannedUserId)},
    AddReferee(roomId,targetUserId){return this.connection.invoke("AddReferee", roomId,targetUserId)},
    RemoveReferee(roomId,targetUserId){return this.connection.invoke("RemoveReferee", roomId,targetUserId)},
    ChangeRoomSettings(roomId,request){return this.connection.invoke("ChangeRoomSettings", roomId,request)},
    EditCurrentPlaylistItem(roomId,request){return this.connection.invoke("EditCurrentPlaylistItem", roomId,request)},
    AddPlaylistItem(roomId,request){return this.connection.invoke("AddPlaylistItem", roomId,request)},
    EditPlaylistItem(roomId,request){return this.connection.invoke("EditPlaylistItem", roomId,request)},
    RemovePlaylistItem(roomId,request){return this.connection.invoke("RemovePlaylistItem", roomId,request)},
    Roll(roomId,request){return this.connection.invoke("Roll", roomId,request)},
    MoveUser(roomId,request){return this.connection.invoke("MoveUser", roomId,request)},
    SetLockState(roomId,request){return this.connection.invoke("SetLockState", roomId,request)},
    StartMatch(roomId,request){return this.connection.invoke("StartMatch", roomId,request)},
    StopMatchCountdown(roomId){return this.connection.invoke("StopMatchCountdown", roomId)},
    AbortMatch(roomId){return this.connection.invoke("AbortMatch", roomId)},
}
module.exports = { COMMANDS, CMDS_SET }
