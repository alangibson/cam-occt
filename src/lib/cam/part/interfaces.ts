/**
 * Part Detection Parameters
 *
 * These parameters control the precision and behavior of geometric containment detection
 * for part detection algorithms.
 */

import type { BoundingBoxData } from '$lib/geometry/bounding-box/interfaces';
import type { ChainData } from '$lib/cam/chain/interfaces';
import type { PartType } from './enums';
import type { Part as PartClass } from './classes.svelte';

export type Part = PartClass;

export interface PartData {
    id: string;
    name: string;
    shell: ChainData;
    type: PartType.SHELL;
    boundingBox: BoundingBoxData;
    voids: PartVoid[];
    slots: PartSlot[];
    layerName: string;
}

// Closed Chain inside of a shell
export interface PartVoid {
    id: string;
    chain: ChainData;
    type: PartType.HOLE;
    boundingBox: BoundingBoxData;
}

// Open Chain inside of a shell
export interface PartSlot {
    id: string;
    chain: ChainData;
    type: PartType.SLOT;
    boundingBox: BoundingBoxData;
}
