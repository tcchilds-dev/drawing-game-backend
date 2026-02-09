import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import { createServer, type Server as HttpServer } from "node:http";
import { type AddressInfo } from "node:net";
import { randomUUID } from "node:crypto";
import { Server, type Socket as ServerSocket } from "socket.io";
import { Socket as ClientSocket, io as ioClient } from "socket.io-client";
import type {
  ClientToServerEvents,
  RoomResponse,
  ServerToClientEvents,
  SimpleResponse,
  WordResponse,
} from "../src/types/event.types.js";
import type { Guessage, Point, RoomConfig, SocketData } from "../src/types/main.types.js";
import { setUsername } from "../src/user/user.js";
import { createRoom } from "../src/room/create.js";
import { joinRoom } from "../src/room/join.js";
import { leaveRoom } from "../src/room/leave.js";
import { handleDisconnect } from "../src/room/disconnect.js";
import { rooms } from "../src/room/rooms.js";
import { startGame } from "../src/game/start.js";
import { handleGuessage } from "../src/game/guessage.js";
import { chooseWord } from "../src/game/word.js";
import { gameManager } from "../src/game/GameManager.js";
import {
  handleCanvasClear,
  handleCanvasUndo,
  handleStrokeEnd,
  handleStrokePoints,
  handleStrokeStart,
} from "../src/game/drawing.js";

type WordChoiceCapture = {
  artistClient: ClientSocket;
  nonArtistClient: ClientSocket;
  artistPlayerId: string;
  nonArtistPlayerId: string;
  words: string[];
};

