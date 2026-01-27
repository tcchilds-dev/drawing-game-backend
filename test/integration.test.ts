import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer } from "node:http";
import { io as ioClient, type Socket as ClientSocket } from "socket.io-client";
import { type AddressInfo } from "node:net";
import { Server, type Socket as ServerSocket } from "socket.io";
import type { ClientToServerEvents, ServerToClientEvents } from "../src/types/event.types.js";
import type { SocketData } from "../src/types/main.types.js";

describe("Socket.IO server", () => {
  let io: Server, serverSocket: ServerSocket, clientSocket: ClientSocket;

  beforeAll(() => {
    return new Promise<void>((resolve) => {
      const httpServer = createServer();
      io = new Server<ClientToServerEvents, ServerToClientEvents, SocketData>(httpServer);
      httpServer.listen(() => {
        const port = (httpServer.address() as AddressInfo).port;
        clientSocket = ioClient(`http://localhost:${port}`);
        io.on("connection", (socket) => {
          serverSocket = socket;
        });
        clientSocket.on("connect", resolve);
      });
    });
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
});
