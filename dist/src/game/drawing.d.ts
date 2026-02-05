import type { EventDependencies } from "../types/event.types.js";
import type { Point } from "../types/main.types.js";
export declare function handleStrokeStart({ io: _io, socket }: EventDependencies): (payload: {
    color: string;
    width: number;
}) => void;
export declare function handleStrokePoints({ io: _io, socket }: EventDependencies): (payload: {
    points: Point[];
}) => void;
export declare function handleStrokeEnd({ io: _io, socket }: EventDependencies): () => void;
export declare function handleCanvasClear({ io, socket }: EventDependencies): () => void;
export declare function handleCanvasUndo({ io, socket }: EventDependencies): () => void;
export declare function syncCanvasToSocket(socket: EventDependencies["socket"], roomId: string): void;
//# sourceMappingURL=drawing.d.ts.map