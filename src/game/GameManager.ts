import type { Server } from "socket.io";
import type { FinalStanding, Room, User } from "../types/main.types.js";
import { rooms, convertRoom, deleteRoom } from "../room/rooms.js";
import { WORD_LIST } from "./wordList.js";

type Timer = ReturnType<typeof setTimeout>;

interface DisconnectGraceState {
  socketId: string;
  skipTimer: Timer | null;
  removalTimer: Timer | null;
}

interface GameState {
  artistQueue: string[]; // playerIds in drawing order
  currentArtistIndex: number;
  currentWord: string | null;
  maskedWord: string | null;
  wordChoices: string[];
  usedWordKeys: Set<string>;
  revealedHintIndices: Set<number>;
  hintTimers: Timer[];
  timer: Timer | null;
  timerEndsAt: number | null;
  disconnectedPlayers: Map<string, DisconnectGraceState>; // key: playerId
}

class GameManager {
  private static instance: GameManager;
  private games: Map<string, GameState> = new Map();
  private io: Server | null = null;

  private constructor() {}

  static getInstance(): GameManager {
    if (!GameManager.instance) {
      GameManager.instance = new GameManager();
    }
    return GameManager.instance;
  }

  setIO(io: Server): void {
    this.io = io;
  }

  startGame(roomId: string): { success: boolean; error?: string } {
    const room = rooms.get(roomId);
    if (!room) return { success: false, error: "room not found" };
    if (room.players.size < 2) return { success: false, error: "need at least 2 players to start" };
    if (room.phase !== "lobby") return { success: false, error: "game already started" };

    // New game starts with fresh scores.
    for (const player of room.players.values()) {
      player.score = 0;
    }

    const queue = this.buildArtistQueue(room);

    const gameState: GameState = {
      artistQueue: queue,
      currentArtistIndex: 0,
      currentWord: null,
      maskedWord: null,
      wordChoices: [],
      usedWordKeys: new Set<string>(),
      revealedHintIndices: new Set<number>(),
      hintTimers: [],
      timer: null,
      timerEndsAt: null,
      disconnectedPlayers: new Map<string, DisconnectGraceState>(),
    };

    this.games.set(roomId, gameState);
    room.currentRound = 1;

    this.startWordSelection(roomId);
    return { success: true };
  }

  endGame(roomId: string): void {
    const room = rooms.get(roomId);
    const gameState = this.games.get(roomId);
    if (!room || !gameState) return;

    this.clearTimer(roomId);
    this.clearHintTimers(gameState);
    this.clearDisconnectTimers(gameState);

    const finalStandings: FinalStanding[] = Array.from(room.players.values())
      .map((player) => ({
        playerId: player.playerId,
        username: player.username,
        score: player.score,
      }))
      .sort((a, b) => b.score - a.score);

    room.phase = "lobby";
    room.currentRound = 0;
    room.drawingState.currentArtist = null;
    room.drawingState.correctlyGuessed = [];
    room.drawingState.startedAt = null;
    room.drawingState.completedStrokes = [];
    room.drawingState.activeStroke = null;

    this.io?.to(roomId).emit("canvas:clear");
    this.io?.to(roomId).emit("game:end", { finalStandings });
    this.games.delete(roomId);

    this.broadcastRoomUpdate(roomId);
  }

  private startWordSelection(roomId: string): void {
    const room = rooms.get(roomId);
    const gameState = this.games.get(roomId);
    if (!room || !gameState) return;

    if (gameState.artistQueue.length === 0) {
      this.endGame(roomId);
      return;
    }

    const artistPlayerId = gameState.artistQueue[gameState.currentArtistIndex];

    if (!this.isPlayerConnected(room, artistPlayerId)) {
      this.advanceToNextTurn(roomId);
      return;
    }

    room.phase = "word-selection";
    room.drawingState.currentArtist = artistPlayerId;
    room.drawingState.correctlyGuessed = [];
    room.drawingState.startedAt = null;

    room.drawingState.completedStrokes = [];
    room.drawingState.activeStroke = null;

    this.clearHintTimers(gameState);
    gameState.currentWord = null;
    gameState.maskedWord = null;
    gameState.revealedHintIndices.clear();
    gameState.wordChoices = this.pickRandomWords(room.config.wordSelectionSize, gameState.usedWordKeys);

    console.log(`Starting word selection for room ${roomId}, artist: ${artistPlayerId}`);
    console.log(`Word choices: ${gameState.wordChoices}`);

    this.broadcastRoomUpdate(roomId);

    this.io?.to(roomId).emit("canvas:clear");

    this.io?.to(roomId).emit("round:start", {
      round: room.currentRound,
      artistId: artistPlayerId,
    });

    const artistSocketId = this.getSocketIdByPlayerId(room, artistPlayerId);
    if (artistSocketId) {
      this.io?.to(artistSocketId).emit("word:choice", { words: gameState.wordChoices });
    }

    this.startTimer(roomId, room.config.wordChoiceTimer, () => {
      const fallbackWord = gameState.wordChoices[0];
      if (fallbackWord) {
        this.selectWord(roomId, artistPlayerId, fallbackWord);
      } else {
        this.advanceToNextTurn(roomId);
      }
    });
  }

