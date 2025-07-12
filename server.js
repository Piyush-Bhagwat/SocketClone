const http = require("http");
const { Server } = require("socket.io");
const { app } = require("./config/app");
const { io, server } = require("./config/socket");
const { log } = require("console");
const { rooms, users, words } = require("./data/data");
const { nanoid } = require("nanoid");
const { getPlayer } = require("./utils/gameUtils");
const { gameLoop } = require("./game/gameLoop");
const { Rooms } = require("./services/rooms.service");

const PORT = 3612;


io.on("connection", (socket) => {
    log("connected user", socket.id);

    socket.on("disconnect", () => {
        log("Disconnected user", socket.id);
    });

    socket.on("create_room", async ({ name, maxPlayers, rounds }) => {
        users[socket.id] = name;
        log("User created:", name, socket.id);

        const roomId = nanoid(5).toUpperCase();
        const player = { id: socket.id, score: 0, curScore: 0, role: "admin", name, gameRole: "waiting" }

        rooms[roomId] = {
            admin: socket.id, rounds, maxPlayers, players: [player], state: "waiting",
            curRound: 0, roomId, messages: [{text: `${name} created the room`, type: "system", time: Date.now()}], curRoundRank: []
        };

        log("Room created: ", roomId);
        log("Rooms: ", rooms);
        await socket.join(roomId);
        socket.emit("room_created", { roomId, id: socket.id });
        socket.emit("updatePlayers", rooms[roomId].players);
        socket.emit("update_messages", rooms[roomId].messages)
    })

    socket.on("join_room", async ({ name, roomId }) => {
        users[socket.id] = name;
        log("User created:", name, socket.id);

        const room = rooms[roomId];
        if (!room) {
            socket.emit("room_not_found");
            return;
        }

        room.players.push({ id: socket.id, score: 0, role: "player", name, gameRole: "waiting", curScore: 0 });
        log("user: ", name, "joined:", roomId);

        await socket.join(roomId);

        socket.emit("room_joined", { roomId, id: socket.id })
        socket.emit("updatePlayers", rooms[roomId].players);
        room.messages.push({text: `${name} joined the room`, type: "system", time: Date.now()})
        io.to(roomId).emit("update_messages", room.messages)
        socket.emit("update_messages", room.messages)
        socket.to(roomId).emit("updatePlayers", room.players)
    });

    socket.on("send_message", ({ message, roomId }) => {
        console.log("Hello message: ");
        const room = rooms[roomId];
        if (!room) return;

        const player = getPlayer(socket.id, roomId);

        message.type = 'normal';



        if (room.word) {
            if (message.text.trim().toLowerCase() == room.word.trim().toLowerCase() && player.gameRole != "drawer" && !room.curRoundRank.includes(socket.id)) {
                room.messages.push({ text: `${message.user}  Guessed the word!`, type: "answer", time: message.time, })
                io.to(roomId).emit("update_messages", room.messages);
                socket.emit("correct_guess", room.word);
                room.curRoundRank.push(socket.id);
                return;
            }

            if (player.gameRole == 'drawer') {
                message.type = 'hidden';
            }

            if(room.curRoundRank.includes(socket.id)){
                message.type = "hidden";
            }
        }



        room.messages.push(message);
        io.to(roomId).emit("update_messages", room.messages);

        console.log(room.messages);
    })

    socket.on("start_game", async (roomId) => {
        await gameLoop(roomId)
    })

    socket.on('drawing', ({ from, to, roomId }) => {
        socket.to(roomId).emit("draw_stroke", { from, to })
    })
});


server.listen(PORT, () => {
    console.log('====================================');
    console.log("Server started on:", PORT);
    console.log('====================================');
})