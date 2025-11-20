/**
 * Part class - Reactive wrapper for PartData
 *
 * Provides a reactive Svelte 5 class that wraps PartData interface
 * with getters for all properties.
 */

import type { PartData, PartVoid, PartSlot } from './interfaces';
import type { Chain } from '$lib/geometry/chain/interfaces';
import type { BoundingBox } from '$lib/geometry/bounding-box/interfaces';
import { PartType } from './enums';

export class Part {
    private data: PartData;

    constructor(data: PartData) {
        this.data = data;
    }

    get id(): string {
        return this.data.id;
    }

    get shell(): Chain {
        return this.data.shell;
    }

    get type(): PartType.SHELL {
        return this.data.type;
    }

    get boundingBox(): BoundingBox {
        return this.data.boundingBox;
    }

    get voids(): PartVoid[] {
        return this.data.voids;
    }

    get slots(): PartSlot[] {
        return this.data.slots;
    }

    get layerName(): string {
        return this.data.layerName;
    }

    /**
     * Get the underlying PartData for serialization or legacy code
     */
    toData(): PartData {
        return this.data;
    }
}
