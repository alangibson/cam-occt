import { writable } from 'svelte/store';
import { Plan } from '$lib/cam/plan/classes.svelte';
import type { CutData } from '$lib/cam/cut/interfaces';
import { Cut } from '$lib/cam/cut/classes.svelte';

interface PlanState {
    plan: Plan;
}

interface PlanStore {
    subscribe: (subscription: (state: PlanState) => void) => () => void;
    reset: () => void;
    updateCuts: (cuts: CutData[]) => void;
}

const initialState: PlanState = {
    plan: new Plan(),
};

function createPlanStore(): PlanStore {
    const { subscribe, set, update } = writable<PlanState>(initialState);

    return {
        subscribe,

        reset: () => {
            set({ plan: new Plan() });
        },

        updateCuts: (cuts: CutData[]) => {
            update((state) => {
                state.plan.updateCuts(cuts.map((cutData) => new Cut(cutData)));
                return { ...state }; // Trigger reactivity by creating new object
            });
        },
    };
}

export const planStore: ReturnType<typeof createPlanStore> = createPlanStore();
