class RapidsStore {
    showRapids = $state(true);
    showRapidDirections = $state(false);

    toggleShowRapids() {
        this.showRapids = !this.showRapids;
    }

    setShowRapids(show: boolean) {
        this.showRapids = show;
    }

    setShowRapidDirections(show: boolean) {
        this.showRapidDirections = show;
    }

    reset() {
        this.showRapids = true;
        this.showRapidDirections = false;
    }
}

export const rapidStore = new RapidsStore();
