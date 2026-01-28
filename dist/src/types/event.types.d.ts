import type { RoomConfig, Room, Guessage, Point, Stroke, GamePhase } from "./main.types.js";
import type { Server, Socket } from "socket.io";
export type EventDependencies = {
    io: Server;
    socket: Socket;
};
export type SimpleCallback = (response: {
    success: true;
} | {
    success: false;
    error: string;
}) => void;
export type SimpleResponse = {
    success: true;
} | {
    success: false;
    error: string;
};
export type RoomResponse = {
    success: true;
    room: Room;
} | {
    success: false;
    error: string;
};
export type RoomCallback = (response: {
    success: true;
    room: Room;
} | {
    success: false;
    error: string;
}) => void;
export interface ClientToServerEvents {
    "user:username": (name: string, callback: SimpleCallback) => void;
    "room:create": (config: Partial<RoomConfig>, callback: RoomCallback) => void;
    "room:join": (roomId: string, callback: RoomCallback) => void;
    "room:leave": () => void;
    "chat:guessage": (guessage: Guessage) => void;
    "word:choice": (word: string) => void;
    "stroke:start": (data: {
        color: string;
        width: number;
    }) => void;
    "stroke:points": (data: {
        points: Point[];
    }) => void;
    "stroke:end": () => void;
    "canvas:clear": () => void;
}
export interface ServerToClientEvents {
    "room:update": (room: Room) => void;
    "user:joined": (notice: string) => void;
    "user:left": (notice: string) => void;
    "user:reconnected": (notice: string) => void;
    "user:disconnected": (notice: string) => void;
    "word:choice": (data: {
        words: string[];
    }) => void;
    "stroke:start": (data: {
        playerId: string;
        color: string;
        width: string;
    }) => void;
    "stroke:points": (data: {
        playerId: string;
        points: Point[];
    }) => void;
    "stroke:end": () => void;
    "canvas:clear": () => void;
    "canvas:sync": (data: {
        completedStrokes: Stroke[];
        activeStroke: Stroke | null;
    }) => void;
    "timer:sync": (data: {
        remaining: number;
        phase: GamePhase;
    }) => void;
    "round:start": (data: {
        round: number;
        artistId: string;
    }) => void;
    "round:end": (data: {
        word: string;
        scores: Record<string, number>;
    }) => void;
    "game:end": (data: {
        finalScores: Record<string, number>;
    }) => void;
    "guess:correct": (data: {
        playerId: string;
        username: string;
    }) => void;
}
//# sourceMappingURL=event.types.d.ts.map