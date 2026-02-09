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
    guessage: string & tags.MinLength<1> & tags.MaxLength<120>;
    timestamp: string & tags.Format<"date-time">;
};
export interface SocketData {
    username: string | null;
    playerId: string | null;
    score: number | null;
}
export type User = {
    id: string;
    playerId: string;
    username: string;
    score: number;
};
export type FinalStanding = {
    playerId: string;
    username: string;
    score: number;
};
export type GamePhase = "lobby" | "word-selection" | "drawing" | "round-end";
export interface Room {
    id: string;
    creator: string;
    config: RoomConfig;
    players: Map<string, User>;
    guessages: Guessage[];
    drawingState: DrawingState;
    phase: GamePhase;
    currentRound: number;
}
export interface ConvertedRoom {
    id: string;
    config: RoomConfig;
    players: {
        [k: string]: User;
    };
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
    correctlyGuessed: User[];
    startedAt: number | null;
    completedStrokes: Stroke[];
    activeStroke: Stroke | null;
};
export declare const DEFAULT_ROOM_CONFIG: RoomConfig;
//# sourceMappingURL=main.types.d.ts.map