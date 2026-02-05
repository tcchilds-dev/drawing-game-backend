import { gameManager } from "../game/GameManager.js";
import type { ConvertedRoom, Room } from "../types/main.types.js";

export const rooms = new Map<string, Room>();

export function convertRoom(room: Room): ConvertedRoom {
  return {
    ...room,
    players: Object.fromEntries(room.players),
  };
}

export function deleteRoom(roomId: string): boolean {
  const room = rooms.get(roomId);
  if (!room) return false;

  gameManager.clearGame(roomId);

  rooms.delete(roomId);
  console.log(`Deleted room ${roomId}`);
  return true;
}
