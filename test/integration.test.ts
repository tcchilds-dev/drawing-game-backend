import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { createServer } from "node:http";
import { Socket as ClientSocket, io as ioClient } from "socket.io-client";
import { type AddressInfo } from "node:net";
import { Server, type Socket as ServerSocket } from "socket.io";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
  SimpleCallback,
} from "../src/types/event.types.js";
import type { SocketData } from "../src/types/main.types.js";
import { setUsername } from "../src/handlers/user.js";

describe("Socket.IO server", () => {
  let io: Server, serverSocket: ServerSocket, clientSocket: ClientSocket;

  beforeAll(() => {
    return new Promise<void>((resolve) => {
      const httpServer = createServer();
      io = new Server<
        ClientToServerEvents,
        ServerToClientEvents,
        Record<string, never>,
        SocketData
      >(httpServer);
      httpServer.listen(() => {
        const port = (httpServer.address() as AddressInfo).port;
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
    return new Promise<void>((resolve) => {
      clientSocket.on("hello", (arg) => {
        expect(arg).toEqual("world");
        resolve();
      });
      serverSocket.emit("hello", "world");
    });
  });

  it("should attach a given username to socket.data", () => {
    return new Promise<void>((resolve) => {
      clientSocket.emit("user:username", "JohnnyRevolver", (response: SimpleCallback) => {
        console.log(response);
        expect(serverSocket.data.username).toBe("JohnnyRevolver");
        resolve();
      });
    });
  });

  it("should reject an invalid username for being too short", () => {
    return new Promise<void>((resolve) => {
      clientSocket.emit("user:username", "Me", (response: SimpleCallback) => {
        console.log(response);
        expect(serverSocket.data.username).toBeNull();
        resolve();
      });
    });
  });

  it("should reject an invalid username for being too long", () => {
    return new Promise<void>((resolve) => {
      clientSocket.emit("user:username", "LiterallyThousandsOfBees", (response: SimpleCallback) => {
        console.log(response);
        expect(serverSocket.data.username).toBeNull();
        resolve();
      });
    });
  });

  it("should reject an argument that isn't a string", () => {
    return new Promise<void>((resolve) => {
      clientSocket.emit("user:username", 7, (response: SimpleCallback) => {
        console.log(response);
        expect(serverSocket.data.username).toBeNull();
        resolve();
      });
    });
  });
});
