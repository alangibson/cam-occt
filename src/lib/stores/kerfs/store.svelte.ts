import type { KerfData } from '$lib/cam/kerf/interfaces';

class KerfStore {
    kerfs = $state<KerfData[]>([]);
    showKerfPaths = $state(false);
    showCutter = $state(false);

    addKerf(kerf: KerfData) {
        const kerfToAdd: KerfData = kerf.id
            ? kerf
            : { ...kerf, id: crypto.randomUUID() };

        this.kerfs = [...this.kerfs, kerfToAdd];
    }

    setShowKerfPaths(show: boolean) {
        this.showKerfPaths = show;
    }

    setShowCutter(show: boolean) {
        this.showCutter = show;
    }

    clearKerfs() {
        this.kerfs = [];
    }

    deleteKerfsByCut(cutId: string) {
        this.kerfs = this.kerfs.filter((kerf) => kerf.cutId !== cutId);
    }

    reset() {
        this.kerfs = [];
        this.showKerfPaths = false;
        this.showCutter = false;
    }
}

export const kerfStore: KerfStore = new KerfStore();
