class Room {

    constructor(roomId, admin, maxPlayers, rounds) {
        this.roomId = roomId;                  // Unique room ID
        this.admin = admin.id;                  // Socket ID of admin
        this.rounds = rounds;
        this.maxPlayers = maxPlayers;
        this.players = [];
        this.state = "waiting";
        this.curRound = 0;
        this.messages = [];
        this.curRoundRank = [];
        this.word = null;

        this.addPlayer(admin);
        this.addSystemMessage(`${admin.name} created the room`);
    }

    addPlayer(player) {
        if (this.players.length >= this.maxPlayers) {
            return false;
        }

        this.players.push(player);
        return true
    }

    getPlayer(socketId) {
        const player = this.players.find(p => p.id === socketId);
        return player
    }

    removePlayer(socketId) {
        this.players = this.players.filter(p => p.id !== socketId)

        if (this.admin === socketId && this.players.length > 0) {
            this.admin = this.players[0].id; // make first player the new admin
        }

        if (this.players.length === 0) {
            return false;
        }
        return this.players
    }

    startGame() {
        this.curRound = 1;
        this.state = "playing"
    }

    resetGame() {
        this.curRound = 0;
        this.state = "waiting";
        this.word = null;
        this.curRoundRank = [];

        this.players.map(p => {
            p.score = 0
            p.gameState = 'waiting'
        });
    }

    /**
     * @param {*} text 
     */
    addSystemMessage(text) {
        this.messages.push({
            text,
            type: "system",
            time: Date.now(),
        });
    }


    /**
     * 
     * @param {*} text 
     * @param {*} user 
     * @returns guessed bool
     */
    addMessage(text, socketId) {

        const player = this.getPlayer(socketId);
        let guessed = false;
        let type = 'normal';

        if (this.word) {
            if (player.gameRole == 'drawer') {
                type = 'hidden';
            }

            if (this.curRoundRank.includes(socketId)) {
                type = "hidden";
            }

            if (message.text.trim().toLowerCase() == this.word.trim().toLowerCase() && player.gameRole != "drawer" && !this.curRoundRank.includes(socketId)) {
                this.curRoundRank.push(socketId);
                guessed = true;
            }
        }
        
        this.messages.push({
            text: guessed ? `${player.name} guessed the word` : text,
            user: player.name,
            time: Date.now(),
            type  
        })
        
        return guessed
    }
}

module.exports = Room