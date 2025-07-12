const { io } = require("../config/socket");
const { rooms } = require("../data/data");
const { getWordsOptions, getPlayer } = require("../utils/gameUtils");

async function gameLoop(roomId) {
    
    const room = rooms[roomId];
    if (room.players.length == 1) {
        // return io.to(roomId).emit("not_enough_players");
    }
    io.to(roomId).emit("game_started", { round: 0, state: "started" });
    room.state = "playing";

    for (let i = 1; i <= room.rounds; i++) {
        io.to(roomId).emit("round_start", { round: i, state: "started" });
        room.curRound = i;

        for (const p of room.players) {
            io.to(roomId).emit("clean_canvas");
            room.curRoundRank = [];
            const drawer = p.id;
            const drawerSocket = io.sockets.sockets.get(drawer);
            p.gameRole = "drawer";

            if (!drawerSocket) {
                io.to(roomId).emit("drawer_disconnected", { drawer });
                continue; // Skip if drawer disconnected
            }

            // Clean previous listeners to avoid stacking
            drawerSocket.removeAllListeners("canvas_update");
            drawerSocket.removeAllListeners("disconnect");

            const onCanvasUpdate = (data) => {
                drawerSocket.to(roomId).emit("update_data", data);
            };

            const onDrawerDisconnect = () => {
                drawerSocket.off("canvas_update", onCanvasUpdate);
                io.to(roomId).emit("drawer_disconnected", { drawer });
            };

            drawerSocket.once("disconnect", onDrawerDisconnect);

            await wait(drawer, 2); //inital pause to display round screen
            io.to(roomId).emit("drawer_selected", { drawer });


            // Word selection

            const wordsOptions = getWordsOptions();

            io.to(drawer).emit("choose_word", wordsOptions);

            const word = await waitForWord(drawer, 10, (time) => {
                io.to(roomId).emit("tick", time);
            });

            if (!word) {
                io.to(roomId).emit("drawer_skipped", { drawer });
                continue;
            }
            room.word = word;
            io.to(roomId).emit("word_selected", word);

            // Drawing phase
            io.to(roomId).emit("draw_start", { drawer });

            drawerSocket.on("canvas_update", onCanvasUpdate);

            const finished = await wait(drawer, 30, (time) => {
                io.to(roomId).emit("tick", time);
            });

            // Clean up listeners
            drawerSocket.off("canvas_update", onCanvasUpdate);
            drawerSocket.off("disconnect", onDrawerDisconnect);

            p.gameRole = "player";

            io.to(roomId).emit("draw_end", { drawer, completed: finished });

            if (finished) {
                const roundScores = [];
                room.players.map(p => {
                    const ranks = room.curRoundRank;
                    let score = 0;
                    if (ranks.includes(p.id)) {
                        score = (room.players.length * 100) - (i * 100);
                    }
                    roundScores.push({ id: p.id, score})
                })
                roundScores.sort((a, b) => a.score - b.score);
               
                roundScores.map((p, i) => {
                    const player = getPlayer(p.id, roomId);
                    player.score += p.score;
                })
                io.to(roomId).emit("updatePlayers", room.players);
                io.to(roomId).emit("scores", roundScores)
                await wait(drawer, 8);
            }
        }
    }
}

async function waitForWord(drawer, seconds, tickCallback) {
    return new Promise((resolve) => {
        const drawerSocket = io.sockets.sockets.get(drawer);
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
        drawerSocket.once("disconnect", onDisconnect);
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

module.exports = { gameLoop }