import type { Socket } from "socket.io";

export function getJoinedRoomIds(socket: Socket): string[] {
  return Array.from(socket.rooms).filter((id) => id !== socket.id);
}

export function getActiveRoomId(socket: Socket): string | null {
  const joinedRoomIds = getJoinedRoomIds(socket);
  if (joinedRoomIds.length === 0) return null;

  return joinedRoomIds[0];
}
