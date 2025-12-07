import { Plan } from '$lib/cam/plan/classes.svelte';
import type { CutData } from '$lib/cam/cut/interfaces';
import { Cut } from '$lib/cam/cut/classes.svelte';

class PlanStore {
    plan = $state(new Plan());

    reset() {
        this.plan = new Plan();
    }

    updateCuts(cuts: CutData[]) {
        this.plan.cuts = cuts.map((cutData) => new Cut(cutData));
    }
}

export const planStore = new PlanStore();
