import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { createServer } from "node:http";
import { Socket as ClientSocket, io as ioClient } from "socket.io-client";
import {} from "node:net";
import { Server } from "socket.io";
import { setUsername } from "../src/handlers/user.js";
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
                });
                clientSocket.on("connect", resolve);
            });
        });
    });
    beforeEach(() => {
        serverSocket.data.username = null;
    });
    afterAll(() => {
        io.close();
        clientSocket.disconnect();
    });
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
    it("should attach a given username to socket.data", () => {
        return new Promise((resolve) => {
            clientSocket.emit("user:username", "JohnnyRevolver", (response) => {
                console.log(response);
                expect(serverSocket.data.username).toBe("JohnnyRevolver");
                resolve();
            });
        });
    });
    it("should reject an invalid username for being too short", () => {
        return new Promise((resolve) => {
            clientSocket.emit("user:username", "Me", (response) => {
                console.log(response);
                expect(serverSocket.data.username).toBeNull();
                resolve();
            });
        });
    });
    it("should reject an invalid username for being too long", () => {
        return new Promise((resolve) => {
            clientSocket.emit("user:username", "LiterallyThousandsOfBees", (response) => {
                console.log(response);
                expect(serverSocket.data.username).toBeNull();
                resolve();
            });
        });
    });
    it("should reject an argument that isn't a string", () => {
        return new Promise((resolve) => {
            clientSocket.emit("user:username", 7, (response) => {
                console.log(response);
                expect(serverSocket.data.username).toBeNull();
                resolve();
            });
        });
    });
});
//# sourceMappingURL=integration.test.js.map