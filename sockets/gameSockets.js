const { Rooms } = require("../services/rooms.service");
const { getWordsOptions } = require("../utils/gameUtils");

function handleGameSockets(io, socket) {
    socket.on("start_game", async (roomId) => {
        const room = Rooms.getRoom(roomId);

        room.startGame();
        io.to(roomId).emit("game_started", { round: 1 });

        runGameLoop(io, socket, room);
    })
}

async function runGameLoop(io, socket, room) {
    const roomId = room.roomId;
    for (let i = 1; i <= room.rounds; i++) {
        io.to(roomId).emit("round_start", { round: i, state: "started" });
        room.curRound = i;

        for (const p of room.players) {
            room.curRoundRank = []; // reset rank
            room.word = null;
            io.to(room.roomId).emit("clean_canvas");

            await wait(p.id, 2)
            const drawerSocket = io.sockets.sockets.get(p.id);

            if (!drawerSocket) {
                io.to(roomId).emit("drawer_disconnected", { drawer: p.id });
                continue; // Skip to next player
            }


            await selectDrawer(io, room, p);
            if (!room.word) {
                continue;
            }

            const finished = await drawingPhase(io, room, p, drawerSocket);

            if (finished) {
                await broadcastScores()
                await wait(p.id, 8); //final wait to see the scores

            }

            io.to(roomId).emit("turn_over");
        }
        io.to(roomId).emit("round_over");
    }
    io.to(roomId).emit("game_over");
    room.resetGame();
}

/**
 * Selects drawer and choose a word
 * @param {*} io 
 * @param {*} room 
 * @param {*} player 
 */
async function selectDrawer(io, room, player) {
    player.gameRole = 'drawer';
    const drawer = player.id
    io.to(room.roomId).emit("drawer_selected", drawer);


    const wordsOptions = getWordsOptions();

    io.to(drawer).emit("choose_word", wordsOptions);

    const word = await waitForWord(drawer, 10, (time) => {
        io.to(room.roomId).emit("tick", time);
    });

    if (!word) {
        io.to(room.roomId).emit("drawer_skipped", { drawer });
    }
    room.word = word;
    io.to(room.roomId).emit("word_selected", word);
}

async function drawingPhase(io, room, drawer, drawerSocket) {
    const roomId = room.roomId;

    //functions
    const onCanvasUpdate = (data) => {
        drawerSocket.to(roomId).emit("update_data", data);
    };

    const onDrawerDisconnect = () => {
        drawerSocket.off("canvas_update", onCanvasUpdate);
        io.to(roomId).emit("drawer_disconnected", drawer.id);
    };

    //actual thing
    io.to(roomId).emit("draw_start", drawer.id);

    drawerSocket.on("canvas_update", onCanvasUpdate);
    drawerSocket.on("disconnect", onDrawerDisconnect);
    
    const finished = await wait(drawer, 30, (time) => {
        io.to(roomId).emit("tick", time);
    });


    drawerSocket.off("disconnect", onDrawerDisconnect);
    drawerSocket.off("canvas_update", onCanvasUpdate);

    // Clean up listeners
    io.to(roomId).emit("draw_end", { drawer, completed: finished });

    drawer.gameRole = "player";
    return finished;
}

async function broadcastScores(io, room) {
    const round = room.curRound;
    const roundScores = [];
    room.players.map(p => {
        const ranks = room.curRoundRank;
        let score = 0;
        if (ranks.includes(p.id)) {
            score = (room.players.length * 100) - (round * 100);
        }
        roundScores.push({ id: p.id, score })
    })
    roundScores.sort((a, b) => a.score - b.score);

    roundScores.map((rc, i) => {
        const player = room.getPlayer(rc.id);
        player.score += rc.score;
    })
    io.to(room.roomId).emit("updatePlayers", room.players);
    io.to(room.roomId).emit("scores", roundScores)
}


async function waitForWord(drawer, seconds, tickCallback) {
    return new Promise((resolve) => {
        const drawerSocket = io.sockets.sockets.get(drawer);
        drawerSocket.once("disconnect", onDisconnect);

        if (!drawerSocket) {
            resolve(null);
            return;
        }

        let remainingTime = seconds;
        tickCallback(remainingTime);

        const interval = setInterval(() => {
            remainingTime -= 1;
            tickCallback(remainingTime);
        }, 1000);

        const timeout = setTimeout(() => {
            clearInterval(interval);
            resolve(null);
        }, seconds * 1000);

        const onWordChosen = (word) => {
            clearInterval(interval);
            clearTimeout(timeout);
            resolve(word);
        };

        const onDisconnect = () => {
            clearInterval(interval);
            clearTimeout(timeout);
            resolve(null);
        };

        drawerSocket.once("word_chosen", onWordChosen);
    });
}

async function wait(drawer, seconds, tickCallback) {
    return new Promise((resolve) => {
        const drawerSocket = io.sockets.sockets.get(drawer);
        if (!drawerSocket) {
            resolve(false); // drawer disconnected
            return;
        }

        let remainingTime = seconds;

        if (tickCallback != undefined) {

            tickCallback(remainingTime);
        }

        const interval = setInterval(() => {
            remainingTime -= 1;
            if (tickCallback) {
                tickCallback(remainingTime);
            }
        }, 1000);

        const timeout = setTimeout(() => {
            clearInterval(interval);
            resolve(true); // completed normally
        }, seconds * 1000);

        const onDisconnect = () => {
            clearInterval(interval);
            clearTimeout(timeout);
            resolve(false); // drawer disconnected
        };

        drawerSocket.once("disconnect", onDisconnect);
    });
}

module.exports = {handleGameSockets}