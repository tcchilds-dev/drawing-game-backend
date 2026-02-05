import type { Server } from "socket.io";
import type { Room } from "../types/main.types.js";
import { rooms, convertRoom } from "../room/rooms.js";

type Timer = ReturnType<typeof setTimeout>;

interface GameState {
  artistQueue: string[]; // players IDs in drawing order
  currentArtistIndex: number;
  currentWord: string | null;
  wordChoices: string[];
  timer: Timer | null;
  timerEndsAt: number | null;
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

  // Call once during server setup
  setIO(io: Server): void {
    this.io = io;
  }

  // --- Game Lifecycle ---

  startGame(roomId: string): { success: boolean; error?: string } {
    const room = rooms.get(roomId);
    if (!room) return { success: false, error: "room not found" };
    if (room.players.size < 2) return { success: false, error: "need at least 2 players to start" };
    if (room.phase !== "lobby") return { success: false, error: "game already started" };

    const playerIds = Array.from(room.players.keys());
    const gameState: GameState = {
      artistQueue: playerIds,
      currentArtistIndex: 0,
      currentWord: null,
      wordChoices: [],
      timer: null,
      timerEndsAt: null,
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
    room.phase = "lobby";

    const finalScores: Record<string, number> = {};
    for (const [id, player] of room.players) {
      finalScores[id] = player.score;
    }

    this.io?.to(roomId).emit("game:end", { finalScores });
    this.games.delete(roomId);
  }

  // --- Phase Transitions ---

  private startWordSelection(roomId: string): void {
    const room = rooms.get(roomId);
    const gameState = this.games.get(roomId);
    if (!room || !gameState) return;

    const artistId = gameState.artistQueue[gameState.currentArtistIndex];

    room.phase = "word-selection";
    room.drawingState.currentArtist = artistId;
    room.drawingState.correctlyGuessed = [];

    room.drawingState.completedStrokes = [];
    room.drawingState.activeStroke = null;

    gameState.wordChoices = this.pickRandomWords(room.config.wordSelectionSize);

    console.log(`Starting word selection for room ${roomId}, artist: ${artistId}`);
    console.log(`Word choices: ${gameState.wordChoices}`);

    this.broadcastRoomUpdate(roomId);

    this.io?.to(roomId).emit("canvas:clear");

    this.io?.to(roomId).emit("round:start", {
      round: room.currentRound,
      artistId,
    });

    this.io?.to(artistId).emit("word:choice", { words: gameState.wordChoices });

    this.startTimer(roomId, room.config.wordChoiceTimer, () => {
      this.selectWord(roomId, artistId, gameState.wordChoices[0]);
    });
  }

  selectWord(roomId: string, playerId: string, word: string): string | null {
    const room = rooms.get(roomId);
    const gameState = this.games.get(roomId);
    if (!room || !gameState) return null;
    if (room.phase !== "word-selection") return null;
    if (room.drawingState.currentArtist !== playerId) return null;
    if (!gameState.wordChoices.includes(word)) return null;

    this.clearTimer(roomId);
    gameState.currentWord = word;
    this.startDrawingPhase(roomId);
    return word;
  }

  private startDrawingPhase(roomId: string): void {
    const room = rooms.get(roomId);
    if (!room) return;

    room.phase = "drawing";
    room.drawingState.startedAt = Date.now();

    this.broadcastRoomUpdate(roomId);

    this.startTimer(roomId, room.config.drawTimer, () => {
      this.endRound(roomId);
    });
  }

  private endRound(roomId: string): void {
    const room = rooms.get(roomId);
    const gameState = this.games.get(roomId);
    if (!room || !gameState) return;

    this.clearTimer(roomId);
    room.phase = "round-end";

    const scores: Record<string, number> = {};
    for (const [id, player] of room.players) {
      scores[id] = player.score;
    }

    this.io?.to(roomId).emit("round:end", {
      word: gameState.currentWord || "",
      scores,
    });

    // Brief pause before next round
    setTimeout(() => this.advanceToNextTurn(roomId), 3000);
  }

  private advanceToNextTurn(roomId: string): void {
    const room = rooms.get(roomId);
    const gameState = this.games.get(roomId);
    if (!room || !gameState) return;

    gameState.currentArtistIndex++;

    // Check if we've gone through all players this round
    if (gameState.currentArtistIndex >= gameState.artistQueue.length) {
      gameState.currentArtistIndex = 0;
      room.currentRound++;

      // Check if game is over
      if (room.currentRound > room.config.numberOfRounds) {
        this.endGame(roomId);
        return;
      }
    }

    this.startWordSelection(roomId);
  }

  checkGuess(roomId: string, playerId: string, guess: string): boolean {
    const room = rooms.get(roomId);
    const gameState = this.games.get(roomId);
    if (!room || room.phase !== "drawing" || !gameState) return false;
    if (room.drawingState.currentArtist === playerId) return false;

    const alreadyGuessed = room.drawingState.correctlyGuessed.some((u) => u.id === playerId);
    if (alreadyGuessed) return false;

    const isCorrect = guess.toLowerCase().trim() === gameState.currentWord?.toLowerCase();
    if (!isCorrect) return false;

    const player = room.players.get(playerId);
    if (!player) return false;

    const pointsEarned = this.calculatePoints(room);
    player.score += pointsEarned;
    room.drawingState.correctlyGuessed.push(player);

    this.io?.to(roomId).emit("guess:correct", {
      playerId,
      username: player.username,
    });

    // End round early if everyone guessed correctly
    const nonArtistCount = room.players.size - 1;
    if (room.drawingState.correctlyGuessed.length >= nonArtistCount) {
      this.endRound(roomId);
    }

    return true;
  }

  // --- Timer Helpers ---

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

  // --- Utility ---

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

  private pickRandomWords(count: number): string[] {
    // TODO: replace with actual word list
    const wordList = ["apple", "house", "guitar", "elephant", "pizza", "rocket", "wizard"];
    return this.shuffleArray(wordList).slice(0, count);
  }

  private shuffleArray<T>(array: T[]): T[] {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  clearGame(roomId: string): void {
    const gameState = this.games.get(roomId);
    if (!gameState) return;

    if (gameState.timer) {
      clearTimeout(gameState.timer);
    }
    this.games.delete(roomId);
    console.log(`Cleared game state for room ${roomId}`);
  }

  clearAllGames(): void {
    for (const [_, gameState] of this.games) {
      if (gameState.timer) {
        clearTimeout(gameState.timer);
      }
    }
    this.games.clear();
  }

  // --- Player Events ---

  handlePlayerLeave(roomId: string, playerId: string): void {
    const room = rooms.get(roomId);
    const gameState = this.games.get(roomId);
    if (!room || !gameState) return;

    // If current artist left, skip to next turn
    if (room.drawingState.currentArtist === playerId) {
      this.endRound(roomId);
    }

    // Remove from artist queue
    gameState.artistQueue = gameState.artistQueue.filter((id) => id !== playerId);

    // End game if not enough players
    if (room.players.size < 2) {
      this.endGame(roomId);
    }
  }
}

export const gameManager = GameManager.getInstance();
