import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { createServer } from "node:http";
import { Socket as ClientSocket, io as ioClient } from "socket.io-client";
import { type AddressInfo } from "node:net";
import { Server, type Socket as ServerSocket } from "socket.io";
import type {
  ClientToServerEvents,
  RoomResponse,
  ServerToClientEvents,
  SimpleResponse,
} from "../src/types/event.types.js";
import type { SocketData } from "../src/types/main.types.js";
import { setUsername } from "../src/handlers/user/user.js";
import { createRoom } from "../src/handlers/room/create.js";
import { rooms } from "../src/handlers/room/rooms.js";
import { joinRoom } from "../src/handlers/room/join.js";
import { leaveRoom } from "../src/handlers/room/leave.js";

describe("Socket.IO server", () => {
  let io: Server;
  let clientSocketBob: ClientSocket;
  let clientSocketSally: ClientSocket;
  let serverSocketBob: ServerSocket;
  let serverSocketSally: ServerSocket;

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

        let connectCount = 0;
        const checkAllConnected = () => {
          console.log("checkAllConnected called");
          connectCount++;
          if (connectCount === 2) resolve();
        };

        io.on("connection", (socket) => {
          socket.on("user:username", setUsername({ io, socket }));
          socket.on("room:create", createRoom({ io, socket }));
          socket.on("room:join", joinRoom({ io, socket }));
          socket.on("room:leave", leaveRoom({ io, socket }));
        });

        clientSocketBob = ioClient(`http://localhost:${port}`);
        clientSocketBob.on("connect", () => {
          const socket = io.sockets.sockets.get(clientSocketBob.id!);
          if (!socket) throw new Error("Server socket not found for Bob");
          serverSocketBob = socket;
          checkAllConnected();
        });

        clientSocketSally = ioClient(`http://localhost:${port}`);
        clientSocketSally.on("connect", () => {
          const socket = io.sockets.sockets.get(clientSocketSally.id!);
          if (!socket) throw new Error("Server socket not found for Sally");
          serverSocketSally = socket;
          checkAllConnected();
        });
      });
    });
  });

  beforeEach(() => {
    serverSocketBob.data.username = null;
    serverSocketSally.data.username = null;
    serverSocketBob.data.score = null;
    serverSocketSally.data.score = null;
  });

  afterEach(() => {
    for (const roomId of serverSocketBob.rooms) {
      if (roomId !== serverSocketBob.id) {
        serverSocketBob.leave(roomId);
      }
    }

    for (const roomId of serverSocketSally.rooms) {
      if (roomId !== serverSocketSally.id) {
        serverSocketSally.leave(roomId);
      }
    }

    rooms.clear();
  });

  afterAll(() => {
    console.log(rooms);
    io.close();
    clientSocketBob.disconnect();
    clientSocketSally.disconnect();
  });

  // --- BASIC TESTS ---

  it("should connect successfully", () => {
    expect(clientSocketBob.connected).toBe(true);
    expect(clientSocketSally.connected).toBe(true);
  });

  it("should work", () => {
    return new Promise<void>((resolve) => {
      clientSocketBob.on("hello", (arg) => {
        expect(arg).toEqual("world");
        resolve();
      });
      serverSocketBob.emit("hello", "world");
    });
  });

  // --- USER:USERNAME ---

  it("should attach a given username to socket.data", () => {
    return new Promise<void>((resolve) => {
      clientSocketBob.emit("user:username", "JohnnyRevolver", (response: SimpleResponse) => {
        expect(response.success).toBe(true);
        expect(serverSocketBob.data.username).toBe("JohnnyRevolver");
        resolve();
      });
    });
  });

  it("should reject an invalid username for being too short", () => {
    return new Promise<void>((resolve) => {
      clientSocketBob.emit("user:username", "Me", (response: SimpleResponse) => {
        expect(response.success).toBe(false);
        expect(serverSocketBob.data.username).toBeNull();
        resolve();
      });
    });
  });

  it("should reject an invalid username for being too long", () => {
    return new Promise<void>((resolve) => {
      clientSocketBob.emit(
        "user:username",
        "LiterallyThousandsOfBees",
        (response: SimpleResponse) => {
          expect(response.success).toBe(false);
          expect(serverSocketBob.data.username).toBeNull();
          resolve();
        }
      );
    });
  });

  it("should reject an argument that isn't a string", () => {
    return new Promise<void>((resolve) => {
      clientSocketBob.emit("user:username", 7, (response: RoomResponse) => {
        expect(response.success).toBe(false);
        expect(serverSocketBob.data.username).toBeNull();
        resolve();
      });
    });
  });

  // --- ROOM:CREATE ---

  it("should create a room with default config and join the creator to it", () => {
    return new Promise<void>((resolve) => {
      clientSocketBob.emit("room:create", {}, (response: RoomResponse) => {
        expect(response.success).toBe(true);
        if (!response.success) return;

        const { room } = response;

        expect(room.config.isPrivate).toBe(false);
        expect(room.config.maxPlayers).toBe(6);
        expect(room.config.wordSelectionSize).toBe(3);
        expect(room.config.wordChoiceTimer).toBe(10_000);
        expect(room.config.drawTimer).toBe(60_000);
        expect(room.config.numberOfRounds).toBe(5);

        expect(room.players[serverSocketBob.id]).toBeDefined();

        expect(serverSocketBob.rooms.size).toBe(2);
        resolve();
      });
    });
  });

  it("should fill in config when given partial data", () => {
    return new Promise<void>((resolve) => {
      clientSocketBob.emit(
        "room:create",
        { maxPlayers: 10, wordSelectionSize: 5 },
        (response: RoomResponse) => {
          expect(response.success).toBe(true);
          if (!response.success) return;

          const { room } = response;

          expect(room.config.isPrivate).toBe(false);
          expect(room.config.maxPlayers).toBe(10);
          expect(room.config.wordSelectionSize).toBe(5);
          expect(room.config.wordChoiceTimer).toBe(10_000);
          expect(room.config.drawTimer).toBe(60_000);
          expect(room.config.numberOfRounds).toBe(5);

          expect(room.players[serverSocketBob.id]).toBeDefined();

          expect(serverSocketBob.rooms.size).toBe(2);
          resolve();
        }
      );
    });
  });

  it("should accept a full config successfully", () => {
    return new Promise<void>((resolve) => {
      clientSocketBob.emit(
        "room:create",
        {
          isPrivate: true,
          maxPlayers: 9,
          wordSelectionSize: 5,
          wordChoiceTimer: 10 * 1000,
          drawTimer: 60 * 1000,
          numberOfRounds: 10,
        },
        (response: RoomResponse) => {
          expect(response.success).toBe(true);
          if (!response.success) return;

          const { room } = response;

          expect(room.config.isPrivate).toBe(true);
          expect(room.config.maxPlayers).toBe(9);
          expect(room.config.wordSelectionSize).toBe(5);
          expect(room.config.wordChoiceTimer).toBe(10_000);
          expect(room.config.drawTimer).toBe(60_000);
          expect(room.config.numberOfRounds).toBe(10);

          expect(room.players[serverSocketBob.id]).toBeDefined();

          expect(serverSocketBob.rooms.size).toBe(2);
          resolve();
        }
      );
    });
  });

  it("should reject invalid values for config", () => {
    return new Promise<void>((resolve) => {
      clientSocketBob.emit("room:create", { maxPlayers: 15 }, (response: RoomResponse) => {
        expect(response.success).toBe(false);
        expect(serverSocketBob.rooms.size).toBe(1);
        resolve();
      });
    });
  });

  it("should ignore invalid config parameters", () => {
    return new Promise<void>((resolve) => {
      clientSocketBob.emit("room:create", { myFavouriteNumber: 15 }, (response: RoomResponse) => {
        expect(response.success).toBe(true);
        if (!response.success) return;

        const { room } = response;

        expect(room.config.isPrivate).toBe(false);
        expect(room.config.maxPlayers).toBe(6);
        expect(room.config.wordSelectionSize).toBe(3);
        expect(room.config.wordChoiceTimer).toBe(10_000);
        expect(room.config.drawTimer).toBe(60_000);
        expect(room.config.numberOfRounds).toBe(5);

        expect(room.players[serverSocketBob.id]).toBeDefined();

        expect(serverSocketBob.rooms.size).toBe(2);
        resolve();
      });
    });
  });

  // --- ROOM:JOIN ---

  it("should join a user to a room", () => {
    return new Promise<void>((resolve) => {
      clientSocketBob.emit("room:create", {}, (response: RoomResponse) => {
        expect(response.success).toBe(true);
        if (!response.success) {
          console.log("room creation failed");
          return;
        }

        const { room } = response;

        clientSocketSally.emit("room:join", room.id, (response: RoomResponse) => {
          expect(response.success).toBe(true);
          if (!response.success) {
            return;
          }

          const { room } = response;

          expect(room.players[serverSocketSally.id]).toBeDefined();
          resolve();
        });
      });
    });
  });

  it("should reject an invalid room code", () => {
    return new Promise<void>((resolve) => {
      clientSocketSally.emit("room:join", "not a uuid", (response: RoomResponse) => {
        expect(response.success).toBe(false);
        if (response.success !== false) return;

        expect(response.error).toBe("room ID is invalid");
        resolve();
      });
    });
  });

  it("should reject a room that doesn't exist", () => {
    return new Promise<void>((resolve) => {
      clientSocketSally.emit(
        "room:join",
        "9ea8adb9-62b9-444f-8f40-8cfa079aceb7",
        (response: RoomResponse) => {
          expect(response.success).toBe(false);
          if (response.success !== false) return;

          expect(response.error).toBe("room does not exist");
          resolve();
        }
      );
    });
  });

  // --- ROOM:LEAVE ---

  it("should remove a user from a room", () => {
    return new Promise<void>((resolve) => {
      clientSocketBob.emit("room:create", {}, (response: RoomResponse) => {
        expect(response.success).toBe(true);
        if (!response.success) return;

        const roomId = response.room.id;
        const serverRoom = rooms.get(roomId);
        expect(serverRoom?.players.has(serverSocketBob.id)).toBe(true);

        clientSocketBob.emit("room:leave");

        setTimeout(() => {
          expect(serverRoom?.players.has(serverSocketBob.id)).toBe(false);
          expect(serverSocketBob.rooms.size).toBe(1);
          resolve();
        }, 50);
      });
    });
  });
});
