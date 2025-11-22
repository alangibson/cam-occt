import type { Shape } from '$lib/geometry/shape/classes';
import type { OffsetDirection } from '$lib/cam/offset/types';

export interface OffsetData {
    offsetShapes: Shape[];
    originalShapes: Shape[];
    direction: OffsetDirection;
    kerfWidth: number;
    generatedAt: string;
    version: string;
}
