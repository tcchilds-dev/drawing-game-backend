export interface RoomConfig {
  isPrivate: boolean;
  maxPlayers: number;
  wordSelectionSize: 3 | 5;
  wordChoiceTimer: number;
  drawTimer: number;
  numberOfRounds: number;
}

// Guess + Message
export type Guessage = {
  playerId: string;
  guessage: string;
  timestamp: number;
};

export interface SocketData {
  username: string;
  score: number;
}

export type User = {
  id: string; // socket.id
  username: string; // socket.data.username
  score: number; // socket.data.score
};

export type GamePhase = "lobby" | "word-selection" | "drawing" | "round-end" | "game-end";

export interface Room {
  id: string;
  config: RoomConfig;
  players: User[];
  guessages: Guessage[];
  drawingState: DrawingState;
  phase: GamePhase;
  currentRound: number;
}

export type Point = [x: number, y: number];

export type Stroke = {
  points: Point[];
  color: string;
  width: number;
};

export type DrawingState = {
  currentArtist: string | null;
  currentWord: string | null;
  correctlyGuessed: User[];
  startedAt: number;
  completedStrokes: Stroke[];
  activeStroke: Stroke | null;
};

export const DEFAULT_ROOM_CONFIG: RoomConfig = {
  isPrivate: false,
  maxPlayers: 6,
  wordSelectionSize: 3,
  wordChoiceTimer: 10,
  drawTimer: 60,
  numberOfRounds: 5,
};
