import type { OffsetData } from './interfaces';
import type { Shape } from '$lib/cam/shape/classes';
import type { OffsetDirection } from '$lib/cam/offset/types';

export class Offset {
    #data: OffsetData;
    #offsetShapes: Shape[];

    constructor(data: OffsetData) {
        this.#data = data;
        this.#offsetShapes = data.offsetShapes;
    }

    get offsetShapes(): Shape[] {
        return this.#offsetShapes;
    }

    set offsetShapes(shapes: Shape[]) {
        this.#offsetShapes = shapes;
    }

    get originalShapes(): Shape[] {
        return this.#data.originalShapes;
    }

    get direction(): OffsetDirection {
        return this.#data.direction;
    }

    get kerfWidth(): number {
        return this.#data.kerfWidth;
    }

    get generatedAt(): string {
        return this.#data.generatedAt;
    }

    get version(): string {
        return this.#data.version;
    }

    toData(): OffsetData {
        return this.#data;
    }
}
