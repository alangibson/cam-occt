import type { PartDetectionWarning } from '$lib/cam/part/interfaces';

export interface PartStore {
    warnings: PartDetectionWarning[];
}