describe("Socket.IO server integration coverage", () => {
  let io: Server;
  let httpServer: HttpServer;
  let serverPort: number;
  let clientSocketBob: ClientSocket;
  let clientSocketSally: ClientSocket;
  let serverSocketBob: ServerSocket;
  let serverSocketSally: ServerSocket;

  const bobPlayerId = randomUUID();
  const sallyPlayerId = randomUUID();
  const extraClients: ClientSocket[] = [];

  function getServerSocket(client: ClientSocket): ServerSocket {
    const serverSocket = io.sockets.sockets.get(client.id!);
    if (!serverSocket) {
      throw new Error(`Could not find server socket for client ${client.id}`);
    }
    return serverSocket;
  }

  function leaveSocketRooms(client: ClientSocket): void {
    const serverSocket = io.sockets.sockets.get(client.id || "");
    if (!serverSocket) return;

    for (const roomId of serverSocket.rooms) {
      if (roomId !== serverSocket.id) {
        serverSocket.leave(roomId);
      }
    }
  }

  function wait(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function waitForEvent<T>(
    client: ClientSocket,
    event: string,
    timeoutMs: number = 2000
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error(`Timed out waiting for ${event}`));
      }, timeoutMs);

      const handler = (...args: unknown[]) => {
        cleanup();
        resolve(args[0] as T);
      };

      const cleanup = () => {
        clearTimeout(timeout);
        client.off(event, handler as (...args: unknown[]) => void);
      };

      client.on(event, handler as (...args: unknown[]) => void);
    });
  }

  async function expectNoEvent(
    client: ClientSocket,
    event: string,
    durationMs: number = 200
  ): Promise<void> {
    let triggered = false;

    const handler = () => {
      triggered = true;
    };

    client.once(event, handler);
    await wait(durationMs);
    client.off(event, handler);

    expect(triggered).toBe(false);
  }

  function emitWithAck<T>(client: ClientSocket, event: string, payload: unknown): Promise<T> {
    return new Promise((resolve) => {
      client.emit(event, payload, (response: T) => resolve(response));
    });
  }

  async function setupUser(
    client: ClientSocket,
    username: string,
    playerId: string
  ): Promise<SimpleResponse> {
    return emitWithAck<SimpleResponse>(client, "user:username", { username, playerId });
  }

  async function connectClient(): Promise<ClientSocket> {
    return new Promise((resolve, reject) => {
      const client = ioClient(`http://localhost:${serverPort}`, {
        forceNew: true,
        transports: ["websocket"],
      });

      const timeout = setTimeout(() => {
        cleanup();
        client.disconnect();
        reject(new Error("Timed out while connecting socket"));
      }, 2000);

      const onConnect = () => {
        cleanup();
        resolve(client);
      };

      const onConnectError = (error: Error) => {
        cleanup();
        reject(error);
      };

      const cleanup = () => {
        clearTimeout(timeout);
        client.off("connect", onConnect);
        client.off("connect_error", onConnectError);
      };

      client.on("connect", onConnect);
      client.on("connect_error", onConnectError);
    });
  }

  async function createRoomAndJoinWithBobAndSally(
    config: Partial<RoomConfig> = {}
  ): Promise<string> {
    const bobSetup = await setupUser(clientSocketBob, "Bob", bobPlayerId);
    expect(bobSetup.success).toBe(true);

    const sallySetup = await setupUser(clientSocketSally, "Sally", sallyPlayerId);
    expect(sallySetup.success).toBe(true);

    const createResponse = await emitWithAck<RoomResponse>(clientSocketBob, "room:create", config);
    expect(createResponse.success).toBe(true);
    if (!createResponse.success) {
      throw new Error(createResponse.error);
    }

    const joinResponse = await emitWithAck<RoomResponse>(
      clientSocketSally,
      "room:join",
      createResponse.room.id
    );
    expect(joinResponse.success).toBe(true);
    if (!joinResponse.success) {
      throw new Error(joinResponse.error);
    }

    return createResponse.room.id;
  }

  function waitForWordChoiceFromEither(
    firstClient: ClientSocket,
    secondClient: ClientSocket,
    firstPlayerId: string,
    secondPlayerId: string,
    timeoutMs: number = 2000
  ): Promise<WordChoiceCapture> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error("Timed out waiting for word:choice"));
      }, timeoutMs);

      const handleFirst = (data: { words: string[] }) => {
        cleanup();
        resolve({
          artistClient: firstClient,
          nonArtistClient: secondClient,
          artistPlayerId: firstPlayerId,
          nonArtistPlayerId: secondPlayerId,
          words: data.words,
        });
      };

      const handleSecond = (data: { words: string[] }) => {
        cleanup();
        resolve({
          artistClient: secondClient,
          nonArtistClient: firstClient,
          artistPlayerId: secondPlayerId,
          nonArtistPlayerId: firstPlayerId,
          words: data.words,
        });
      };

      const cleanup = () => {
        clearTimeout(timeout);
        firstClient.off("word:choice", handleFirst);
        secondClient.off("word:choice", handleSecond);
      };

      firstClient.on("word:choice", handleFirst);
      secondClient.on("word:choice", handleSecond);
    });
  }

  async function startGameAndSelectFirstWord(
    roomId: string,
    firstClient: ClientSocket,
    secondClient: ClientSocket,
    firstPlayerId: string,
    secondPlayerId: string
  ): Promise<WordChoiceCapture & { chosenWord: string }> {
    const wordChoicePromise = waitForWordChoiceFromEither(
      firstClient,
      secondClient,
      firstPlayerId,
      secondPlayerId
    );

    const startResponse = await emitWithAck<SimpleResponse>(clientSocketBob, "game:start", roomId);
    expect(startResponse.success).toBe(true);
    if (!startResponse.success) {
      throw new Error(startResponse.error);
    }

    const wordChoice = await wordChoicePromise;
    const chosenWord = wordChoice.words[0];
    if (!chosenWord) {
      throw new Error("No word options received");
    }

    const selectResponse = await emitWithAck<WordResponse>(
      wordChoice.artistClient,
      "word:choice",
      chosenWord
    );
    expect(selectResponse.success).toBe(true);
    if (!selectResponse.success) {
      throw new Error(selectResponse.error);
    }

    return {
      ...wordChoice,
      chosenWord: selectResponse.word,
    };
  }

  async function createExtraClientWithUser(
    username: string,
    playerId: string = randomUUID()
  ): Promise<{ client: ClientSocket; playerId: string }> {
    const client = await connectClient();
    extraClients.push(client);

    const setupResponse = await setupUser(client, username, playerId);
    expect(setupResponse.success).toBe(true);

    return {
      client,
      playerId,
    };
  }

  beforeAll(async () => {
    httpServer = createServer();

    io = new Server<
      ClientToServerEvents,
      ServerToClientEvents,
      Record<string, never>,
      SocketData
    >(httpServer);

    gameManager.setIO(io);

    io.on("connection", (socket) => {
      const processDisconnect = handleDisconnect({ io, socket });

      socket.on("user:username", setUsername({ io, socket }));

      socket.on("room:create", createRoom({ io, socket }));
      socket.on("room:join", joinRoom({ io, socket }));
      socket.on("room:leave", leaveRoom({ io, socket }));

      socket.on("game:start", startGame({ io, socket }));
      socket.on("chat:guessage", handleGuessage({ io, socket }));
      socket.on("word:choice", chooseWord({ io, socket }));

      socket.on("stroke:start", handleStrokeStart({ io, socket }));
      socket.on("stroke:points", handleStrokePoints({ io, socket }));
      socket.on("stroke:end", handleStrokeEnd({ io, socket }));
      socket.on("canvas:clear", handleCanvasClear({ io, socket }));
      socket.on("canvas:undo", handleCanvasUndo({ io, socket }));

      socket.on("disconnecting", () => {
        processDisconnect();
      });
    });

    await new Promise<void>((resolve) => {
      httpServer.listen(() => {
        serverPort = (httpServer.address() as AddressInfo).port;
        resolve();
      });
    });

    clientSocketBob = await connectClient();
    clientSocketSally = await connectClient();
    serverSocketBob = getServerSocket(clientSocketBob);
    serverSocketSally = getServerSocket(clientSocketSally);
  });

  beforeEach(() => {
    serverSocketBob = getServerSocket(clientSocketBob);
    serverSocketSally = getServerSocket(clientSocketSally);

    serverSocketBob.data.username = null;
    serverSocketBob.data.playerId = null;
    serverSocketBob.data.score = null;

    serverSocketSally.data.username = null;
    serverSocketSally.data.playerId = null;
    serverSocketSally.data.score = null;
  });

  afterEach(() => {
    for (const client of [clientSocketBob, clientSocketSally, ...extraClients]) {
      client.removeAllListeners();
    }

    for (const client of [clientSocketBob, clientSocketSally, ...extraClients]) {
      leaveSocketRooms(client);
    }

    for (const extraClient of extraClients) {
      if (extraClient.connected) {
        extraClient.disconnect();
      }
    }
    extraClients.length = 0;

    gameManager.clearAllGames();
    rooms.clear();
  });

  afterAll(async () => {
    for (const extraClient of extraClients) {
      if (extraClient.connected) {
        extraClient.disconnect();
      }
    }

    clientSocketBob.disconnect();
    clientSocketSally.disconnect();

    io.close();
    await new Promise<void>((resolve) => {
      httpServer.close(() => {
        resolve();
      });
    });
  });

  it("should reject room creation when room config validation fails", async () => {
    await setupUser(clientSocketBob, "Bob", bobPlayerId);

    const response = await emitWithAck<RoomResponse>(clientSocketBob, "room:create", {
      maxPlayers: 1,
    });

    expect(response.success).toBe(false);
    if (response.success) return;
    expect(response.error).toBe("room config validation failed");
  });

  it("should reject joining when room id format is invalid", async () => {
    await setupUser(clientSocketBob, "Bob", bobPlayerId);

    const response = await emitWithAck<RoomResponse>(
      clientSocketBob,
      "room:join",
      "not-a-valid-room-id"
    );

    expect(response.success).toBe(false);
    if (response.success) return;
    expect(response.error).toBe("room ID is invalid");
  });

  it("should reject joining when the room is full", async () => {
    await setupUser(clientSocketBob, "Bob", bobPlayerId);
    await setupUser(clientSocketSally, "Sally", sallyPlayerId);

    const createResponse = await emitWithAck<RoomResponse>(clientSocketBob, "room:create", {
      maxPlayers: 2,
    });
    expect(createResponse.success).toBe(true);
    if (!createResponse.success) return;

    const roomId = createResponse.room.id;
    const sallyJoinResponse = await emitWithAck<RoomResponse>(clientSocketSally, "room:join", roomId);
    expect(sallyJoinResponse.success).toBe(true);

    const { client: charlieClient } = await createExtraClientWithUser("Charlie");

    const charlieJoinResponse = await emitWithAck<RoomResponse>(charlieClient, "room:join", roomId);
    expect(charlieJoinResponse.success).toBe(false);
    if (charlieJoinResponse.success) return;
    expect(charlieJoinResponse.error).toBe("room is full");
  });

  it("should transfer creator when the creator leaves", async () => {
    const roomId = await createRoomAndJoinWithBobAndSally();
    const userLeftPromise = waitForEvent<string>(clientSocketSally, "user:left");

    clientSocketBob.emit("room:leave");

    const userLeftSocketId = await userLeftPromise;
    expect(userLeftSocketId).toBe(clientSocketBob.id);

    const room = rooms.get(roomId);
    expect(room?.creator).toBe(clientSocketSally.id);
    expect(room?.players.size).toBe(1);
  });

  it("should delete room when the final player leaves", async () => {
    await setupUser(clientSocketBob, "Bob", bobPlayerId);

    const createResponse = await emitWithAck<RoomResponse>(clientSocketBob, "room:create", {});
    expect(createResponse.success).toBe(true);
    if (!createResponse.success) return;

    const roomId = createResponse.room.id;
    clientSocketBob.emit("room:leave");

    await wait(50);
    expect(rooms.has(roomId)).toBe(false);
  });

  it("should reject game:start for invalid and unknown room ids", async () => {
    await setupUser(clientSocketBob, "Bob", bobPlayerId);

    const invalidIdResponse = await emitWithAck<SimpleResponse>(
      clientSocketBob,
      "game:start",
      "not-a-uuid"
    );
    expect(invalidIdResponse.success).toBe(false);
    if (!invalidIdResponse.success) {
      expect(invalidIdResponse.error).toBe("room ID is invalid");
    }

    const missingRoomResponse = await emitWithAck<SimpleResponse>(
      clientSocketBob,
      "game:start",
      randomUUID()
    );
    expect(missingRoomResponse.success).toBe(false);
    if (!missingRoomResponse.success) {
      expect(missingRoomResponse.error).toBe("room does not exist");
    }
  });

  it("should reject game:start when game is already in progress", async () => {
    const roomId = await createRoomAndJoinWithBobAndSally();

    const firstStart = await emitWithAck<SimpleResponse>(clientSocketBob, "game:start", roomId);
    expect(firstStart.success).toBe(true);

    const secondStart = await emitWithAck<SimpleResponse>(clientSocketBob, "game:start", roomId);
    expect(secondStart.success).toBe(false);
    if (secondStart.success) return;
    expect(secondStart.error).toBe("game already started");
  });

  it("should emit round:start, word:mask, and word:selected for word selection flow", async () => {
    const roomId = await createRoomAndJoinWithBobAndSally();

    const roundStartPromise = waitForEvent<{ round: number; artistId: string }>(
      clientSocketBob,
      "round:start"
    );
    const wordChoicePromise = waitForWordChoiceFromEither(
      clientSocketBob,
      clientSocketSally,
      bobPlayerId,
      sallyPlayerId
    );

    const startResponse = await emitWithAck<SimpleResponse>(clientSocketBob, "game:start", roomId);
    expect(startResponse.success).toBe(true);

    const roundStart = await roundStartPromise;
    const wordChoice = await wordChoicePromise;

    expect(roundStart.round).toBe(1);
    expect(roundStart.artistId).toBe(wordChoice.artistPlayerId);

    const selectedWord = wordChoice.words[0];
    if (!selectedWord) {
      throw new Error("Expected at least one selectable word");
    }

    const expectedMask = selectedWord.replace(/[^ ]/g, "_");

    const artistSelectedPromise = waitForEvent<{ word: string }>(
      wordChoice.artistClient,
      "word:selected"
    );
    const bobMaskPromise = waitForEvent<{ maskedWord: string }>(clientSocketBob, "word:mask");
    const sallyMaskPromise = waitForEvent<{ maskedWord: string }>(clientSocketSally, "word:mask");
    const nonArtistNoWordSelected = expectNoEvent(wordChoice.nonArtistClient, "word:selected");

    const selectResponse = await emitWithAck<WordResponse>(
      wordChoice.artistClient,
      "word:choice",
      selectedWord
    );
    expect(selectResponse.success).toBe(true);

    const artistSelected = await artistSelectedPromise;
    const bobMask = await bobMaskPromise;
    const sallyMask = await sallyMaskPromise;
    await nonArtistNoWordSelected;

    expect(artistSelected.word).toBe(selectedWord);
    expect(bobMask.maskedWord).toBe(expectedMask);
    expect(sallyMask.maskedWord).toBe(expectedMask);
  });

  it("should emit round:end after all non-artists guess correctly", async () => {
    const roomId = await createRoomAndJoinWithBobAndSally();
    const setup = await startGameAndSelectFirstWord(
      roomId,
      clientSocketBob,
      clientSocketSally,
      bobPlayerId,
      sallyPlayerId
    );

    const roundEndPromise = waitForEvent<{ word: string; scores: Record<string, number> }>(
      setup.artistClient,
      "round:end"
    );

    const correctGuess: Guessage = {
      playerId: setup.artistPlayerId,
      guessage: setup.chosenWord,
      timestamp: new Date().toISOString(),
    };

    setup.nonArtistClient.emit("chat:guessage", correctGuess);

    const roundEnd = await roundEndPromise;
    expect(roundEnd.word).toBe(setup.chosenWord);
    expect(roundEnd.scores[setup.nonArtistClient.id!]).toBeGreaterThan(0);

    const room = rooms.get(roomId);
    expect(room?.phase).toBe("round-end");
  });

  it("should emit game:end when players drop below two during an active game", async () => {
    const roomId = await createRoomAndJoinWithBobAndSally();
    const setup = await startGameAndSelectFirstWord(
      roomId,
      clientSocketBob,
      clientSocketSally,
      bobPlayerId,
      sallyPlayerId
    );

    const gameEndPromise = waitForEvent<{ finalStandings: Array<{ playerId: string }> }>(
      setup.artistClient,
      "game:end"
    );

    setup.nonArtistClient.emit("room:leave");

    const gameEnd = await gameEndPromise;
    expect(gameEnd.finalStandings).toHaveLength(1);
    expect(gameEnd.finalStandings[0]?.playerId).toBe(setup.artistPlayerId);

    const room = rooms.get(roomId);
    expect(room?.phase).toBe("lobby");
    expect(room?.currentRound).toBe(0);
  });

  it("should reject word:choice when payload validation fails", async () => {
    const roomId = await createRoomAndJoinWithBobAndSally();

    const wordChoicePromise = waitForWordChoiceFromEither(
      clientSocketBob,
      clientSocketSally,
      bobPlayerId,
      sallyPlayerId
    );
    await emitWithAck<SimpleResponse>(clientSocketBob, "game:start", roomId);

    const wordChoice = await wordChoicePromise;
    const invalidSelectionResponse = await emitWithAck<WordResponse>(
      wordChoice.artistClient,
      "word:choice",
      42
    );

    expect(invalidSelectionResponse.success).toBe(false);
    if (invalidSelectionResponse.success) return;
    expect(invalidSelectionResponse.error).toBe("word validation failed");
    expect(rooms.get(roomId)?.phase).toBe("word-selection");
  });

  it("should sanitize guessed playerId to the socket player's id", async () => {
    const roomId = await createRoomAndJoinWithBobAndSally();
    const setup = await startGameAndSelectFirstWord(
      roomId,
      clientSocketBob,
      clientSocketSally,
      bobPlayerId,
      sallyPlayerId
    );

    const roomUpdatePromise = waitForEvent(clientSocketBob, "room:update");

    const spoofedGuess: Guessage = {
      playerId: setup.artistPlayerId,
      guessage: "not-the-right-answer",
      timestamp: new Date().toISOString(),
    };

    setup.nonArtistClient.emit("chat:guessage", spoofedGuess);
    await roomUpdatePromise;

    const room = rooms.get(roomId);
    expect(room?.guessages).toHaveLength(1);
    expect(room?.guessages[0]?.playerId).toBe(setup.nonArtistPlayerId);
  });

  it("should broadcast drawing stroke events and persist completed strokes", async () => {
    const roomId = await createRoomAndJoinWithBobAndSally();
    const setup = await startGameAndSelectFirstWord(
      roomId,
      clientSocketBob,
      clientSocketSally,
      bobPlayerId,
      sallyPlayerId
    );

    const strokeStartPromise = waitForEvent<{ playerId: string; color: string; width: number }>(
      setup.nonArtistClient,
      "stroke:start"
    );
    const strokePointsPromise = waitForEvent<{ playerId: string; points: Point[] }>(
      setup.nonArtistClient,
      "stroke:points"
    );
    const strokeEndPromise = waitForEvent(setup.nonArtistClient, "stroke:end");

    const points: Point[] = [
      [0.1, 0.2],
      [0.3, 0.4],
    ];

    setup.artistClient.emit("stroke:start", { color: "#123456", width: 5 });
    setup.artistClient.emit("stroke:points", { points });
    setup.artistClient.emit("stroke:end");

    const strokeStart = await strokeStartPromise;
    const strokePoints = await strokePointsPromise;
    await strokeEndPromise;

    expect(strokeStart.playerId).toBe(setup.artistPlayerId);
    expect(strokeStart.color).toBe("#123456");
    expect(strokePoints.points).toEqual(points);

    const room = rooms.get(roomId);
    expect(room?.drawingState.completedStrokes).toHaveLength(1);
    expect(room?.drawingState.completedStrokes[0]?.points).toEqual(points);
    expect(room?.drawingState.activeStroke).toBeNull();
  });

  it("should block drawing events when sent by a non-artist", async () => {
    const roomId = await createRoomAndJoinWithBobAndSally();
    const setup = await startGameAndSelectFirstWord(
      roomId,
      clientSocketBob,
      clientSocketSally,
      bobPlayerId,
      sallyPlayerId
    );

    let artistReceivedStrokeStart = false;
    setup.artistClient.once("stroke:start", () => {
      artistReceivedStrokeStart = true;
    });

    setup.nonArtistClient.emit("stroke:start", { color: "#000000", width: 4 });
    setup.nonArtistClient.emit("stroke:points", {
      points: [
        [0.2, 0.2],
        [0.6, 0.6],
      ],
    });
    setup.nonArtistClient.emit("stroke:end");

    await wait(100);

    const room = rooms.get(roomId);
    expect(room?.drawingState.activeStroke).toBeNull();
    expect(room?.drawingState.completedStrokes).toHaveLength(0);
    expect(artistReceivedStrokeStart).toBe(false);
  });

  it("should allow only the artist to undo and clear canvas", async () => {
    const roomId = await createRoomAndJoinWithBobAndSally();
    const setup = await startGameAndSelectFirstWord(
      roomId,
      clientSocketBob,
      clientSocketSally,
      bobPlayerId,
      sallyPlayerId
    );

    const drawSingleStroke = (startX: number, startY: number) => {
      setup.artistClient.emit("stroke:start", { color: "#000000", width: 4 });
      setup.artistClient.emit("stroke:points", {
        points: [
          [startX, startY],
          [startX + 0.1, startY + 0.1],
        ],
      });
      setup.artistClient.emit("stroke:end");
    };

    drawSingleStroke(0.1, 0.1);
    drawSingleStroke(0.4, 0.4);
    await wait(50);

    expect(rooms.get(roomId)?.drawingState.completedStrokes).toHaveLength(2);

    setup.nonArtistClient.emit("canvas:undo");
    await wait(50);
    expect(rooms.get(roomId)?.drawingState.completedStrokes).toHaveLength(2);

    const canvasSyncPromise = waitForEvent<{
      completedStrokes: unknown[];
      activeStroke: unknown | null;
    }>(setup.nonArtistClient, "canvas:sync");
    setup.artistClient.emit("canvas:undo");

    const canvasSync = await canvasSyncPromise;
    expect(canvasSync.completedStrokes).toHaveLength(1);
    expect(rooms.get(roomId)?.drawingState.completedStrokes).toHaveLength(1);

    const canvasClearPromise = waitForEvent(setup.nonArtistClient, "canvas:clear");
    setup.artistClient.emit("canvas:clear");
    await canvasClearPromise;

    const room = rooms.get(roomId);
    expect(room?.drawingState.completedStrokes).toHaveLength(0);
    expect(room?.drawingState.activeStroke).toBeNull();
  });

  it("should sync canvas and private word state when rejoining during drawing", async () => {
    await setupUser(clientSocketBob, "Bob", bobPlayerId);
    const { client: charlieClient, playerId: charliePlayerId } = await createExtraClientWithUser(
      "Charlie"
    );

    const createResponse = await emitWithAck<RoomResponse>(clientSocketBob, "room:create", {});
    expect(createResponse.success).toBe(true);
    if (!createResponse.success) return;

    const roomId = createResponse.room.id;
    const joinResponse = await emitWithAck<RoomResponse>(charlieClient, "room:join", roomId);
    expect(joinResponse.success).toBe(true);

    const setup = await startGameAndSelectFirstWord(
      roomId,
      clientSocketBob,
      charlieClient,
      bobPlayerId,
      charliePlayerId
    );

    setup.artistClient.emit("stroke:start", { color: "#ff0000", width: 3 });
    setup.artistClient.emit("stroke:points", {
      points: [
        [0.15, 0.2],
        [0.45, 0.55],
      ],
    });
    setup.artistClient.emit("stroke:end");
    await wait(50);

    const { client: replacementCharlie } = await createExtraClientWithUser("Charlie", charliePlayerId);

    const canvasSyncPromise = waitForEvent<{
      completedStrokes: Array<{ points: Point[] }>;
      activeStroke: unknown | null;
    }>(replacementCharlie, "canvas:sync");

    const expectedMask = setup.chosenWord.replace(/[^ ]/g, "_");
    const maskPromise = waitForEvent<{ maskedWord: string }>(replacementCharlie, "word:mask");

    const replacementJoinResponse = await emitWithAck<RoomResponse>(
      replacementCharlie,
      "room:join",
      roomId
    );
    expect(replacementJoinResponse.success).toBe(true);

    const canvasSync = await canvasSyncPromise;
    const mask = await maskPromise;

    expect(canvasSync.completedStrokes).toHaveLength(1);
    expect(canvasSync.completedStrokes[0]?.points).toEqual([
      [0.15, 0.2],
      [0.45, 0.55],
    ]);
    expect(mask.maskedWord).toBe(expectedMask);

    const room = rooms.get(roomId);
    const charlieCount = Array.from(room?.players.values() || []).filter(
      (player) => player.playerId === charliePlayerId
    ).length;
    expect(charlieCount).toBe(1);
  });

  it("should resend word choices when the artist rejoins during word-selection", async () => {
    await setupUser(clientSocketBob, "Bob", bobPlayerId);
    const { client: charlieClient } = await createExtraClientWithUser("Charlie");

    const createResponse = await emitWithAck<RoomResponse>(clientSocketBob, "room:create", {});
    expect(createResponse.success).toBe(true);
    if (!createResponse.success) return;

    const roomId = createResponse.room.id;
    const joinResponse = await emitWithAck<RoomResponse>(charlieClient, "room:join", roomId);
    expect(joinResponse.success).toBe(true);

    const initialChoicePromise = waitForEvent<{ words: string[] }>(clientSocketBob, "word:choice");
    const startResponse = await emitWithAck<SimpleResponse>(clientSocketBob, "game:start", roomId);
    expect(startResponse.success).toBe(true);

    const initialChoice = await initialChoicePromise;

    const { client: replacementBob } = await createExtraClientWithUser("Bob", bobPlayerId);
    const replacementChoicePromise = waitForEvent<{ words: string[] }>(
      replacementBob,
      "word:choice"
    );

    const replacementJoinResponse = await emitWithAck<RoomResponse>(
      replacementBob,
      "room:join",
      roomId
    );
    expect(replacementJoinResponse.success).toBe(true);

    const replacementChoice = await replacementChoicePromise;
    expect(replacementChoice.words).toEqual(initialChoice.words);

    const room = rooms.get(roomId);
    const bobCount = Array.from(room?.players.values() || []).filter(
      (player) => player.playerId === bobPlayerId
    ).length;
    expect(bobCount).toBe(1);
  });

  it("should keep disconnected lobby players during grace period and allow clean rejoin", async () => {
    await setupUser(clientSocketBob, "Bob", bobPlayerId);
    const { client: charlieClient, playerId: charliePlayerId } = await createExtraClientWithUser(
      "Charlie"
    );

    const createResponse = await emitWithAck<RoomResponse>(clientSocketBob, "room:create", {});
    expect(createResponse.success).toBe(true);
    if (!createResponse.success) return;

    const roomId = createResponse.room.id;
    const joinResponse = await emitWithAck<RoomResponse>(charlieClient, "room:join", roomId);
    expect(joinResponse.success).toBe(true);

    const disconnectedSocketId = charlieClient.id;
    charlieClient.disconnect();
    await wait(100);

    const roomDuringGrace = rooms.get(roomId);
    expect(roomDuringGrace?.players.has(disconnectedSocketId!)).toBe(true);

    const { client: replacementCharlie } = await createExtraClientWithUser("Charlie", charliePlayerId);
    const replacementJoinResponse = await emitWithAck<RoomResponse>(
      replacementCharlie,
      "room:join",
      roomId
    );
    expect(replacementJoinResponse.success).toBe(true);

    const roomAfterReconnect = rooms.get(roomId);
    const charlieCount = Array.from(roomAfterReconnect?.players.values() || []).filter(
      (player) => player.playerId === charliePlayerId
    ).length;
    expect(charlieCount).toBe(1);
  });

  it("should allow reconnect after disconnect during drawing phase", async () => {
    await setupUser(clientSocketBob, "Bob", bobPlayerId);
    const { client: charlieClient, playerId: charliePlayerId } = await createExtraClientWithUser(
      "Charlie"
    );

    const createResponse = await emitWithAck<RoomResponse>(clientSocketBob, "room:create", {});
    expect(createResponse.success).toBe(true);
    if (!createResponse.success) return;

    const roomId = createResponse.room.id;
    const joinResponse = await emitWithAck<RoomResponse>(charlieClient, "room:join", roomId);
    expect(joinResponse.success).toBe(true);

    const setup = await startGameAndSelectFirstWord(
      roomId,
      clientSocketBob,
      charlieClient,
      bobPlayerId,
      charliePlayerId
    );

    expect(setup.nonArtistPlayerId).toBe(charliePlayerId);

    setup.nonArtistClient.disconnect();
    await wait(100);

    const { client: replacementCharlie } = await createExtraClientWithUser("Charlie", charliePlayerId);
    const canvasSyncPromise = waitForEvent<{ completedStrokes: unknown[] }>(
      replacementCharlie,
      "canvas:sync"
    );
    const wordMaskPromise = waitForEvent<{ maskedWord: string }>(replacementCharlie, "word:mask");

    const replacementJoinResponse = await emitWithAck<RoomResponse>(
      replacementCharlie,
      "room:join",
      roomId
    );
    expect(replacementJoinResponse.success).toBe(true);

    await canvasSyncPromise;
    await wordMaskPromise;

    const room = rooms.get(roomId);
    expect(room?.phase).toBe("drawing");

    const charlieCount = Array.from(room?.players.values() || []).filter(
      (player) => player.playerId === charliePlayerId
    ).length;
    expect(charlieCount).toBe(1);
  });
});
