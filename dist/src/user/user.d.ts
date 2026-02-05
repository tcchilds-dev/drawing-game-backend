import type { EventDependencies, SimpleCallback } from "../types/event.types.js";
export declare function setUsername({ io: _io, socket }: EventDependencies): (payload: {
    username: string;
    playerId: string;
}, callback: SimpleCallback) => Promise<void>;
//# sourceMappingURL=user.d.ts.map