  selectWord(roomId: string, playerId: string, word: string): string | null {
    const room = rooms.get(roomId);
    const gameState = this.games.get(roomId);
    if (!room || !gameState) return null;
    if (room.phase !== "word-selection") return null;
    if (room.drawingState.currentArtist !== playerId) return null;

    const matchingChoice = gameState.wordChoices.find((choice) => choice.toLowerCase() === word.toLowerCase());
    if (!matchingChoice) return null;

    this.clearTimer(roomId);

    gameState.currentWord = matchingChoice;
    gameState.usedWordKeys.add(matchingChoice.toLowerCase());
    gameState.revealedHintIndices.clear();
    gameState.maskedWord = this.maskWord(matchingChoice);

    this.io?.to(roomId).emit("word:mask", { maskedWord: gameState.maskedWord });

    const artistSocketId = this.getSocketIdByPlayerId(room, playerId);
    if (artistSocketId) {
      this.io?.to(artistSocketId).emit("word:selected", { word: matchingChoice });
    }

    this.startDrawingPhase(roomId);
    return matchingChoice;
  }

  private startDrawingPhase(roomId: string): void {
    const room = rooms.get(roomId);
    const gameState = this.games.get(roomId);
    if (!room || !gameState) return;

    room.phase = "drawing";
    room.drawingState.startedAt = Date.now();

    this.broadcastRoomUpdate(roomId);

    this.scheduleHintReveals(roomId, room.config.drawTimer);

    this.startTimer(roomId, room.config.drawTimer, () => {
      this.endRound(roomId);
    });
  }

  private endRound(roomId: string): void {
    const room = rooms.get(roomId);
    const gameState = this.games.get(roomId);
    if (!room || !gameState) return;
    if (room.phase !== "drawing") return;

    this.clearTimer(roomId);
    this.clearHintTimers(gameState);
    room.phase = "round-end";

    const scores: Record<string, number> = {};
    for (const player of room.players.values()) {
      scores[player.playerId] = player.score;
    }

    this.io?.to(roomId).emit("round:end", {
      word: gameState.currentWord || "",
      scores,
    });

    this.broadcastRoomUpdate(roomId);

    setTimeout(() => this.advanceToNextTurn(roomId), 3000);
  }

  private advanceToNextTurn(roomId: string): void {
    const room = rooms.get(roomId);
    const gameState = this.games.get(roomId);
    if (!room || !gameState) return;

    if (gameState.artistQueue.length === 0) {
      this.endGame(roomId);
      return;
    }

    const queueLength = gameState.artistQueue.length;
    let attempts = 0;

    do {
      gameState.currentArtistIndex++;

      if (gameState.currentArtistIndex >= queueLength) {
        gameState.currentArtistIndex = 0;
        room.currentRound++;

        if (room.currentRound > room.config.numberOfRounds) {
          this.endGame(roomId);
          return;
        }
      }

      attempts++;
      if (attempts >= queueLength) break;
    } while (!this.isPlayerConnected(room, gameState.artistQueue[gameState.currentArtistIndex]));

    this.startWordSelection(roomId);
  }

