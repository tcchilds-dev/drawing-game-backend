import { rooms } from "../room/rooms.js";
import { validateStrokeStart, validateStrokePoints } from "../validation/typia.js";
export function handleStrokeStart({ io: _io, socket }) {
    return (payload) => {
        const result = validateStrokeStart(payload);
        if (!result.success) {
            console.log("stroke:start validation failed", result.errors);
            return;
        }
        const roomId = Array.from(socket.rooms).find((id) => id !== socket.id);
        if (!roomId)
            return;
        const room = rooms.get(roomId);
        if (!room)
            return;
        const playerId = socket.data.playerId;
        if (!playerId)
            return;
        if (room.drawingState.currentArtist !== playerId)
            return;
        if (room.phase !== "drawing")
            return;
        room.drawingState.activeStroke = {
            points: [],
            color: payload.color,
            width: payload.width,
        };
        socket.to(roomId).emit("stroke:start", {
            playerId,
            color: payload.color,
            width: payload.width,
        });
    };
}
export function handleStrokePoints({ io: _io, socket }) {
    return (payload) => {
        const result = validateStrokePoints(payload);
        if (!result.success) {
            console.log("stroke:points validation failed", result.errors);
            return;
        }
        const roomId = Array.from(socket.rooms).find((id) => id !== socket.id);
        if (!roomId)
            return;
        const room = rooms.get(roomId);
        if (!room)
            return;
        const playerId = socket.data.playerId;
        if (!playerId)
            return;
        if (room.drawingState.currentArtist !== playerId)
            return;
        if (room.phase !== "drawing")
            return;
        if (!room.drawingState.activeStroke)
            return;
        room.drawingState.activeStroke.points.push(...payload.points);
        socket.to(roomId).emit("stroke:points", {
            playerId,
            points: payload.points,
        });
    };
}
export function handleStrokeEnd({ io: _io, socket }) {
    return () => {
        const roomId = Array.from(socket.rooms).find((id) => id !== socket.id);
        if (!roomId)
            return;
        const room = rooms.get(roomId);
        if (!room)
            return;
        const playerId = socket.data.playerId;
        if (!playerId)
            return;
        if (room.drawingState.currentArtist !== playerId)
            return;
        if (room.phase !== "drawing")
            return;
        if (room.drawingState.activeStroke) {
            room.drawingState.completedStrokes.push(room.drawingState.activeStroke);
            room.drawingState.activeStroke = null;
        }
        socket.to(roomId).emit("stroke:end");
    };
}
export function handleCanvasClear({ io, socket }) {
    return () => {
        const roomId = Array.from(socket.rooms).find((id) => id !== socket.id);
        if (!roomId)
            return;
        const room = rooms.get(roomId);
        if (!room)
            return;
        const playerId = socket.data.playerId;
        if (!playerId)
            return;
        if (room.drawingState.currentArtist !== playerId)
            return;
        if (room.phase !== "drawing")
            return;
        room.drawingState.completedStrokes = [];
        room.drawingState.activeStroke = null;
        io.to(roomId).emit("canvas:clear");
    };
}
export function handleCanvasUndo({ io, socket }) {
    return () => {
        const roomId = Array.from(socket.rooms).find((id) => id !== socket.id);
        if (!roomId)
            return;
        const room = rooms.get(roomId);
        if (!room)
            return;
        const playerId = socket.data.playerId;
        if (!playerId)
            return;
        if (room.drawingState.currentArtist !== playerId)
            return;
        if (room.phase !== "drawing")
            return;
        if (room.drawingState.completedStrokes.length > 0) {
            room.drawingState.completedStrokes.pop();
            io.to(roomId).emit("canvas:sync", {
                completedStrokes: room.drawingState.completedStrokes,
                activeStroke: room.drawingState.activeStroke,
            });
        }
    };
}
export function syncCanvasToSocket(socket, roomId) {
    const room = rooms.get(roomId);
    if (!room)
        return;
    socket.emit("canvas:sync", {
        completedStrokes: room.drawingState.completedStrokes,
        activeStroke: room.drawingState.activeStroke,
    });
}
//# sourceMappingURL=drawing.js.map