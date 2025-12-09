import type { PartDetectionWarning } from '$lib/cam/part/part-detection.interfaces';

class PartStore {
    warnings = $state<PartDetectionWarning[]>([]);

    setWarnings(warnings: PartDetectionWarning[] = []) {
        this.warnings = warnings;
    }

    clearParts() {
        this.warnings = [];
    }
}

export const partStore: PartStore = new PartStore();
