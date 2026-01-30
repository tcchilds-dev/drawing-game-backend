import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { createServer } from "node:http";
import { Socket as ClientSocket, io as ioClient } from "socket.io-client";
import {} from "node:net";
import { Server } from "socket.io";
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
    let io;
    let clientSocketBob;
    let clientSocketSally;
    let serverSocketBob;
    let serverSocketSally;
    beforeAll(() => {
        return new Promise((resolve) => {
            const httpServer = createServer();
            io = new Server(httpServer);
            gameManager.setIO(io);
            httpServer.listen(() => {
                const port = httpServer.address().port;
                let connectCount = 0;
                const checkAllConnected = () => {
                    connectCount++;
                    if (connectCount === 2)
                        resolve();
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
                    const socket = io.sockets.sockets.get(clientSocketBob.id);
                    if (!socket)
                        throw new Error("Server socket not found for Bob");
                    serverSocketBob = socket;
                    checkAllConnected();
                });
                clientSocketSally = ioClient(`http://localhost:${port}`);
                clientSocketSally.on("connect", () => {
                    const socket = io.sockets.sockets.get(clientSocketSally.id);
                    if (!socket)
                        throw new Error("Server socket not found for Sally");
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
        clientSocketBob.removeAllListeners();
        clientSocketSally.removeAllListeners();
        clientSocketBob.on("connect", () => { });
        clientSocketSally.on("connect", () => { });
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
    // --- BASIC TESTS ---
    it("should connect successfully", () => {
        expect(clientSocketBob.connected).toBe(true);
        expect(clientSocketSally.connected).toBe(true);
    });
    it("should work", () => {
        return new Promise((resolve) => {
            clientSocketBob.on("hello", (arg) => {
                expect(arg).toEqual("world");
                resolve();
            });
            serverSocketBob.emit("hello", "world");
        });
    });
    // --- USER:USERNAME ---
    it("should attach a given username to socket.data", () => {
        return new Promise((resolve) => {
            clientSocketBob.emit("user:username", "JohnnyRevolver", (response) => {
                expect(response.success).toBe(true);
                expect(serverSocketBob.data.username).toBe("JohnnyRevolver");
                resolve();
            });
        });
    });
    it("should reject an invalid username for being too short", () => {
        return new Promise((resolve) => {
            clientSocketBob.emit("user:username", "Me", (response) => {
                expect(response.success).toBe(false);
                expect(serverSocketBob.data.username).toBeNull();
                resolve();
            });
        });
    });
    it("should reject an invalid username for being too long", () => {
        return new Promise((resolve) => {
            clientSocketBob.emit("user:username", "LiterallyThousandsOfBees", (response) => {
                expect(response.success).toBe(false);
                expect(serverSocketBob.data.username).toBeNull();
                resolve();
            });
        });
    });
    it("should reject an argument that isn't a string", () => {
        return new Promise((resolve) => {
            clientSocketBob.emit("user:username", 7, (response) => {
                expect(response.success).toBe(false);
                expect(serverSocketBob.data.username).toBeNull();
                resolve();
            });
        });
    });
    // --- ROOM:CREATE ---
    it("should create a room with default config and join the creator to it", () => {
        return new Promise((resolve) => {
            clientSocketBob.emit("room:create", {}, (response) => {
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
                expect(room.phase).toBe("lobby");
                expect(room.players[serverSocketBob.id]).toBeDefined();
                const serverRoom = rooms.get(room.id);
                expect(serverRoom?.creator).toBe(serverSocketBob.id);
                expect(serverSocketBob.rooms.size).toBe(2);
                resolve();
            });
        });
    });
    it("should fill in config when given partial data", () => {
        return new Promise((resolve) => {
            clientSocketBob.emit("room:create", { maxPlayers: 10, wordSelectionSize: 5 }, (response) => {
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
                expect(room.players[serverSocketBob.id]).toBeDefined();
                expect(serverSocketBob.rooms.size).toBe(2);
                resolve();
            });
        });
    });
    it("should accept a full config successfully", () => {
        return new Promise((resolve) => {
            clientSocketBob.emit("room:create", {
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
                expect(room.players[serverSocketBob.id]).toBeDefined();
                expect(serverSocketBob.rooms.size).toBe(2);
                resolve();
            });
        });
    });
    it("should reject invalid values for config", () => {
        return new Promise((resolve) => {
            clientSocketBob.emit("room:create", { maxPlayers: 15 }, (response) => {
                expect(response.success).toBe(false);
                expect(serverSocketBob.rooms.size).toBe(1);
                resolve();
            });
        });
    });
    it("should ignore invalid config parameters", () => {
        return new Promise((resolve) => {
            clientSocketBob.emit("room:create", { myFavouriteNumber: 15 }, (response) => {
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
                expect(room.players[serverSocketBob.id]).toBeDefined();
                expect(serverSocketBob.rooms.size).toBe(2);
                resolve();
            });
        });
    });
    // --- ROOM:JOIN ---
    it("should join a user to a room", () => {
        return new Promise((resolve) => {
            clientSocketBob.emit("room:create", {}, (response) => {
                expect(response.success).toBe(true);
                if (!response.success)
                    return;
                const { room } = response;
                clientSocketSally.emit("room:join", room.id, (response) => {
                    expect(response.success).toBe(true);
                    if (!response.success)
                        return;
                    const { room } = response;
                    expect(room.players[serverSocketSally.id]).toBeDefined();
                    resolve();
                });
            });
        });
    });
    it("should reject an invalid room code", () => {
        return new Promise((resolve) => {
            clientSocketSally.emit("room:join", "not a uuid", (response) => {
                expect(response.success).toBe(false);
                if (response.success !== false)
                    return;
                expect(response.error).toBe("room ID is invalid");
                resolve();
            });
        });
    });
    it("should reject a room that doesn't exist", () => {
        return new Promise((resolve) => {
            clientSocketSally.emit("room:join", "9ea8adb9-62b9-444f-8f40-8cfa079aceb7", (response) => {
                expect(response.success).toBe(false);
                if (response.success !== false)
                    return;
                expect(response.error).toBe("room does not exist");
                resolve();
            });
        });
    });
    // --- ROOM:LEAVE ---
    it("should remove a user from a room", () => {
        return new Promise((resolve) => {
            clientSocketBob.emit("room:create", {}, (response) => {
                expect(response.success).toBe(true);
                if (!response.success)
                    return;
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
    // --- GAME:START ---
    it("should start a game with 2 players", () => {
        return new Promise((resolve) => {
            clientSocketBob.emit("room:create", {}, (response) => {
                expect(response.success).toBe(true);
                if (!response.success)
                    return;
                const roomId = response.room.id;
                clientSocketSally.emit("room:join", roomId, (response) => {
                    expect(response.success).toBe(true);
                    if (!response.success)
                        return;
                    clientSocketBob.emit("game:start", roomId, (response) => {
                        expect(response.success).toBe(true);
                        const serverRoom = rooms.get(roomId);
                        expect(serverRoom?.phase).toBe("word-selection");
                        expect(serverRoom?.currentRound).toBe(1);
                        expect(serverRoom?.drawingState.currentArtist).toBeDefined();
                        resolve();
                    });
                });
            });
        });
    });
    it("should reject starting a game with only 1 player", () => {
        return new Promise((resolve) => {
            clientSocketBob.emit("room:create", {}, (response) => {
                expect(response.success).toBe(true);
                if (!response.success)
                    return;
                const roomId = response.room.id;
                clientSocketBob.emit("game:start", roomId, (response) => {
                    expect(response.success).toBe(false);
                    if (response.success)
                        return;
                    expect(response.error).toBe("need at least 2 players to start");
                    const serverRoom = rooms.get(roomId);
                    expect(serverRoom?.phase).toBe("lobby");
                    resolve();
                });
            });
        });
    });
    it("should reject starting a game that has already started", () => {
        return new Promise((resolve) => {
            clientSocketBob.emit("room:create", {}, (response) => {
                expect(response.success).toBe(true);
                if (!response.success)
                    return;
                const roomId = response.room.id;
                clientSocketSally.emit("room:join", roomId, (response) => {
                    expect(response.success).toBe(true);
                    if (!response.success)
                        return;
                    // Start the game first time
                    clientSocketBob.emit("game:start", roomId, (response) => {
                        expect(response.success).toBe(true);
                        // Try to start again
                        clientSocketBob.emit("game:start", roomId, (response) => {
                            expect(response.success).toBe(false);
                            if (response.success)
                                return;
                            expect(response.error).toBe("game already started");
                            resolve();
                        });
                    });
                });
            });
        });
    });
    it("should reject starting a game with invalid room ID", () => {
        return new Promise((resolve) => {
            clientSocketBob.emit("game:start", "not-a-uuid", (response) => {
                expect(response.success).toBe(false);
                if (response.success)
                    return;
                expect(response.error).toBe("room ID is invalid");
                resolve();
            });
        });
    });
    it("should reject starting a game if player is not the creator", () => {
        return new Promise((resolve) => {
            clientSocketBob.emit("room:create", {}, (response) => {
                expect(response.success).toBe(true);
                if (!response.success)
                    return;
                const roomId = response.room.id;
                // Sally joins the room
                clientSocketSally.emit("room:join", roomId, (response) => {
                    expect(response.success).toBe(true);
                    if (!response.success)
                        return;
                    // Sally (not the creator) tries to start the game
                    clientSocketSally.emit("game:start", roomId, (response) => {
                        expect(response.success).toBe(false);
                        if (response.success)
                            return;
                        expect(response.error).toBe("you are not the creator");
                        const serverRoom = rooms.get(roomId);
                        expect(serverRoom?.phase).toBe("lobby");
                        resolve();
                    });
                });
            });
        });
    });
    it("should emit round:start when game starts", () => {
        return new Promise((resolve) => {
            clientSocketBob.emit("room:create", {}, (response) => {
                expect(response.success).toBe(true);
                if (!response.success)
                    return;
                const roomId = response.room.id;
                clientSocketSally.emit("room:join", roomId, (response) => {
                    expect(response.success).toBe(true);
                    if (!response.success)
                        return;
                    // Listen for round:start event
                    clientSocketBob.on("round:start", (data) => {
                        expect(data.round).toBe(1);
                        expect(data.artistId).toBeDefined();
                        // Artist should be one of the players
                        expect([serverSocketBob.id, serverSocketSally.id]).toContain(data.artistId);
                        resolve();
                    });
                    clientSocketBob.emit("game:start", roomId, (response) => {
                        expect(response.success).toBe(true);
                    });
                });
            });
        });
    });
    it("should emit word:choice to the artist when game starts", () => {
        return new Promise((resolve) => {
            clientSocketBob.emit("room:create", {}, (response) => {
                expect(response.success).toBe(true);
                if (!response.success)
                    return;
                const roomId = response.room.id;
                clientSocketSally.emit("room:join", roomId, (response) => {
                    expect(response.success).toBe(true);
                    if (!response.success)
                        return;
                    let wordChoiceReceived = false;
                    // Both players listen for word:choice - only artist should receive
                    clientSocketBob.on("word:choice", (data) => {
                        expect(data.words).toBeInstanceOf(Array);
                        expect(data.words.length).toBeGreaterThan(0);
                        wordChoiceReceived = true;
                    });
                    clientSocketSally.on("word:choice", (data) => {
                        expect(data.words).toBeInstanceOf(Array);
                        expect(data.words.length).toBeGreaterThan(0);
                        wordChoiceReceived = true;
                    });
                    clientSocketBob.emit("game:start", roomId, () => {
                        // Give time for events to propagate
                        setTimeout(() => {
                            expect(wordChoiceReceived).toBe(true);
                            resolve();
                        }, 100);
                    });
                });
            });
        });
    });
    // --- WORD:CHOICE ---
    it("should allow artist to select a word and receive callback", () => {
        return new Promise((resolve) => {
            clientSocketBob.emit("room:create", {}, (response) => {
                expect(response.success).toBe(true);
                if (!response.success)
                    return;
                const roomId = response.room.id;
                clientSocketSally.emit("room:join", roomId, (response) => {
                    expect(response.success).toBe(true);
                    if (!response.success)
                        return;
                    const handleWordChoice = (data) => {
                        const serverRoom = rooms.get(roomId);
                        const artistId = serverRoom?.drawingState.currentArtist;
                        // Determine which client is the artist
                        const artistClient = artistId === serverSocketBob.id ? clientSocketBob : clientSocketSally;
                        // Artist selects the first word with callback
                        artistClient.emit("word:choice", data.words[0], (response) => {
                            expect(response.success).toBe(true);
                            if (!response.success)
                                return;
                            expect(response.word).toBe(data.words[0]);
                            setTimeout(() => {
                                expect(serverRoom?.phase).toBe("drawing");
                                resolve();
                            }, 50);
                        });
                    };
                    clientSocketBob.on("word:choice", handleWordChoice);
                    clientSocketSally.on("word:choice", handleWordChoice);
                    clientSocketBob.emit("game:start", roomId, (response) => {
                        expect(response.success).toBe(true);
                    });
                });
            });
        });
    });
    it("should reject word selection from non-artist", () => {
        return new Promise((resolve) => {
            clientSocketBob.emit("room:create", {}, (response) => {
                expect(response.success).toBe(true);
                if (!response.success)
                    return;
                const roomId = response.room.id;
                clientSocketSally.emit("room:join", roomId, (response) => {
                    expect(response.success).toBe(true);
                    if (!response.success)
                        return;
                    const handleWordChoice = (data) => {
                        const serverRoom = rooms.get(roomId);
                        const artistId = serverRoom?.drawingState.currentArtist;
                        // Non-artist tries to select a word
                        const nonArtistClient = artistId === serverSocketBob.id ? clientSocketSally : clientSocketBob;
                        nonArtistClient.emit("word:choice", data.words[0], (_response) => {
                            // The callback may not be called if validation fails silently
                            // Check the phase hasn't changed
                        });
                        setTimeout(() => {
                            // Should still be in word-selection phase
                            expect(serverRoom?.phase).toBe("word-selection");
                            resolve();
                        }, 100);
                    };
                    clientSocketBob.on("word:choice", handleWordChoice);
                    clientSocketSally.on("word:choice", handleWordChoice);
                    clientSocketBob.emit("game:start", roomId, (response) => {
                        expect(response.success).toBe(true);
                    });
                });
            });
        });
    });
    // --- CHAT:GUESSAGE ---
    it("should broadcast incorrect guesses to all players", () => {
        return new Promise((resolve) => {
            clientSocketBob.emit("room:create", {}, (response) => {
                expect(response.success).toBe(true);
                if (!response.success)
                    return;
                const roomId = response.room.id;
                clientSocketSally.emit("room:join", roomId, (response) => {
                    expect(response.success).toBe(true);
                    if (!response.success)
                        return;
                    let roomUpdateReceived = false;
                    clientSocketBob.on("room:update", () => {
                        roomUpdateReceived = true;
                    });
                    const handleWordChoice = (data) => {
                        const serverRoom = rooms.get(roomId);
                        const artistId = serverRoom?.drawingState.currentArtist;
                        const artistClient = artistId === serverSocketBob.id ? clientSocketBob : clientSocketSally;
                        const nonArtistClient = artistId === serverSocketBob.id ? clientSocketSally : clientSocketBob;
                        // Artist selects word
                        artistClient.emit("word:choice", data.words[0], () => {
                            setTimeout(() => {
                                // Non-artist makes an incorrect guess
                                const guessage = {
                                    playerId: artistId === serverSocketBob.id ? serverSocketSally.id : serverSocketBob.id,
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
                    clientSocketBob.emit("game:start", roomId, (response) => {
                        expect(response.success).toBe(true);
                    });
                });
            });
        });
    });
    it("should emit guess:correct when a player guesses correctly", () => {
        return new Promise((resolve) => {
            clientSocketBob.emit("room:create", {}, (response) => {
                expect(response.success).toBe(true);
                if (!response.success)
                    return;
                const roomId = response.room.id;
                clientSocketSally.emit("room:join", roomId, (response) => {
                    expect(response.success).toBe(true);
                    if (!response.success)
                        return;
                    let correctGuessReceived = false;
                    clientSocketBob.on("guess:correct", (data) => {
                        expect(data.playerId).toBeDefined();
                        expect(data.username).toBeDefined();
                        correctGuessReceived = true;
                    });
                    clientSocketSally.on("guess:correct", (data) => {
                        expect(data.playerId).toBeDefined();
                        expect(data.username).toBeDefined();
                        correctGuessReceived = true;
                    });
                    const handleWordChoice = (data) => {
                        const serverRoom = rooms.get(roomId);
                        const artistId = serverRoom?.drawingState.currentArtist;
                        const artistClient = artistId === serverSocketBob.id ? clientSocketBob : clientSocketSally;
                        const nonArtistClient = artistId === serverSocketBob.id ? clientSocketSally : clientSocketBob;
                        const nonArtistId = artistId === serverSocketBob.id ? serverSocketSally.id : serverSocketBob.id;
                        const chosenWord = data.words[0];
                        // Artist selects word
                        artistClient.emit("word:choice", chosenWord, () => {
                            setTimeout(() => {
                                // Non-artist guesses correctly
                                const guessage = {
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
                    clientSocketBob.emit("game:start", roomId, (response) => {
                        expect(response.success).toBe(true);
                    });
                });
            });
        });
    });
    it("should not allow artist to guess", () => {
        return new Promise((resolve) => {
            clientSocketBob.emit("room:create", {}, (response) => {
                expect(response.success).toBe(true);
                if (!response.success)
                    return;
                const roomId = response.room.id;
                clientSocketSally.emit("room:join", roomId, (response) => {
                    expect(response.success).toBe(true);
                    if (!response.success)
                        return;
                    const handleWordChoice = (data) => {
                        const serverRoom = rooms.get(roomId);
                        const artistId = serverRoom?.drawingState.currentArtist;
                        const artistClient = artistId === serverSocketBob.id ? clientSocketBob : clientSocketSally;
                        const chosenWord = data.words[0];
                        // Artist selects word
                        artistClient.emit("word:choice", chosenWord, () => {
                            setTimeout(() => {
                                // Artist tries to guess their own word
                                const guessage = {
                                    playerId: artistId,
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
                    clientSocketBob.emit("game:start", roomId, (response) => {
                        expect(response.success).toBe(true);
                    });
                });
            });
        });
    });
    // --- TIMER SYNC ---
    it("should emit timer:sync when game phase changes", () => {
        return new Promise((resolve) => {
            clientSocketBob.emit("room:create", {}, (response) => {
                expect(response.success).toBe(true);
                if (!response.success)
                    return;
                const roomId = response.room.id;
                clientSocketSally.emit("room:join", roomId, (response) => {
                    expect(response.success).toBe(true);
                    if (!response.success)
                        return;
                    let timerSyncReceived = false;
                    clientSocketBob.on("timer:sync", (data) => {
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
});
//# sourceMappingURL=integration.test.js.map