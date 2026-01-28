import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { createServer } from "node:http";
import { Socket as ClientSocket, io as ioClient } from "socket.io-client";
import {} from "node:net";
import { Server } from "socket.io";
import { setUsername } from "../src/handlers/user/user.js";
import { createRoom } from "../src/handlers/room/create.js";
import { rooms } from "../src/handlers/room/rooms.js";
describe("Socket.IO server", () => {
    let io, serverSocket, clientSocket;
    beforeAll(() => {
        return new Promise((resolve) => {
            const httpServer = createServer();
            io = new Server(httpServer);
            httpServer.listen(() => {
                const port = httpServer.address().port;
                clientSocket = ioClient(`http://localhost:${port}`);
                io.on("connection", (socket) => {
                    serverSocket = socket;
                    serverSocket.on("user:username", setUsername({ io, socket }));
                    serverSocket.on("room:create", createRoom({ io, socket }));
                });
                clientSocket.on("connect", resolve);
            });
        });
    });
    beforeEach(() => {
        serverSocket.data.username = null;
        serverSocket.data.score = null;
    });
    afterEach(() => {
        for (const roomId of serverSocket.rooms) {
            if (roomId !== serverSocket.id) {
                serverSocket.leave(roomId);
            }
        }
        rooms.clear();
    });
    afterAll(() => {
        console.log(rooms);
        io.close();
        clientSocket.disconnect();
    });
    // --- BASIC TESTS ---
    it("should connect successfully", () => {
        expect(clientSocket.connected).toBe(true);
    });
    it("should work", () => {
        return new Promise((resolve) => {
            clientSocket.on("hello", (arg) => {
                expect(arg).toEqual("world");
                resolve();
            });
            serverSocket.emit("hello", "world");
        });
    });
    // --- USER:USERNAME ---
    it("should attach a given username to socket.data", () => {
        return new Promise((resolve) => {
            clientSocket.emit("user:username", "JohnnyRevolver", (response) => {
                expect(response.success).toBe(true);
                expect(serverSocket.data.username).toBe("JohnnyRevolver");
                resolve();
            });
        });
    });
    it("should reject an invalid username for being too short", () => {
        return new Promise((resolve) => {
            clientSocket.emit("user:username", "Me", (response) => {
                expect(response.success).toBe(false);
                expect(serverSocket.data.username).toBeNull();
                resolve();
            });
        });
    });
    it("should reject an invalid username for being too long", () => {
        return new Promise((resolve) => {
            clientSocket.emit("user:username", "LiterallyThousandsOfBees", (response) => {
                expect(response.success).toBe(false);
                expect(serverSocket.data.username).toBeNull();
                resolve();
            });
        });
    });
    it("should reject an argument that isn't a string", () => {
        return new Promise((resolve) => {
            clientSocket.emit("user:username", 7, (response) => {
                expect(response.success).toBe(false);
                expect(serverSocket.data.username).toBeNull();
                resolve();
            });
        });
    });
    // --- ROOM:CREATE ---
    it("should create a room with default config and join the creator to it", () => {
        return new Promise((resolve) => {
            clientSocket.emit("room:create", {}, (response) => {
                expect(response.success).toBe(true);
                if (!response.success)
                    return;
                const { room } = response;
                expect(room.config.isPrivate).toBe(false);
                expect(room.config.maxPlayers).toBe(6);
                expect(room.config.wordSelectionSize).toBe(3);
                expect(room.config.wordChoiceTimer).toBe(10_000);
                expect(room.config.drawTimer).toBe(60_000);
                expect(room.config.numberOfRounds).toBe(5);
                expect(room.players.length).toBe(1);
                expect(serverSocket.rooms.size).toBe(2);
                serverSocket.leave(room.id);
                resolve();
            });
        });
    });
    it("should fill in config when given partial data", () => {
        return new Promise((resolve) => {
            clientSocket.emit("room:create", { maxPlayers: 10, wordSelectionSize: 5 }, (response) => {
                expect(response.success).toBe(true);
                if (!response.success)
                    return;
                const { room } = response;
                expect(room.config.isPrivate).toBe(false);
                expect(room.config.maxPlayers).toBe(10);
                expect(room.config.wordSelectionSize).toBe(5);
                expect(room.config.wordChoiceTimer).toBe(10_000);
                expect(room.config.drawTimer).toBe(60_000);
                expect(room.config.numberOfRounds).toBe(5);
                expect(room.players.length).toBe(1);
                expect(serverSocket.rooms.size).toBe(2);
                serverSocket.leave(room.id);
                resolve();
            });
        });
    });
    it("should accept a full config successfully", () => {
        return new Promise((resolve) => {
            clientSocket.emit("room:create", {
                isPrivate: true,
                maxPlayers: 9,
                wordSelectionSize: 5,
                wordChoiceTimer: 10 * 1000,
                drawTimer: 60 * 1000,
                numberOfRounds: 10,
            }, (response) => {
                expect(response.success).toBe(true);
                if (!response.success)
                    return;
                const { room } = response;
                expect(room.config.isPrivate).toBe(true);
                expect(room.config.maxPlayers).toBe(9);
                expect(room.config.wordSelectionSize).toBe(5);
                expect(room.config.wordChoiceTimer).toBe(10_000);
                expect(room.config.drawTimer).toBe(60_000);
                expect(room.config.numberOfRounds).toBe(10);
                expect(room.players.length).toBe(1);
                expect(serverSocket.rooms.size).toBe(2);
                serverSocket.leave(room.id);
                resolve();
            });
        });
    });
    it("should reject invalid values for config", () => {
        return new Promise((resolve) => {
            clientSocket.emit("room:create", { maxPlayers: 15 }, (response) => {
                expect(response.success).toBe(false);
                expect(serverSocket.rooms.size).toBe(1);
                resolve();
            });
        });
    });
    it("should ignore invalid config parameters", () => {
        return new Promise((resolve) => {
            clientSocket.emit("room:create", { myFavouriteNumber: 15 }, (response) => {
                expect(response.success).toBe(true);
                if (!response.success)
                    return;
                const { room } = response;
                expect(room.config.isPrivate).toBe(false);
                expect(room.config.maxPlayers).toBe(6);
                expect(room.config.wordSelectionSize).toBe(3);
                expect(room.config.wordChoiceTimer).toBe(10_000);
                expect(room.config.drawTimer).toBe(60_000);
                expect(room.config.numberOfRounds).toBe(5);
                expect(room.players.length).toBe(1);
                expect(serverSocket.rooms.size).toBe(2);
                serverSocket.leave(room.id);
                resolve();
            });
        });
    });
});
//# sourceMappingURL=integration.test.js.map