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

        for (const p of room.players) {
            room.curRoundRank = []; // reset rank
            room.word = null;

            // wait(2)
            const drawerSocket = io.sockets.sockets.get(p.id);

            if (!drawerSocket) {
                io.to(roomId).emit("drawer_disconnected", { drawer: p.id });
                continue; // Skip to next player
            }


            const drawer = await selectDrawer(io, room, p);
            if (!room.word) {
                continue;
            }
            const finished = await drawingPhase(io, room, p, drawerSocket);

            if (finished) {
                const roundScores = [];
                room.players.map(p => {
                    const ranks = room.curRoundRank;
                    let score = 0;
                    if (ranks.includes(p.id)) {
                        score = (room.players.length * 100) - (i * 100);
                    }
                    roundScores.push({ id: p.id, score })
                })
                roundScores.sort((a, b) => a.score - b.score);

                roundScores.map((rc, i) => {
                    const player = room.getPlayer(rc.id);
                    player.score += rc.score;
                })
                io.to(roomId).emit("updatePlayers", room.players);
                io.to(roomId).emit("scores", roundScores)
                await wait(drawer, 8); //final wait to see the scores
            }
        }

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
        return false;
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
    drawerSocket.off("disconnect", onDrawerDisconnect);
    drawerSocket.off("canvas_update", onCanvasUpdate);

    const finished = await wait(drawer, 30, (time) => {
        io.to(roomId).emit("tick", time);
    });

    // Clean up listeners
    io.to(roomId).emit("draw_end", { drawer, completed: finished });

    player.gameRole = "player";
    return finished;
}