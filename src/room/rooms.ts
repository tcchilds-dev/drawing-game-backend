import type { ConvertedRoom, Room } from "../types/main.types.js";

export const rooms = new Map<string, Room>();

export function convertRoom(room: Room): ConvertedRoom {
  return {
    ...room,
    players: Object.fromEntries(room.players),
  };
}
