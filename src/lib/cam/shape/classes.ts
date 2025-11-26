import type { ShapeData, TessellationCache } from './interfaces';
import { tessellateShape } from './functions';
import { DEFAULT_PART_DETECTION_PARAMETERS } from '$lib/cam/part/defaults';
import type { Geometry } from '$lib/geometry/types';
import type { GeometryType } from '$lib/geometry/enums';

export class Shape implements ShapeData {
    #data: ShapeData;
    #tessellationCache?: TessellationCache;

    constructor(data: ShapeData) {
        if (!data.id) {
            console.error('Shape constructor called with invalid data:', data);
            throw new Error('Shape data must have an id field');
        }
        this.#data = data;
    }

    get id(): string {
        return this.#data.id;
    }

    get type(): GeometryType {
        return this.#data.type;
    }

    get geometry(): Geometry {
        return this.#data.geometry;
    }

    get layer(): string | undefined {
        return this.#data.layer;
    }

    get tessellation(): TessellationCache {
        if (!this.#tessellationCache) {
            const points = tessellateShape(
                this,
                DEFAULT_PART_DETECTION_PARAMETERS
            );
            this.#tessellationCache = {
                points,
                tolerance:
                    DEFAULT_PART_DETECTION_PARAMETERS.tessellationTolerance,
                timestamp: Date.now(),
            };
        }
        return this.#tessellationCache;
    }

    toData(): ShapeData {
        return this.#data;
    }
}
