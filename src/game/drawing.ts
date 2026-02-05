import type { EventDependencies } from "../types/event.types.js";
import type { Point } from "../types/main.types.js";
import { rooms } from "../room/rooms.js";
import { validateStrokeStart, validateStrokePoints } from "../validation/typia.js";

export function handleStrokeStart({ io: _io, socket }: EventDependencies) {
  return (payload: { color: string; width: number }) => {
    const result = validateStrokeStart(payload);
    if (!result.success) {
      console.log("stroke:start validation failed", result.errors);
      return;
    }

    const roomId = Array.from(socket.rooms).find((id) => id !== socket.id);
    if (!roomId) return;

    const room = rooms.get(roomId);
    if (!room) return;

    // Only the current artist can draw
    if (room.drawingState.currentArtist !== socket.id) return;
    if (room.phase !== "drawing") return;

    // Start a new active stroke
    room.drawingState.activeStroke = {
      points: [],
      color: payload.color,
      width: payload.width,
    };

    // Broadcast to other players (exclude sender)
    socket.to(roomId).emit("stroke:start", {
      playerId: socket.id,
      color: payload.color,
      width: payload.width,
    });
  };
}

export function handleStrokePoints({ io: _io, socket }: EventDependencies) {
  return (payload: { points: Point[] }) => {
    const result = validateStrokePoints(payload);
    if (!result.success) {
      console.log("stroke:points validation failed", result.errors);
      return;
    }

    const roomId = Array.from(socket.rooms).find((id) => id !== socket.id);
    if (!roomId) return;

    const room = rooms.get(roomId);
    if (!room) return;

    if (room.drawingState.currentArtist !== socket.id) return;
    if (room.phase !== "drawing") return;
    if (!room.drawingState.activeStroke) return;

    // Add points to active stroke
    room.drawingState.activeStroke.points.push(...payload.points);

    // Broadcast to other players
    socket.to(roomId).emit("stroke:points", {
      playerId: socket.id,
      points: payload.points,
    });
  };
}

export function handleStrokeEnd({ io: _io, socket }: EventDependencies) {
  return () => {
    const roomId = Array.from(socket.rooms).find((id) => id !== socket.id);
    if (!roomId) return;

    const room = rooms.get(roomId);
    if (!room) return;

    if (room.drawingState.currentArtist !== socket.id) return;
    if (room.phase !== "drawing") return;

    // Move active stroke to completed strokes
    if (room.drawingState.activeStroke) {
      room.drawingState.completedStrokes.push(room.drawingState.activeStroke);
      room.drawingState.activeStroke = null;
    }

    // Broadcast to other players
    socket.to(roomId).emit("stroke:end");
  };
}

export function handleCanvasClear({ io, socket }: EventDependencies) {
  return () => {
    const roomId = Array.from(socket.rooms).find((id) => id !== socket.id);
    if (!roomId) return;

    const room = rooms.get(roomId);
    if (!room) return;

    if (room.drawingState.currentArtist !== socket.id) return;
    if (room.phase !== "drawing") return;

    // Clear all strokes
    room.drawingState.completedStrokes = [];
    room.drawingState.activeStroke = null;

    // Broadcast to all players in the room
    io.to(roomId).emit("canvas:clear");
  };
}

export function handleCanvasUndo({ io, socket }: EventDependencies) {
  return () => {
    const roomId = Array.from(socket.rooms).find((id) => id !== socket.id);
    if (!roomId) return;

    const room = rooms.get(roomId);
    if (!room) return;

    if (room.drawingState.currentArtist !== socket.id) return;
    if (room.phase !== "drawing") return;

    // Remove last completed stroke
    if (room.drawingState.completedStrokes.length > 0) {
      room.drawingState.completedStrokes.pop();

      // Send full canvas sync to all players
      io.to(roomId).emit("canvas:sync", {
        completedStrokes: room.drawingState.completedStrokes,
        activeStroke: room.drawingState.activeStroke,
      });
    }
  };
}

// Send canvas state to a specific socket (for late joiners)
export function syncCanvasToSocket(socket: EventDependencies["socket"], roomId: string) {
  const room = rooms.get(roomId);
  if (!room) return;

  socket.emit("canvas:sync", {
    completedStrokes: room.drawingState.completedStrokes,
    activeStroke: room.drawingState.activeStroke,
  });
}
