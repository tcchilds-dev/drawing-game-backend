import type {
  RoomConfig,
  Guessage,
  Point,
  Stroke,
  GamePhase,
  ConvertedRoom,
  FinalStanding,
} from "./main.types.js";
import type { Server, Socket } from "socket.io";

export type EventDependencies = {
  io: Server;
  socket: Socket;
};

export type SimpleCallback = (
  response: { success: true } | { success: false; error: string }
) => void;

export type RoomCallback = (
  response: { success: true; room: ConvertedRoom } | { success: false; error: string }
) => void;

export type WordCallback = (
  response: { success: true; word: string } | { success: false; error: string }
) => void;

export type SimpleResponse = { success: true } | { success: false; error: string };

export type RoomResponse =
  | { success: true; room: ConvertedRoom }
  | { success: false; error: string };

export type WordResponse = { success: true; word: string } | { success: false; error: string };

export interface ClientToServerEvents {
  "user:username": (name: string, callback: SimpleCallback) => void;
  "room:create": (config: Partial<RoomConfig>, callback: RoomCallback) => void;
  "room:join": (roomId: string, callback: RoomCallback) => void;
  "room:leave": () => void;
  "game:start": (roomId: string, callback: SimpleCallback) => void;
  "chat:guessage": (guessage: Guessage) => void;
  "word:choice": (word: string, callback: WordCallback) => void;
  "stroke:start": (data: { color: string; width: number }) => void;
  "stroke:points": (data: { points: Point[] }) => void;
  "stroke:end": () => void;
  "canvas:undo": () => void;
  "canvas:clear": () => void;
}

export interface ServerToClientEvents {
  "room:update": (room: ConvertedRoom) => void;
  "user:left": (userId: string) => void;
  "word:choice": (data: { words: string[] }) => void;
  "word:mask": (data: { maskedWord: string }) => void;
  "word:selected": (data: { word: string }) => void;
  "stroke:start": (data: { playerId: string; color: string; width: number }) => void;
  "stroke:points": (data: { playerId: string; points: Point[] }) => void;
  "stroke:end": () => void;
  "canvas:clear": () => void;
  "canvas:sync": (data: { completedStrokes: Stroke[]; activeStroke: Stroke | null }) => void;
  "timer:sync": (data: { remaining: number; phase: GamePhase }) => void;
  "round:start": (data: { round: number; artistId: string }) => void;
  "round:end": (data: { word: string; scores: Record<string, number> }) => void;
  "game:end": (data: { finalStandings: FinalStanding[] }) => void;
  "guess:correct": (data: { playerId: string; username: string }) => void;
}
