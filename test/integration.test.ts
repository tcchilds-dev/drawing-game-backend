import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { createServer } from "node:http";
import { Socket as ClientSocket, io as ioClient } from "socket.io-client";
import { type AddressInfo } from "node:net";
import { Server, type Socket as ServerSocket } from "socket.io";
import { randomUUID } from "node:crypto";
import type {
  ClientToServerEvents,
  RoomResponse,
  ServerToClientEvents,
  SimpleResponse,
  WordResponse,
} from "../src/types/event.types.js";
import type { GamePhase, Guessage, SocketData } from "../src/types/main.types.js";
import { setUsername } from "../src/user/user.js";
import { createRoom } from "../src/room/create.js";
import { rooms } from "../src/room/rooms.js";
import { joinRoom } from "../src/room/join.js";
import { leaveRoom } from "../src/room/leave.js";
import { startGame } from "../src/game/start.js";
import { handleGuessage } from "../src/game/guessage.js";
import { chooseWord } from "../src/game/word.js";
import { gameManager } from "../src/game/GameManager.js";

describe("Socket.IO server", () => {
  let io: Server;
  let clientSocketBob: ClientSocket;
  let clientSocketSally: ClientSocket;
  let serverSocketBob: ServerSocket;
  let serverSocketSally: ServerSocket;
  let serverPort: number;

  // Persistent player IDs for testing
  const bobPlayerId = randomUUID();
  const sallyPlayerId = randomUUID();

  beforeAll(() => {
    return new Promise<void>((resolve) => {
      const httpServer = createServer();
      io = new Server<
        ClientToServerEvents,
        ServerToClientEvents,
        Record<string, never>,
        SocketData
      >(httpServer);

      gameManager.setIO(io);

      httpServer.listen(() => {
        const port = (httpServer.address() as AddressInfo).port;
        serverPort = port;

        let connectCount = 0;
        const checkAllConnected = () => {
          connectCount++;
          if (connectCount === 2) resolve();
        };

        io.on("connection", (socket) => {
          socket.on("user:username", setUsername({ io, socket }));

          socket.on("room:create", createRoom({ io, socket }));
          socket.on("room:join", joinRoom({ io, socket }));
          socket.on("room:leave", leaveRoom({ io, socket }));

          socket.on("game:start", startGame({ io, socket }));
          socket.on("chat:guessage", handleGuessage({ io, socket }));
          socket.on("word:choice", chooseWord({ io, socket }));
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
    serverSocketBob.data.playerId = null;
    serverSocketBob.data.score = null;
    serverSocketSally.data.username = null;
    serverSocketSally.data.playerId = null;
    serverSocketSally.data.score = null;
  });

  afterEach(() => {
    clientSocketBob.removeAllListeners();
    clientSocketSally.removeAllListeners();

    clientSocketBob.on("connect", () => {});
    clientSocketSally.on("connect", () => {});

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

    gameManager.clearAllGames();
    rooms.clear();
  });

  afterAll(() => {
    io.close();
    clientSocketBob.disconnect();
    clientSocketSally.disconnect();
  });

  // Helper to set up a user with username and playerId
  function setupUser(
    clientSocket: ClientSocket,
    username: string,
    playerId: string
  ): Promise<SimpleResponse> {
    return new Promise((resolve) => {
      clientSocket.emit("user:username", { username, playerId }, (response: SimpleResponse) => {
        resolve(response);
      });
    });
  }

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

  it("should attach a given username and playerId to socket.data", () => {
    return new Promise<void>((resolve) => {
      const playerId = randomUUID();
      clientSocketBob.emit(
        "user:username",
        { username: "JohnnyRevolver", playerId },
        (response: SimpleResponse) => {
          expect(response.success).toBe(true);
          expect(serverSocketBob.data.username).toBe("JohnnyRevolver");
          expect(serverSocketBob.data.playerId).toBe(playerId);
          resolve();
        }
      );
    });
  });

  it("should reject an invalid username for being too short", () => {
    return new Promise<void>((resolve) => {
      clientSocketBob.emit(
        "user:username",
        { username: "Me", playerId: randomUUID() },
        (response: SimpleResponse) => {
          expect(response.success).toBe(false);
          expect(serverSocketBob.data.username).toBeNull();
          resolve();
        }
      );
    });
  });

  it("should reject an invalid username for being too long", () => {
    return new Promise<void>((resolve) => {
      clientSocketBob.emit(
        "user:username",
        { username: "LiterallyThousandsOfBees", playerId: randomUUID() },
        (response: SimpleResponse) => {
          expect(response.success).toBe(false);
          expect(serverSocketBob.data.username).toBeNull();
          resolve();
        }
      );
    });
  });

  it("should reject an invalid playerId", () => {
    return new Promise<void>((resolve) => {
      clientSocketBob.emit(
        "user:username",
        { username: "ValidName", playerId: "not-a-uuid" },
        (response: SimpleResponse) => {
          expect(response.success).toBe(false);
          expect(serverSocketBob.data.playerId).toBeNull();
          resolve();
        }
      );
    });
  });

  it("should reject a payload that isn't an object", () => {
    return new Promise<void>((resolve) => {
      clientSocketBob.emit("user:username", "JustAString", (response: SimpleResponse) => {
        expect(response.success).toBe(false);
        expect(serverSocketBob.data.username).toBeNull();
        resolve();
      });
    });
  });

  // --- ROOM:CREATE ---

  it("should create a room with default config and join the creator to it", async () => {
    await setupUser(clientSocketBob, "Bob", bobPlayerId);

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
        expect(room.phase).toBe("lobby");

        expect(room.players[serverSocketBob.id]).toBeDefined();
        expect(room.players[serverSocketBob.id].playerId).toBe(bobPlayerId);

        const serverRoom = rooms.get(room.id);
        expect(serverRoom?.creator).toBe(serverSocketBob.id);

        expect(serverSocketBob.rooms.size).toBe(2);
        resolve();
      });
    });
  });

  it("should reject room creation if playerId is not set", () => {
    return new Promise<void>((resolve) => {
      clientSocketBob.emit("room:create", {}, (response: RoomResponse) => {
        expect(response.success).toBe(false);
        if (response.success) return;
        expect(response.error).toBe("playerId not set");
        resolve();
      });
    });
  });

  it("should fill in config when given partial data", async () => {
    await setupUser(clientSocketBob, "Bob", bobPlayerId);

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

  it("should accept a full config successfully", async () => {
    await setupUser(clientSocketBob, "Bob", bobPlayerId);

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

          resolve();
        }
      );
    });
  });

  // --- ROOM:JOIN ---

  it("should join an existing room", async () => {
    await setupUser(clientSocketBob, "Bob", bobPlayerId);
    await setupUser(clientSocketSally, "Sally", sallyPlayerId);

    return new Promise<void>((resolve) => {
      clientSocketBob.emit("room:create", {}, (response: RoomResponse) => {
        expect(response.success).toBe(true);
        if (!response.success) return;

        const roomId = response.room.id;

        clientSocketSally.emit("room:join", roomId, (response: RoomResponse) => {
          expect(response.success).toBe(true);
          if (!response.success) return;

          expect(response.room.players[serverSocketSally.id]).toBeDefined();
          expect(response.room.players[serverSocketSally.id].playerId).toBe(sallyPlayerId);
          expect(serverSocketSally.rooms.has(roomId)).toBe(true);
          resolve();
        });
      });
    });
  });

  it("should reject joining a non-existent room", async () => {
    await setupUser(clientSocketBob, "Bob", bobPlayerId);

    return new Promise<void>((resolve) => {
      clientSocketBob.emit("room:join", randomUUID(), (response: RoomResponse) => {
        expect(response.success).toBe(false);
        resolve();
      });
    });
  });

  it("should reject joining if playerId is not set", async () => {
    await setupUser(clientSocketBob, "Bob", bobPlayerId);

    return new Promise<void>((resolve) => {
      clientSocketBob.emit("room:create", {}, (response: RoomResponse) => {
        expect(response.success).toBe(true);
        if (!response.success) return;

        const roomId = response.room.id;

        // Sally tries to join without setting username/playerId
        clientSocketSally.emit("room:join", roomId, (response: RoomResponse) => {
          expect(response.success).toBe(false);
          if (response.success) return;
          expect(response.error).toBe("playerId not set");
          resolve();
        });
      });
    });
  });

  // --- ROOM:LEAVE ---

  it("should leave a room", async () => {
    await setupUser(clientSocketBob, "Bob", bobPlayerId);
    await setupUser(clientSocketSally, "Sally", sallyPlayerId);

    return new Promise<void>((resolve) => {
      clientSocketBob.emit("room:create", {}, (response: RoomResponse) => {
        expect(response.success).toBe(true);
        if (!response.success) return;

        const roomId = response.room.id;

        clientSocketSally.emit("room:join", roomId, (response: RoomResponse) => {
          expect(response.success).toBe(true);
          if (!response.success) return;

          clientSocketSally.emit("room:leave");

          setTimeout(() => {
            const serverRoom = rooms.get(roomId);
            expect(serverRoom?.players.has(serverSocketSally.id)).toBe(false);
            expect(serverSocketSally.rooms.has(roomId)).toBe(false);
            resolve();
          }, 100);
        });
      });
    });
  });

  // --- GAME:START ---

  it("should start the game when creator requests", async () => {
    await setupUser(clientSocketBob, "Bob", bobPlayerId);
    await setupUser(clientSocketSally, "Sally", sallyPlayerId);

    return new Promise<void>((resolve) => {
      clientSocketBob.emit("room:create", {}, (response: RoomResponse) => {
        expect(response.success).toBe(true);
        if (!response.success) return;

        const roomId = response.room.id;

        clientSocketSally.emit("room:join", roomId, (response: RoomResponse) => {
          expect(response.success).toBe(true);
          if (!response.success) return;

          clientSocketBob.emit("game:start", roomId, (response: SimpleResponse) => {
            expect(response.success).toBe(true);

            const serverRoom = rooms.get(roomId);
            expect(serverRoom?.phase).toBe("word-selection");
            expect(serverRoom?.currentRound).toBe(1);
            resolve();
          });
        });
      });
    });
  });

  it("should not start the game if not creator", async () => {
    await setupUser(clientSocketBob, "Bob", bobPlayerId);
    await setupUser(clientSocketSally, "Sally", sallyPlayerId);

    return new Promise<void>((resolve) => {
      clientSocketBob.emit("room:create", {}, (response: RoomResponse) => {
        expect(response.success).toBe(true);
        if (!response.success) return;

        const roomId = response.room.id;

        clientSocketSally.emit("room:join", roomId, (response: RoomResponse) => {
          expect(response.success).toBe(true);
          if (!response.success) return;

          clientSocketSally.emit("game:start", roomId, (response: SimpleResponse) => {
            expect(response.success).toBe(false);

            const serverRoom = rooms.get(roomId);
            expect(serverRoom?.phase).toBe("lobby");
            resolve();
          });
        });
      });
    });
  });

  it("should not start with only one player", async () => {
    await setupUser(clientSocketBob, "Bob", bobPlayerId);

    return new Promise<void>((resolve) => {
      clientSocketBob.emit("room:create", {}, (response: RoomResponse) => {
        expect(response.success).toBe(true);
        if (!response.success) return;

        const roomId = response.room.id;

        clientSocketBob.emit("game:start", roomId, (response: SimpleResponse) => {
          expect(response.success).toBe(false);

          const serverRoom = rooms.get(roomId);
          expect(serverRoom?.phase).toBe("lobby");
          resolve();
        });
      });
    });
  });

  // --- WORD:CHOICE ---

  it("should allow artist to select a word", async () => {
    await setupUser(clientSocketBob, "Bob", bobPlayerId);
    await setupUser(clientSocketSally, "Sally", sallyPlayerId);

    return new Promise<void>((resolve) => {
      clientSocketBob.emit("room:create", {}, (response: RoomResponse) => {
        expect(response.success).toBe(true);
        if (!response.success) return;

        const roomId = response.room.id;

        clientSocketSally.emit("room:join", roomId, (response: RoomResponse) => {
          expect(response.success).toBe(true);
          if (!response.success) return;

          const handleWordChoice = (data: { words: string[] }) => {
            const serverRoom = rooms.get(roomId);
            const artistId = serverRoom?.drawingState.currentArtist;
            const artistClient =
              artistId === serverSocketBob.id ? clientSocketBob : clientSocketSally;

            artistClient.emit("word:choice", data.words[0], (response: WordResponse) => {
              expect(response.success).toBe(true);

              setTimeout(() => {
                const serverRoom = rooms.get(roomId);
                expect(serverRoom?.phase).toBe("drawing");
                resolve();
              }, 100);
            });
          };

          clientSocketBob.on("word:choice", handleWordChoice);
          clientSocketSally.on("word:choice", handleWordChoice);

          clientSocketBob.emit("game:start", roomId, (response: SimpleResponse) => {
            expect(response.success).toBe(true);
          });
        });
      });
    });
  });

  it("should not allow non-artist to select a word", async () => {
    await setupUser(clientSocketBob, "Bob", bobPlayerId);
    await setupUser(clientSocketSally, "Sally", sallyPlayerId);

    return new Promise<void>((resolve) => {
      clientSocketBob.emit("room:create", {}, (response: RoomResponse) => {
        expect(response.success).toBe(true);
        if (!response.success) return;

        const roomId = response.room.id;

        clientSocketSally.emit("room:join", roomId, (response: RoomResponse) => {
          expect(response.success).toBe(true);
          if (!response.success) return;

          const handleWordChoice = (data: { words: string[] }) => {
            const serverRoom = rooms.get(roomId);
            const artistId = serverRoom?.drawingState.currentArtist;

            // Non-artist tries to select a word
            const nonArtistClient =
              artistId === serverSocketBob.id ? clientSocketSally : clientSocketBob;

            nonArtistClient.emit("word:choice", data.words[0], (_response: WordResponse) => {
              // The callback may not be called if validation fails silently
            });

            setTimeout(() => {
              // Should still be in word-selection phase
              expect(serverRoom?.phase).toBe("word-selection");
              resolve();
            }, 100);
          };

          clientSocketBob.on("word:choice", handleWordChoice);
          clientSocketSally.on("word:choice", handleWordChoice);

          clientSocketBob.emit("game:start", roomId, (response: SimpleResponse) => {
            expect(response.success).toBe(true);
          });
        });
      });
    });
  });

  // --- CHAT:GUESSAGE ---

  it("should broadcast incorrect guesses to all players", async () => {
    await setupUser(clientSocketBob, "Bob", bobPlayerId);
    await setupUser(clientSocketSally, "Sally", sallyPlayerId);

    return new Promise<void>((resolve) => {
      clientSocketBob.emit("room:create", {}, (response: RoomResponse) => {
        expect(response.success).toBe(true);
        if (!response.success) return;

        const roomId = response.room.id;

        clientSocketSally.emit("room:join", roomId, (response: RoomResponse) => {
          expect(response.success).toBe(true);
          if (!response.success) return;

          let roomUpdateReceived = false;

          clientSocketBob.on("room:update", () => {
            roomUpdateReceived = true;
          });

          const handleWordChoice = (data: { words: string[] }) => {
            const serverRoom = rooms.get(roomId);
            const artistId = serverRoom?.drawingState.currentArtist;
            const artistClient =
              artistId === serverSocketBob.id ? clientSocketBob : clientSocketSally;
            const nonArtistClient =
              artistId === serverSocketBob.id ? clientSocketSally : clientSocketBob;

            // Artist selects word
            artistClient.emit("word:choice", data.words[0], () => {
              setTimeout(() => {
                // Non-artist makes an incorrect guess
                const guessage: Guessage = {
                  playerId:
                    artistId === serverSocketBob.id ? serverSocketSally.id : serverSocketBob.id,
                  guessage: "definitely-wrong-guess-xyz",
                  timestamp: new Date().toISOString(),
                };

                nonArtistClient.emit("chat:guessage", guessage);

                setTimeout(() => {
                  expect(roomUpdateReceived).toBe(true);
                  const serverRoom = rooms.get(roomId);
                  expect(serverRoom?.guessages.length).toBeGreaterThan(0);
                  resolve();
                }, 100);
              }, 100);
            });
          };

          clientSocketBob.on("word:choice", handleWordChoice);
          clientSocketSally.on("word:choice", handleWordChoice);

          clientSocketBob.emit("game:start", roomId, (response: SimpleResponse) => {
            expect(response.success).toBe(true);
          });
        });
      });
    });
  });

  it("should emit guess:correct when a player guesses correctly", async () => {
    await setupUser(clientSocketBob, "Bob", bobPlayerId);
    await setupUser(clientSocketSally, "Sally", sallyPlayerId);

    return new Promise<void>((resolve) => {
      clientSocketBob.emit("room:create", {}, (response: RoomResponse) => {
        expect(response.success).toBe(true);
        if (!response.success) return;

        const roomId = response.room.id;

        clientSocketSally.emit("room:join", roomId, (response: RoomResponse) => {
          expect(response.success).toBe(true);
          if (!response.success) return;

          let correctGuessReceived = false;

          clientSocketBob.on("guess:correct", (data: { playerId: string; username: string }) => {
            expect(data.playerId).toBeDefined();
            expect(data.username).toBeDefined();
            correctGuessReceived = true;
          });

          clientSocketSally.on("guess:correct", (data: { playerId: string; username: string }) => {
            expect(data.playerId).toBeDefined();
            expect(data.username).toBeDefined();
            correctGuessReceived = true;
          });

          const handleWordChoice = (data: { words: string[] }) => {
            const serverRoom = rooms.get(roomId);
            const artistId = serverRoom?.drawingState.currentArtist;
            const artistClient =
              artistId === serverSocketBob.id ? clientSocketBob : clientSocketSally;
            const nonArtistClient =
              artistId === serverSocketBob.id ? clientSocketSally : clientSocketBob;
            const nonArtistId =
              artistId === serverSocketBob.id ? serverSocketSally.id : serverSocketBob.id;

            const chosenWord = data.words[0];

            // Artist selects word
            artistClient.emit("word:choice", chosenWord, () => {
              setTimeout(() => {
                // Non-artist guesses correctly
                const guessage: Guessage = {
                  playerId: nonArtistId,
                  guessage: chosenWord, // Correct guess
                  timestamp: new Date().toISOString(),
                };

                nonArtistClient.emit("chat:guessage", guessage);

                setTimeout(() => {
                  expect(correctGuessReceived).toBe(true);

                  const serverRoom = rooms.get(roomId);
                  expect(serverRoom?.drawingState.correctlyGuessed.length).toBe(1);
                  resolve();
                }, 100);
              }, 100);
            });
          };

          clientSocketBob.on("word:choice", handleWordChoice);
          clientSocketSally.on("word:choice", handleWordChoice);

          clientSocketBob.emit("game:start", roomId, (response: SimpleResponse) => {
            expect(response.success).toBe(true);
          });
        });
      });
    });
  });

  it("should not allow artist to guess", async () => {
    await setupUser(clientSocketBob, "Bob", bobPlayerId);
    await setupUser(clientSocketSally, "Sally", sallyPlayerId);

    return new Promise<void>((resolve) => {
      clientSocketBob.emit("room:create", {}, (response: RoomResponse) => {
        expect(response.success).toBe(true);
        if (!response.success) return;

        const roomId = response.room.id;

        clientSocketSally.emit("room:join", roomId, (response: RoomResponse) => {
          expect(response.success).toBe(true);
          if (!response.success) return;

          const handleWordChoice = (data: { words: string[] }) => {
            const serverRoom = rooms.get(roomId);
            const artistId = serverRoom?.drawingState.currentArtist;
            const artistClient =
              artistId === serverSocketBob.id ? clientSocketBob : clientSocketSally;

            const chosenWord = data.words[0];

            // Artist selects word
            artistClient.emit("word:choice", chosenWord, () => {
              setTimeout(() => {
                // Artist tries to guess their own word
                const guessage: Guessage = {
                  playerId: artistId!,
                  guessage: chosenWord,
                  timestamp: new Date().toISOString(),
                };

                artistClient.emit("chat:guessage", guessage);

                setTimeout(() => {
                  const serverRoom = rooms.get(roomId);
                  // Should not be counted as correct
                  expect(serverRoom?.drawingState.correctlyGuessed.length).toBe(0);
                  resolve();
                }, 100);
              }, 100);
            });
          };

          clientSocketBob.on("word:choice", handleWordChoice);
          clientSocketSally.on("word:choice", handleWordChoice);

          clientSocketBob.emit("game:start", roomId, (response: SimpleResponse) => {
            expect(response.success).toBe(true);
          });
        });
      });
    });
  });

  // --- TIMER SYNC ---

  it("should emit timer:sync when game phase changes", async () => {
    await setupUser(clientSocketBob, "Bob", bobPlayerId);
    await setupUser(clientSocketSally, "Sally", sallyPlayerId);

    return new Promise<void>((resolve) => {
      clientSocketBob.emit("room:create", {}, (response: RoomResponse) => {
        expect(response.success).toBe(true);
        if (!response.success) return;

        const roomId = response.room.id;

        clientSocketSally.emit("room:join", roomId, (response: RoomResponse) => {
          expect(response.success).toBe(true);
          if (!response.success) return;

          let timerSyncReceived = false;

          clientSocketBob.on("timer:sync", (data: { remaining: number; phase: GamePhase }) => {
            expect(data.remaining).toBeGreaterThan(0);
            expect(data.phase).toBeDefined();
            timerSyncReceived = true;
          });

          clientSocketBob.emit("game:start", roomId, () => {
            setTimeout(() => {
              expect(timerSyncReceived).toBe(true);
              resolve();
            }, 100);
          });
        });
      });
    });
  });

  // --- RECONNECTION ---

  it("should allow player to rejoin with same playerId and preserve score", async () => {
    await setupUser(clientSocketBob, "Bob", bobPlayerId);
    await setupUser(clientSocketSally, "Sally", sallyPlayerId);

    return new Promise<void>((resolve) => {
      clientSocketBob.emit("room:create", {}, (response: RoomResponse) => {
        expect(response.success).toBe(true);
        if (!response.success) return;

        const roomId = response.room.id;

        clientSocketSally.emit("room:join", roomId, (response: RoomResponse) => {
          expect(response.success).toBe(true);
          if (!response.success) return;

          // Set Sally's score
          const serverRoom = rooms.get(roomId);
          const sallyUser = serverRoom?.players.get(serverSocketSally.id);
          if (sallyUser) {
            sallyUser.score = 500;
          }

          // Create a new socket for Sally to simulate page refresh
          const newSallySocket = ioClient(`http://localhost:${serverPort}`);

          newSallySocket.on("connect", () => {
            // Set up username/playerId on the new socket
            newSallySocket.emit(
              "user:username",
              { username: "Sally", playerId: sallyPlayerId },
              (response: SimpleResponse) => {
                expect(response.success).toBe(true);

                // Rejoin the room with the new socket
                newSallySocket.emit("room:join", roomId, (response: RoomResponse) => {
                  expect(response.success).toBe(true);
                  if (!response.success) {
                    newSallySocket.disconnect();
                    return;
                  }

                  // Find Sally's new entry in the room
                  const sallyEntry = Object.values(response.room.players).find(
                    (p) => p.playerId === sallyPlayerId
                  );

                  // Score should be preserved
                  expect(sallyEntry?.score).toBe(500);

                  // Old socket entry should be removed (only one Sally)
                  const sallyCount = Object.values(response.room.players).filter(
                    (p) => p.playerId === sallyPlayerId
                  ).length;
                  expect(sallyCount).toBe(1);

                  newSallySocket.disconnect();
                  resolve();
                });
              }
            );
          });
        });
      });
    });
  });
});
