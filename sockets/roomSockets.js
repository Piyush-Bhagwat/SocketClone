const { Users } = require("../services/player.service");
const { Rooms } = require("../services/rooms.service");

function handleRoomSockets(io, socket) {
    socket.on("create_room", async ({ name, maxPlayers, rounds }) => {
        const room = Rooms.createRoom(socket.id, name, maxPlayers, rounds);

        console.log("Room created: ", room.roomId);
        await socket.join(room.roomId);
        socket.emit("room_created", { roomId: room.roomId, id: socket.id });
        socket.emit("updatePlayers", room.players);
        socket.emit("update_messages", room.messages)
    })

    socket.on("join_room", async ({ name, roomId }) => {

        const room = Rooms.joinRoom(socket.id, name, roomId);
        console.log(name, roomId);
    
        if (!room) {
            socket.emit("room_full");
            console.log("cant join room", roomId)
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

    socket.on("disconnect", () => {
        try{
            const user = Users.getUser(socket.id);
            const room = Rooms.getRoom(user.roomId);
    
            if (room) {
                Rooms.removePlayer(socket.id, room.roomId);
                io.to(room.roomId).emit("updatePlayers", room.players);
                room.addSystemMessage(`${user.name} left the room!`);
                io.to(room.roomId).emit("update_messages", room.messages);
            }

            Users.removeUser(socket.id);
        }catch(e){
            console.log("Cant disconnecct", e);
        }
    });

}

module.exports = {handleRoomSockets}