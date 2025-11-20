import type { PartDetectionWarning } from '$lib/cam/part/interfaces';

export interface PartStore {
    warnings: PartDetectionWarning[];
    highlightedPartId: string | null;
    hoveredPartId: string | null;
    selectedPartIds: Set<string>;
}
