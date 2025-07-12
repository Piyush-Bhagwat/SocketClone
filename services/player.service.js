class Users {
    constructor() {
        if (Users._instance) {
            return Users._instance;
        }
        this.users = [];
        Users._instance = this;
    }

    createUser(socketId, roomId, name) {
        this.users.push({ id: socketId, roomId, name });
    }

    getUser(socketId) {
        return this.users.find(u => u.id === socketId);
    }

    removeUser(socketId) {
        this.users = this.users.filter(u => u.id !== socketId);
    }
}

module.exports = {Users: new Users()};