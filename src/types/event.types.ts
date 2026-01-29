import type {
  RoomConfig,
  Guessage,
  Point,
  Stroke,
  GamePhase,
  ConvertedRoom,
} from "./main.types.js";
import type { Server, Socket } from "socket.io";

export type EventDependencies = {
  io: Server;
  socket: Socket;
};

export type SimpleCallback = (
  response: { success: true } | { success: false; error: string }
) => void;

export type SimpleResponse = { success: true } | { success: false; error: string };

export type RoomResponse =
  | { success: true; room: ConvertedRoom }
  | { success: false; error: string };

export type RoomCallback = (
  response: { success: true; room: ConvertedRoom } | { success: false; error: string }
) => void;

export interface ClientToServerEvents {
  // Client sends username they want to set.
  // Server attaches the username to their `socket.data`.
  // Callback to notify of success status.
  "user:username": (name: string, callback: SimpleCallback) => void;

  // Client sends a room config.
  // Server creates the room and joins the client to it.
  // Lists room on public rooms if not set to private.
  "room:create": (config: Partial<RoomConfig>, callback: RoomCallback) => void;

  // Client sends room ID.
  // Server joins the socket to the room and broadcasts to the room.
  "room:join": (roomId: string, callback: RoomCallback) => void;

  // Client clicks leave.
  // Server takes the user out of the room and broadcasts to the room.
  "room:leave": () => void;

  // Client sends a message in the chat.
  // Server checks to see if it matches the secret word.
  // If it does, add them to the correct guessers and hide the message.
  // If it isn't server broadcasts the message to the room.
  "chat:guessage": (guessage: Guessage) => void;

  // Client makes a choice from supplied words.
  // Server sets it as the currentWord and broadcasts to room.
  "word:choice": (word: string) => void;

  // Client presses mouse down.
  // Server starts activeStroke.
  // Server broadcasts drawingState.
  "stroke:start": (data: { color: string; width: number }) => void;

  // Client moves mouse and sends points.
  // Server updates activeStroke with new points.
  // Server broadcasts drawingState.
  "stroke:points": (data: { points: Point[] }) => void;

  // Client mouse up.
  // Server adds activeStroke to completedStrokes and clears activeStroke.
  // Server broadcasts drawingState.
  "stroke:end": () => void;

  // Client clicks clear.
  // Server clears activeStroke and completedStrokes.
  // Server broadcasts drawingState.
  "canvas:clear": () => void;
}

// TODO: likely incomplete
export interface ServerToClientEvents {
  "room:update": (room: ConvertedRoom) => void;
  "user:joined": (userId: string) => void;
  "user:left": (userId: string) => void;
  "user:reconnected": (userId: string) => void;
  "user:disconnected": (userId: string) => void;
  "word:choice": (data: { words: string[] }) => void;
  "stroke:start": (data: { playerId: string; color: string; width: string }) => void;
  "stroke:points": (data: { playerId: string; points: Point[] }) => void;
  "stroke:end": () => void;
  "canvas:clear": () => void;
  "canvas:sync": (data: { completedStrokes: Stroke[]; activeStroke: Stroke | null }) => void;
  "timer:sync": (data: { remaining: number; phase: GamePhase }) => void;
  "round:start": (data: { round: number; artistId: string }) => void;
  "round:end": (data: { word: string; scores: Record<string, number> }) => void;
  "game:end": (data: { finalScores: Record<string, number> }) => void;
  "guess:correct": (data: { playerId: string; username: string }) => void;
}
