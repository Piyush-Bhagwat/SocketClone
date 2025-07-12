const { Rooms } = require("../services/rooms.service");

function handleRoomSockets(io, socket) {
    socket.on("create_room", async ({ name, maxPlayers, rounds }) => {
        const room = Rooms.createRoom(socket.id, name, maxPlayers, rounds);

        log("Room created: ", room.roomId);
        log("Rooms: ", Rooms.rooms);
        await socket.join(room.roomId);
        socket.emit("room_created", { roomId: room.roomId, id: socket.id });
        socket.emit("updatePlayers", room.players);
        socket.emit("update_messages", room.messages)
    })

    socket.on("join_room", async ({ name, roomId }) => {
        //TODO: add users to global array

        const room = Rooms.joinRoom(socket.id, name, roomId);

        if (!room) {
            socket.emit("room_full");
            return;
        }

        await socket.join(roomId);

        socket.emit("room_joined", { roomId, id: socket.id })
        socket.emit("updatePlayers", room.players);
        room.addSystemMessage(`${name} joined the room`)
        io.to(roomId).emit("update_messages", room.messages)
        socket.emit("update_messages", room.messages)
        socket.to(roomId).emit("updatePlayers", room.players)
    });

    socket.on("send_message", ({ message, roomId }) => {
        const room = Rooms.getRoom(roomId);
        if (!room) return;

        message.type = 'normal';

        const gussed = room.addMessage(message.text, socket.id);
        if (gussed) {
            socket.emit("correct_guess", room.word);
            io.to(roomId).emit("update_messages", room.messages);
            return;
        }
        io.to(roomId).emit("update_messages", room.messages);
    })

}