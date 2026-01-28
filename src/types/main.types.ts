import { tags } from "typia";

export interface RoomConfig {
  isPrivate: boolean;
  maxPlayers: number & tags.Minimum<2> & tags.Maximum<12>;
  wordSelectionSize: 3 | 5;
  wordChoiceTimer: number;
  drawTimer: number;
  numberOfRounds: number & tags.Minimum<1> & tags.Maximum<10>;
}

// Guess + Message
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
  id: string; // socket.id
  username: string; // socket.data.username
  score: number; // socket.data.score
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
  y: number & tags.Minimum<0> & tags.Maximum<1>,
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

export const DEFAULT_ROOM_CONFIG: RoomConfig = {
  isPrivate: false,
  maxPlayers: 6,
  wordSelectionSize: 3,
  wordChoiceTimer: 10 * 1000,
  drawTimer: 60 * 1000,
  numberOfRounds: 5,
};
