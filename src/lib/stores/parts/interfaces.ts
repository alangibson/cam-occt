import type { Part, PartDetectionWarning } from '$lib/cam/part/interfaces';

export interface PartStore {
    parts: Part[];
    warnings: PartDetectionWarning[];
    highlightedPartId: string | null;
    hoveredPartId: string | null;
    selectedPartId: string | null;
}
