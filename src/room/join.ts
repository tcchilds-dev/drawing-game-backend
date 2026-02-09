import type { EventDependencies, RoomCallback } from "../types/event.types.js";
import { validateRoomId } from "../validation/typia.js";
import { convertRoom, rooms } from "./rooms.js";
import type { User } from "../types/main.types.js";
import { syncCanvasToSocket } from "../game/drawing.js";
import { gameManager } from "../game/GameManager.js";
import { clearLobbyDisconnectGrace } from "./disconnect.js";
import { removeSocketFromAllRooms } from "./leave.js";

export function joinRoom({ io, socket }: EventDependencies) {
  return async (payload: string, callback: RoomCallback) => {
    if (typeof callback !== "function") return;

    const result = validateRoomId(payload);
    if (result.success === false) {
      callback({ success: false, error: "room ID is invalid" });
      console.log(result.errors);
      return;
    }

    const room = rooms.get(payload);
    if (!room) {
      callback({ success: false, error: "room does not exist" });
      return;
    }

    const username = socket.data.username || "Guest";
    const playerId = socket.data.playerId;

    if (!playerId) {
      callback({ success: false, error: "playerId not set" });
      return;
    }

    removeSocketFromAllRooms({ io, socket, excludedRoomId: payload });

    // Check if this playerId is already in the room with a different socket.id
    let existingScore = 0;
    let existingSocketId: string | null = null;
    for (const [socketId, player] of room.players) {
      if (player.playerId === playerId && socketId !== socket.id) {
        existingSocketId = socketId;
        existingScore = player.score;
        break;
      }
    }

    const isRejoin = existingSocketId !== null;
    if (!isRejoin && room.players.size >= room.config.maxPlayers) {
      callback({ success: false, error: "room is full" });
      return;
    }

    if (existingSocketId) {
      console.log(`Player ${playerId} rejoining, removing old socket ${existingSocketId}`);
      room.players.delete(existingSocketId);

      if (room.creator === existingSocketId) {
        room.creator = socket.id;
      }
    }

    socket.join(payload);

    const user: User = {
      id: socket.id,
      playerId: playerId,
      username: username,
      score: existingScore,
    };

    room.players.set(socket.id, user);
    gameManager.handlePlayerReconnect(payload, playerId);
    clearLobbyDisconnectGrace(payload, playerId);

    const convertedRoom = convertRoom(room);

    io.to(payload).emit("room:update", convertedRoom);

    // Sync canvas state if game is in progress
    if (room.phase === "drawing" || room.phase === "word-selection") {
      syncCanvasToSocket(socket, payload);
      gameManager.syncPrivateStateToPlayer(payload, playerId, socket.id);
    }

    callback({ success: true, room: convertedRoom });
  };
}
