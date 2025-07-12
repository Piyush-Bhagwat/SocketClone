const http = require("http");
const { Server } = require("socket.io");
const { app } = require("./app");


const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*",
        pingTimeout: 5000, // close inactive sockets in 5s
    }
});

module.exports = { io, server };