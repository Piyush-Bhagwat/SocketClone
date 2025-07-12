const { words, rooms } = require("../data/data")
function getWordsOptions() {
    const ar = [];

    for (let i = 0; i < 3; i++) {
        const idx = Math.round(Math.random() * words.length)
        ar.push(words[idx]);
    }

    return ar;
}

function getPlayer(socketId, roomId) {
    const room = rooms[roomId];
    if(!room) return;

    player = room.players.find((p) => p.id == socketId);

    return player;
}

module.exports = {getWordsOptions, getPlayer}