const { nanoid } = require("nanoid");
const Player = require("../model/player");
const Room = require("../model/room");

/**
 * Collection of all the rooms and functions to handle them
 */
class Rooms {
    constructor() {
        if (Rooms._instance) {
            return Rooms._instance;
        }
        this.rooms = {};

        Rooms._instance = this;
    }

    /**
     * Creates a new Room
     * @param {*} socketId 
     * @param {*} name 
     * @param {*} maxPlayers 
     * @param {*} rounds 
     * @returns {*} room
     */
    async createRoom(socketId, name, maxPlayers, rounds) {
        users[socketId] = name;
        log("User created:", name, socketId);

        const roomId = nanoid(5).toUpperCase();

        const admin = new Player(socketId, name, "admin");
        this.rooms[roomId] = new Room(roomId, admin, maxPlayers, rounds);

        log("Room created: ", roomId);
        log("Rooms: ", this.rooms);
        return this.rooms[roomId];
    }

    /**
     * Join new player in room
     * @param {*} socketId 
     * @param {*} name 
     * @param {*} roomId 
     * @returns {*} room | false
     */
    async joinRoom(socketId, name, roomId) {
        users[socketId] = name;
        log("User created:", name, socketId);

        const room = this.rooms[roomId];
        if (!room) {
            return false;
        }

        const player = new Player(socketId, name, "player")
        const added = room.addPlayer(player);
        if (!added) {
            return false;
        }

        log("player: ", name, "joined:", roomId);
        return room;
    }

    getRoom(roomId) {
        return this.rooms[roomId];
    }

    /**
    * remove player from the room
    * @param {*} socketId 
    * @param {*} roomId 
    */
    removePlayer(socketId, roomId) {
        const room = this.rooms[roomId];
        if (!room) return;
        const remainingPlayers = room.removePlayer(socketId);

        if (!remainingPlayers) {
            delete this.rooms[roomId];
            return null;
        }
        return remainingPlayers;
    }
}

module.exports = { Rooms: new Rooms() }