  checkGuess(roomId: string, playerId: string, guess: string): boolean {
    const room = rooms.get(roomId);
    const gameState = this.games.get(roomId);
    if (!room || room.phase !== "drawing" || !gameState) return false;
    if (room.drawingState.currentArtist === playerId) return false;

    const alreadyGuessed = room.drawingState.correctlyGuessed.some((u) => u.playerId === playerId);
    if (alreadyGuessed) return false;

    const isCorrect = guess.toLowerCase().trim() === gameState.currentWord?.toLowerCase();
    if (!isCorrect) return false;

    const player = this.getUserByPlayerId(room, playerId);
    if (!player) return false;

    const pointsEarned = this.calculatePoints(room);
    player.score += pointsEarned;
    room.drawingState.correctlyGuessed.push(player);

    this.io?.to(roomId).emit("guess:correct", {
      playerId,
      username: player.username,
    });

    this.broadcastRoomUpdate(roomId);

    const nonArtistCount = Math.max(0, room.players.size - 1);
    if (room.drawingState.correctlyGuessed.length >= nonArtistCount) {
      this.endRound(roomId);
    }

    return true;
  }

  private startTimer(roomId: string, duration: number, onComplete: () => void): void {
    const gameState = this.games.get(roomId);
    if (!gameState) return;

    gameState.timerEndsAt = Date.now() + duration;
    gameState.timer = setTimeout(onComplete, duration);

    this.syncTimer(roomId);
  }

  private clearTimer(roomId: string): void {
    const gameState = this.games.get(roomId);
    if (!gameState?.timer) return;

    clearTimeout(gameState.timer);
    gameState.timer = null;
    gameState.timerEndsAt = null;
  }

  private syncTimer(roomId: string): void {
    const room = rooms.get(roomId);
    const gameState = this.games.get(roomId);
    if (!room || !gameState?.timerEndsAt) return;

    const remaining = Math.max(0, gameState.timerEndsAt - Date.now());
    this.io?.to(roomId).emit("timer:sync", { remaining, phase: room.phase });
  }

  syncTimerToSocket(roomId: string, socketId: string): void {
    const room = rooms.get(roomId);
    const gameState = this.games.get(roomId);
    if (!room || !gameState?.timerEndsAt) return;

    const remaining = Math.max(0, gameState.timerEndsAt - Date.now());
    this.io?.to(socketId).emit("timer:sync", { remaining, phase: room.phase });
  }

  private broadcastRoomUpdate(roomId: string): void {
    const room = rooms.get(roomId);
    if (!room) return;
    this.io?.to(roomId).emit("room:update", convertRoom(room));
  }

  private calculatePoints(room: Room): number {
    const elapsed = Date.now() - (room.drawingState.startedAt || Date.now());
    const maxTime = room.config.drawTimer;
    const timeRatio = 1 - elapsed / maxTime;
    return Math.round(100 + 400 * timeRatio);
  }

  private pickRandomWords(count: number, usedWordKeys: Set<string>): string[] {
    const freshWords = WORD_LIST.filter((word) => !usedWordKeys.has(word.toLowerCase()));
    const source = freshWords.length >= count ? freshWords : WORD_LIST;
    return this.shuffleArray(source).slice(0, Math.min(count, source.length));
  }

  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  private maskWord(word: string): string {
    return word
      .split("")
      .map((char) => (char === " " ? " " : "_"))
      .join("");
  }

  private getHintSchedule(drawTimerMs: number): number[] {
    if (drawTimerMs >= 45_000) {
      return [15_000, 30_000, 45_000];
    }

    return [0.25, 0.5, 0.75].map((ratio) => Math.max(0, Math.round(drawTimerMs * ratio)));
  }

  private getRevealableIndices(word: string, revealedHintIndices: Set<number>): number[] {
    const indices: number[] = [];

    for (let i = 0; i < word.length; i++) {
      if (word[i] === " ") continue;
      if (revealedHintIndices.has(i)) continue;
      indices.push(i);
    }

    return indices;
  }

  private isHintIndexSeparated(index: number, revealedHintIndices: Set<number>): boolean {
    for (const revealedIndex of revealedHintIndices) {
      if (Math.abs(index - revealedIndex) <= 1) {
        return false;
      }
    }

    return true;
  }

  private pickHintIndex(word: string, revealedHintIndices: Set<number>): number | null {
    const remaining = this.getRevealableIndices(word, revealedHintIndices);
    if (remaining.length === 0) return null;

    const nonAdjacent = remaining.filter((index) =>
      this.isHintIndexSeparated(index, revealedHintIndices)
    );

    const pool = nonAdjacent.length > 0 ? nonAdjacent : remaining;
    const randomIndex = Math.floor(Math.random() * pool.length);
    return pool[randomIndex] ?? null;
  }

