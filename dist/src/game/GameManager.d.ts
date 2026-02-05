import type { Server } from "socket.io";
declare class GameManager {
    private static instance;
    private games;
    private io;
    private constructor();
    static getInstance(): GameManager;
    setIO(io: Server): void;
    startGame(roomId: string): {
        success: boolean;
        error?: string;
    };
    endGame(roomId: string): void;
    private startWordSelection;
    selectWord(roomId: string, playerId: string, word: string): string | null;
    private startDrawingPhase;
    private endRound;
    private advanceToNextTurn;
    checkGuess(roomId: string, playerId: string, guess: string): boolean;
    private startTimer;
    private clearTimer;
    private syncTimer;
    private broadcastRoomUpdate;
    private calculatePoints;
    private pickRandomWords;
    private shuffleArray;
    clearGame(roomId: string): void;
    clearAllGames(): void;
    handlePlayerLeave(roomId: string, playerId: string): void;
}
export declare const gameManager: GameManager;
export {};
//# sourceMappingURL=GameManager.d.ts.map