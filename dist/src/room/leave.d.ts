import type { EventDependencies } from "../types/event.types.js";
type RemoveSocketFromRoomInput = EventDependencies & {
    roomId: string;
};
export declare function removeSocketFromRoom({ io, socket, roomId }: RemoveSocketFromRoomInput): boolean;
type RemoveSocketFromAllRoomsInput = EventDependencies & {
    excludedRoomId?: string;
};
export declare function removeSocketFromAllRooms({ io, socket, excludedRoomId, }: RemoveSocketFromAllRoomsInput): void;
export declare function leaveRoom({ io, socket }: EventDependencies): () => Promise<void>;
export {};
//# sourceMappingURL=leave.d.ts.map