import { tags } from "typia";
export interface RoomConfig {
    isPrivate: boolean;
    maxPlayers: number & tags.Minimum<2> & tags.Maximum<12>;
    wordSelectionSize: 3 | 5;
    wordChoiceTimer: number;
    drawTimer: number;
    numberOfRounds: number & tags.Minimum<1> & tags.Maximum<10>;
}
export type Guessage = {
    playerId: string;
    guessage: string;
    timestamp: string & tags.Format<"date-time">;
};
export interface SocketData {
    username: string | null;
    score: number | null;
}
export type User = {
    id: string;
    username: string;
    score: number;
};
export type GamePhase = "waiting" | "word-selection" | "drawing" | "round-end" | "game-end";
export interface Room {
    id: string;
    config: RoomConfig;
    players: User[];
    guessages: Guessage[];
    drawingState: DrawingState;
    phase: GamePhase;
    currentRound: number;
}
export type Point = [
    x: number & tags.Minimum<0> & tags.Maximum<1>,
    y: number & tags.Minimum<0> & tags.Maximum<1>
];
export type Stroke = {
    points: Point[];
    color: string;
    width: number;
};
export type DrawingState = {
    currentArtist: string | null;
    currentWord: string | null;
    correctlyGuessed: User[];
    startedAt: number | null;
    completedStrokes: Stroke[];
    activeStroke: Stroke | null;
};
export declare const DEFAULT_ROOM_CONFIG: RoomConfig;
//# sourceMappingURL=main.types.d.ts.map