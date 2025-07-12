// /server/models/Player.js
class Player {
    constructor(socketId, name, role = "player") {
        this.id = socketId;           
        this.name = name;             
        this.role = role;             
        this.score = 0;           
        this.gameRole = "waiting";    
    }
}

module.exports = Player;
