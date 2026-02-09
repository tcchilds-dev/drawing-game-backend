import type { EventDependencies } from "../types/event.types.js";
import { rooms, convertRoom, deleteRoom } from "./rooms.js";
import { gameManager } from "../game/GameManager.js";

export function leaveRoom({ io, socket }: EventDependencies) {
  return async () => {
    const roomId = Array.from(socket.rooms).find((id) => id !== socket.id);
    if (!roomId) {
      console.log("room ID for leave not found");
      return;
    }

    socket.leave(roomId);

    const room = rooms.get(roomId);
    if (!room) {
      console.log("could not fetch room for leave");
      return;
    }

    const leavingUser = room.players.get(socket.id);
    if (!leavingUser) {
      console.log("could not fetch user for leave");
      return;
    }

    const result = room.players.delete(socket.id);
    if (result !== true) {
      console.log("could not remove player from room");
      return;
    }

    gameManager.handlePlayerLeave(roomId, leavingUser.playerId);

    if (room.players.size === 0) {
      console.log(`Room ${roomId} is empty, deleting`);
      deleteRoom(roomId);
      return;
    }

    if (room.creator === socket.id) {
      const newCreator = room.players.keys().next().value;
      if (newCreator) {
        room.creator = newCreator;
      }
    }

    io.to(roomId).emit("room:update", convertRoom(room));
    io.to(roomId).emit("user:left", socket.id);
  };
}
