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
const { handleRoomSockets } = require("./sockets/roomSockets");
const { handleGameSockets } = require("./sockets/gameSockets");

const PORT = 3612;


io.on("connection", (socket) => {
    log("connected user", socket.id);

    handleRoomSockets(io, socket);
    handleGameSockets(io, socket);

    socket.on("disconnect", () => {
        log("User disconnected:", socket.id);
    });

});

app.get("/wake-server", (req, res)=>{
    console.log("Server Pinged");
    
    res.send("OK");
})


server.listen(PORT, () => {
    console.log('====================================');
    console.log("Server started on:", PORT);
    console.log('====================================');
})