  private applyHintReveal(maskedWord: string, word: string, index: number): string {
    const maskedChars = maskedWord.split("");
    maskedChars[index] = word[index] ?? maskedChars[index];
    return maskedChars.join("");
  }

  private revealHint(roomId: string): void {
    const room = rooms.get(roomId);
    const gameState = this.games.get(roomId);
    if (!room || !gameState) return;
    if (room.phase !== "drawing") return;
    if (!gameState.currentWord || !gameState.maskedWord) return;

    const revealIndex = this.pickHintIndex(gameState.currentWord, gameState.revealedHintIndices);
    if (revealIndex === null) return;

    gameState.revealedHintIndices.add(revealIndex);
    gameState.maskedWord = this.applyHintReveal(
      gameState.maskedWord,
      gameState.currentWord,
      revealIndex
    );

    this.io?.to(roomId).emit("word:mask", { maskedWord: gameState.maskedWord });
  }

  private scheduleHintReveals(roomId: string, drawTimerMs: number): void {
    const gameState = this.games.get(roomId);
    if (!gameState) return;

    this.clearHintTimers(gameState);

    const schedule = this.getHintSchedule(drawTimerMs);
    for (const delayMs of schedule) {
      const timer = setTimeout(() => {
        this.revealHint(roomId);
      }, delayMs);
      gameState.hintTimers.push(timer);
    }
  }

  private clearHintTimers(gameState: GameState): void {
    for (const timer of gameState.hintTimers) {
      clearTimeout(timer);
    }
    gameState.hintTimers = [];
  }

  private buildArtistQueue(room: Room): string[] {
    const seen = new Set<string>();
    const queue: string[] = [];

    for (const player of room.players.values()) {
      if (seen.has(player.playerId)) continue;
      seen.add(player.playerId);
      queue.push(player.playerId);
    }

    return queue;
  }

  private getUserByPlayerId(room: Room, playerId: string): User | null {
    for (const player of room.players.values()) {
      if (player.playerId === playerId) return player;
    }
    return null;
  }

  private getSocketIdByPlayerId(room: Room, playerId: string): string | null {
    for (const [socketId, player] of room.players) {
      if (player.playerId === playerId) return socketId;
    }
    return null;
  }

  private isPlayerConnected(room: Room, playerId: string): boolean {
    const socketId = this.getSocketIdByPlayerId(room, playerId);
    if (!socketId) return false;
    return this.io?.sockets.sockets.has(socketId) ?? false;
  }

  private clearDisconnectTimers(gameState: GameState): void {
    for (const graceState of gameState.disconnectedPlayers.values()) {
      if (graceState.skipTimer) clearTimeout(graceState.skipTimer);
      if (graceState.removalTimer) clearTimeout(graceState.removalTimer);
    }
    gameState.disconnectedPlayers.clear();
  }

  clearGame(roomId: string): void {
    const gameState = this.games.get(roomId);
    if (!gameState) return;

    if (gameState.timer) {
      clearTimeout(gameState.timer);
    }

    this.clearHintTimers(gameState);
    this.clearDisconnectTimers(gameState);

    this.games.delete(roomId);
    console.log(`Cleared game state for room ${roomId}`);
  }

  clearAllGames(): void {
    for (const [_, gameState] of this.games) {
      if (gameState.timer) {
        clearTimeout(gameState.timer);
      }
      this.clearHintTimers(gameState);
      this.clearDisconnectTimers(gameState);
    }
    this.games.clear();
  }

  handlePlayerLeave(roomId: string, playerId: string): void {
    const room = rooms.get(roomId);
    const gameState = this.games.get(roomId);
    if (!room || !gameState) return;

    const disconnectGrace = gameState.disconnectedPlayers.get(playerId);
    if (disconnectGrace?.skipTimer) clearTimeout(disconnectGrace.skipTimer);
    if (disconnectGrace?.removalTimer) clearTimeout(disconnectGrace.removalTimer);
    gameState.disconnectedPlayers.delete(playerId);

    if (room.drawingState.currentArtist === playerId) {
      if (room.phase === "word-selection") {
        this.clearTimer(roomId);
        this.clearHintTimers(gameState);
        this.advanceToNextTurn(roomId);
      } else if (room.phase === "drawing") {
        this.endRound(roomId);
      }
    }

    const removedIndex = gameState.artistQueue.findIndex((id) => id === playerId);
    if (removedIndex !== -1) {
      gameState.artistQueue.splice(removedIndex, 1);

      if (removedIndex <= gameState.currentArtistIndex) {
        gameState.currentArtistIndex -= 1;
      }

      if (gameState.currentArtistIndex >= gameState.artistQueue.length) {
        gameState.currentArtistIndex = gameState.artistQueue.length - 1;
      }
    }

    if (room.players.size < 2) {
      this.endGame(roomId);
      return;
    }

    this.broadcastRoomUpdate(roomId);
  }

