import type { ChainData } from './interfaces';
import { Shape } from '$lib/geometry/shape/classes';

export class Chain implements ChainData {
    #data: ChainData;
    #shapesCache?: Shape[];

    constructor(data: ChainData) {
        this.#data = data;
    }

    get id(): string {
        return this.#data.id;
    }

    get shapes(): Shape[] {
        if (!this.#shapesCache) {
            this.#shapesCache = this.#data.shapes.map((s) => new Shape(s));
        }
        return this.#shapesCache;
    }

    get clockwise(): boolean | null | undefined {
        return this.#data.clockwise;
    }

    get originalChainId(): string | undefined {
        return this.#data.originalChainId;
    }

    toData(): ChainData {
        return {
            id: this.id,
            shapes: this.shapes.map((s) => s.toData()),
            clockwise: this.clockwise,
            originalChainId: this.originalChainId,
        };
    }
}
