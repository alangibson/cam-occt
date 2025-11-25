/**
 * Part class - Reactive wrapper for PartData
 *
 * Provides a reactive Svelte 5 class that wraps PartData interface
 * with getters for all properties.
 */

import type { PartData, PartVoid, PartSlot } from './interfaces';
import type { ChainData } from '$lib/cam/chain/interfaces';
import type { BoundingBoxData } from '$lib/geometry/bounding-box/interfaces';
import { PartType } from './enums';

export class Part {
    #data: PartData;

    constructor(data: PartData) {
        this.#data = data;
    }

    get id(): string {
        return this.#data.id;
    }

    get shell(): ChainData {
        return this.#data.shell;
    }

    get type(): PartType.SHELL {
        return this.#data.type;
    }

    get boundingBox(): BoundingBoxData {
        return this.#data.boundingBox;
    }

    get voids(): PartVoid[] {
        return this.#data.voids;
    }

    get slots(): PartSlot[] {
        return this.#data.slots;
    }

    get layerName(): string {
        return this.#data.layerName;
    }

    /**
     * Get the underlying PartData for serialization or legacy code
     */
    toData(): PartData {
        return this.#data;
    }
}