  handlePlayerDisconnect(roomId: string, playerId: string, socketId: string): void {
    const room = rooms.get(roomId);
    const gameState = this.games.get(roomId);
    if (!room || !gameState) return;

    const existing = gameState.disconnectedPlayers.get(playerId);
    if (existing?.skipTimer) clearTimeout(existing.skipTimer);
    if (existing?.removalTimer) clearTimeout(existing.removalTimer);

    const graceState: DisconnectGraceState = {
      socketId,
      skipTimer: null,
      removalTimer: null,
    };

    if (room.drawingState.currentArtist === playerId) {
      graceState.skipTimer = setTimeout(() => {
        const latestRoom = rooms.get(roomId);
        const latestGame = this.games.get(roomId);
        if (!latestRoom || !latestGame) return;

        const tracked = latestGame.disconnectedPlayers.get(playerId);
        if (!tracked || tracked.socketId !== socketId) return;

        if (latestRoom.drawingState.currentArtist !== playerId) return;

        if (latestRoom.phase === "word-selection") {
          this.clearTimer(roomId);
          this.advanceToNextTurn(roomId);
        } else if (latestRoom.phase === "drawing") {
          this.endRound(roomId);
        }
      }, 10_000);
    }

    graceState.removalTimer = setTimeout(() => {
      this.removeDisconnectedPlayer(roomId, playerId, socketId);
    }, 60_000);

    gameState.disconnectedPlayers.set(playerId, graceState);
  }

  handlePlayerReconnect(roomId: string, playerId: string): void {
    const gameState = this.games.get(roomId);
    if (!gameState) return;

    const graceState = gameState.disconnectedPlayers.get(playerId);
    if (!graceState) return;

    if (graceState.skipTimer) clearTimeout(graceState.skipTimer);
    if (graceState.removalTimer) clearTimeout(graceState.removalTimer);

    gameState.disconnectedPlayers.delete(playerId);
  }

  syncPrivateStateToPlayer(roomId: string, playerId: string, socketId: string): void {
    const room = rooms.get(roomId);
    const gameState = this.games.get(roomId);
    if (!room || !gameState) return;

    if (room.phase === "word-selection" && room.drawingState.currentArtist === playerId) {
      this.io?.to(socketId).emit("word:choice", { words: gameState.wordChoices });
      return;
    }

    if (!gameState.currentWord) return;

    if (room.drawingState.currentArtist === playerId) {
      this.io?.to(socketId).emit("word:selected", { word: gameState.currentWord });
      return;
    }

    this.io?.to(socketId).emit("word:mask", {
      maskedWord: gameState.maskedWord ?? this.maskWord(gameState.currentWord),
    });
  }

  private removeDisconnectedPlayer(roomId: string, playerId: string, socketId: string): void {
    const room = rooms.get(roomId);
    const gameState = this.games.get(roomId);
    if (!room || !gameState) return;

    const trackedGrace = gameState.disconnectedPlayers.get(playerId);
    if (!trackedGrace || trackedGrace.socketId !== socketId) return;

    const player = room.players.get(socketId);
    if (!player || player.playerId !== playerId) {
      gameState.disconnectedPlayers.delete(playerId);
      return;
    }

    room.players.delete(socketId);

    if (room.creator === socketId) {
      const newCreator = room.players.keys().next().value;
      if (newCreator) {
        room.creator = newCreator;
      }
    }

    gameState.disconnectedPlayers.delete(playerId);

    this.handlePlayerLeave(roomId, playerId);

    if (room.players.size === 0) {
      deleteRoom(roomId);
      return;
    }

    this.io?.to(roomId).emit("user:left", socketId);
  }
}

export const gameManager = GameManager.getInstance();
