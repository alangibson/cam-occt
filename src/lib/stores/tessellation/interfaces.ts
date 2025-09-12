export interface TessellationPoint {
    x: number;
    y: number;
    shapeId: string;
    chainId: string;
}

export interface TessellationState {
    isActive: boolean;
    points: TessellationPoint[];
    lastUpdate: number;
}

export interface TessellationStore {
    subscribe: (run: (value: TessellationState) => void) => () => void;
    setTessellation: (points: TessellationPoint[]) => void;
    clearTessellation: () => void;
    toggleTessellation: (points?: TessellationPoint[]) => void;
}
