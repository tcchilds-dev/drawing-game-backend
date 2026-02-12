import { rooms, convertRoom, deleteRoom } from "../room/rooms.js";
import { WORD_LIST } from "./wordList.js";
class GameManager {
    static instance;
    games = new Map();
    io = null;
    constructor() { }
    static getInstance() {
        if (!GameManager.instance) {
            GameManager.instance = new GameManager();
        }
        return GameManager.instance;
    }
    setIO(io) {
        this.io = io;
    }
    startGame(roomId) {
        const room = rooms.get(roomId);
        if (!room)
            return { success: false, error: "room not found" };
        if (room.players.size < 2)
            return { success: false, error: "need at least 2 players to start" };
        if (room.phase !== "lobby")
            return { success: false, error: "game already started" };
        // New game starts with fresh scores.
        for (const player of room.players.values()) {
            player.score = 0;
        }
        const queue = this.buildArtistQueue(room);
        const gameState = {
            artistQueue: queue,
            currentArtistIndex: 0,
            currentWord: null,
            wordChoices: [],
            usedWordKeys: new Set(),
            timer: null,
            timerEndsAt: null,
            disconnectedPlayers: new Map(),
        };
        this.games.set(roomId, gameState);
        room.currentRound = 1;
        this.startWordSelection(roomId);
        return { success: true };
    }
    endGame(roomId) {
        const room = rooms.get(roomId);
        const gameState = this.games.get(roomId);
        if (!room || !gameState)
            return;
        this.clearTimer(roomId);
        this.clearDisconnectTimers(gameState);
        const finalStandings = Array.from(room.players.values())
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
    startWordSelection(roomId) {
        const room = rooms.get(roomId);
        const gameState = this.games.get(roomId);
        if (!room || !gameState)
            return;
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
        gameState.currentWord = null;
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
            }
            else {
                this.advanceToNextTurn(roomId);
            }
        });
    }
    selectWord(roomId, playerId, word) {
        const room = rooms.get(roomId);
        const gameState = this.games.get(roomId);
        if (!room || !gameState)
            return null;
        if (room.phase !== "word-selection")
            return null;
        if (room.drawingState.currentArtist !== playerId)
            return null;
        const matchingChoice = gameState.wordChoices.find((choice) => choice.toLowerCase() === word.toLowerCase());
        if (!matchingChoice)
            return null;
        this.clearTimer(roomId);
        gameState.currentWord = matchingChoice;
        gameState.usedWordKeys.add(matchingChoice.toLowerCase());
        const maskedWord = this.maskWord(matchingChoice);
        this.io?.to(roomId).emit("word:mask", { maskedWord });
        const artistSocketId = this.getSocketIdByPlayerId(room, playerId);
        if (artistSocketId) {
            this.io?.to(artistSocketId).emit("word:selected", { word: matchingChoice });
        }
        this.startDrawingPhase(roomId);
        return matchingChoice;
    }
    startDrawingPhase(roomId) {
        const room = rooms.get(roomId);
        if (!room)
            return;
        room.phase = "drawing";
        room.drawingState.startedAt = Date.now();
        this.broadcastRoomUpdate(roomId);
        this.startTimer(roomId, room.config.drawTimer, () => {
            this.endRound(roomId);
        });
    }
    endRound(roomId) {
        const room = rooms.get(roomId);
        const gameState = this.games.get(roomId);
        if (!room || !gameState)
            return;
        if (room.phase !== "drawing")
            return;
        this.clearTimer(roomId);
        room.phase = "round-end";
        const scores = {};
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
    advanceToNextTurn(roomId) {
        const room = rooms.get(roomId);
        const gameState = this.games.get(roomId);
        if (!room || !gameState)
            return;
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
            if (attempts >= queueLength)
                break;
        } while (!this.isPlayerConnected(room, gameState.artistQueue[gameState.currentArtistIndex]));
        this.startWordSelection(roomId);
    }
    checkGuess(roomId, playerId, guess) {
        const room = rooms.get(roomId);
        const gameState = this.games.get(roomId);
        if (!room || room.phase !== "drawing" || !gameState)
            return false;
        if (room.drawingState.currentArtist === playerId)
            return false;
        const alreadyGuessed = room.drawingState.correctlyGuessed.some((u) => u.playerId === playerId);
        if (alreadyGuessed)
            return false;
        const isCorrect = guess.toLowerCase().trim() === gameState.currentWord?.toLowerCase();
        if (!isCorrect)
            return false;
        const player = this.getUserByPlayerId(room, playerId);
        if (!player)
            return false;
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
    startTimer(roomId, duration, onComplete) {
        const gameState = this.games.get(roomId);
        if (!gameState)
            return;
        gameState.timerEndsAt = Date.now() + duration;
        gameState.timer = setTimeout(onComplete, duration);
        this.syncTimer(roomId);
    }
    clearTimer(roomId) {
        const gameState = this.games.get(roomId);
        if (!gameState?.timer)
            return;
        clearTimeout(gameState.timer);
        gameState.timer = null;
        gameState.timerEndsAt = null;
    }
    syncTimer(roomId) {
        const room = rooms.get(roomId);
        const gameState = this.games.get(roomId);
        if (!room || !gameState?.timerEndsAt)
            return;
        const remaining = Math.max(0, gameState.timerEndsAt - Date.now());
        this.io?.to(roomId).emit("timer:sync", { remaining, phase: room.phase });
    }
    syncTimerToSocket(roomId, socketId) {
        const room = rooms.get(roomId);
        const gameState = this.games.get(roomId);
        if (!room || !gameState?.timerEndsAt)
            return;
        const remaining = Math.max(0, gameState.timerEndsAt - Date.now());
        this.io?.to(socketId).emit("timer:sync", { remaining, phase: room.phase });
    }
    broadcastRoomUpdate(roomId) {
        const room = rooms.get(roomId);
        if (!room)
            return;
        this.io?.to(roomId).emit("room:update", convertRoom(room));
    }
    calculatePoints(room) {
        const elapsed = Date.now() - (room.drawingState.startedAt || Date.now());
        const maxTime = room.config.drawTimer;
        const timeRatio = 1 - elapsed / maxTime;
        return Math.round(100 + 400 * timeRatio);
    }
    pickRandomWords(count, usedWordKeys) {
        const freshWords = WORD_LIST.filter((word) => !usedWordKeys.has(word.toLowerCase()));
        const source = freshWords.length >= count ? freshWords : WORD_LIST;
        return this.shuffleArray(source).slice(0, Math.min(count, source.length));
    }
    shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }
    maskWord(word) {
        return word
            .split("")
            .map((char) => (char === " " ? " " : "_"))
            .join("");
    }
    buildArtistQueue(room) {
        const seen = new Set();
        const queue = [];
        for (const player of room.players.values()) {
            if (seen.has(player.playerId))
                continue;
            seen.add(player.playerId);
            queue.push(player.playerId);
        }
        return queue;
    }
    getUserByPlayerId(room, playerId) {
        for (const player of room.players.values()) {
            if (player.playerId === playerId)
                return player;
        }
        return null;
    }
    getSocketIdByPlayerId(room, playerId) {
        for (const [socketId, player] of room.players) {
            if (player.playerId === playerId)
                return socketId;
        }
        return null;
    }
    isPlayerConnected(room, playerId) {
        const socketId = this.getSocketIdByPlayerId(room, playerId);
        if (!socketId)
            return false;
        return this.io?.sockets.sockets.has(socketId) ?? false;
    }
    clearDisconnectTimers(gameState) {
        for (const graceState of gameState.disconnectedPlayers.values()) {
            if (graceState.skipTimer)
                clearTimeout(graceState.skipTimer);
            if (graceState.removalTimer)
                clearTimeout(graceState.removalTimer);
        }
        gameState.disconnectedPlayers.clear();
    }
    clearGame(roomId) {
        const gameState = this.games.get(roomId);
        if (!gameState)
            return;
        if (gameState.timer) {
            clearTimeout(gameState.timer);
        }
        this.clearDisconnectTimers(gameState);
        this.games.delete(roomId);
        console.log(`Cleared game state for room ${roomId}`);
    }
    clearAllGames() {
        for (const [_, gameState] of this.games) {
            if (gameState.timer) {
                clearTimeout(gameState.timer);
            }
            this.clearDisconnectTimers(gameState);
        }
        this.games.clear();
    }
    handlePlayerLeave(roomId, playerId) {
        const room = rooms.get(roomId);
        const gameState = this.games.get(roomId);
        if (!room || !gameState)
            return;
        const disconnectGrace = gameState.disconnectedPlayers.get(playerId);
        if (disconnectGrace?.skipTimer)
            clearTimeout(disconnectGrace.skipTimer);
        if (disconnectGrace?.removalTimer)
            clearTimeout(disconnectGrace.removalTimer);
        gameState.disconnectedPlayers.delete(playerId);
        if (room.drawingState.currentArtist === playerId) {
            if (room.phase === "word-selection") {
                this.clearTimer(roomId);
                this.advanceToNextTurn(roomId);
            }
            else if (room.phase === "drawing") {
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
    handlePlayerDisconnect(roomId, playerId, socketId) {
        const room = rooms.get(roomId);
        const gameState = this.games.get(roomId);
        if (!room || !gameState)
            return;
        const existing = gameState.disconnectedPlayers.get(playerId);
        if (existing?.skipTimer)
            clearTimeout(existing.skipTimer);
        if (existing?.removalTimer)
            clearTimeout(existing.removalTimer);
        const graceState = {
            socketId,
            skipTimer: null,
            removalTimer: null,
        };
        if (room.drawingState.currentArtist === playerId) {
            graceState.skipTimer = setTimeout(() => {
                const latestRoom = rooms.get(roomId);
                const latestGame = this.games.get(roomId);
                if (!latestRoom || !latestGame)
                    return;
                const tracked = latestGame.disconnectedPlayers.get(playerId);
                if (!tracked || tracked.socketId !== socketId)
                    return;
                if (latestRoom.drawingState.currentArtist !== playerId)
                    return;
                if (latestRoom.phase === "word-selection") {
                    this.clearTimer(roomId);
                    this.advanceToNextTurn(roomId);
                }
                else if (latestRoom.phase === "drawing") {
                    this.endRound(roomId);
                }
            }, 10_000);
        }
        graceState.removalTimer = setTimeout(() => {
            this.removeDisconnectedPlayer(roomId, playerId, socketId);
        }, 60_000);
        gameState.disconnectedPlayers.set(playerId, graceState);
    }
    handlePlayerReconnect(roomId, playerId) {
        const gameState = this.games.get(roomId);
        if (!gameState)
            return;
        const graceState = gameState.disconnectedPlayers.get(playerId);
        if (!graceState)
            return;
        if (graceState.skipTimer)
            clearTimeout(graceState.skipTimer);
        if (graceState.removalTimer)
            clearTimeout(graceState.removalTimer);
        gameState.disconnectedPlayers.delete(playerId);
    }
    syncPrivateStateToPlayer(roomId, playerId, socketId) {
        const room = rooms.get(roomId);
        const gameState = this.games.get(roomId);
        if (!room || !gameState)
            return;
        if (room.phase === "word-selection" && room.drawingState.currentArtist === playerId) {
            this.io?.to(socketId).emit("word:choice", { words: gameState.wordChoices });
            return;
        }
        if (!gameState.currentWord)
            return;
        if (room.drawingState.currentArtist === playerId) {
            this.io?.to(socketId).emit("word:selected", { word: gameState.currentWord });
            return;
        }
        this.io?.to(socketId).emit("word:mask", { maskedWord: this.maskWord(gameState.currentWord) });
    }
    removeDisconnectedPlayer(roomId, playerId, socketId) {
        const room = rooms.get(roomId);
        const gameState = this.games.get(roomId);
        if (!room || !gameState)
            return;
        const trackedGrace = gameState.disconnectedPlayers.get(playerId);
        if (!trackedGrace || trackedGrace.socketId !== socketId)
            return;
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
//# sourceMappingURL=GameManager.js.map