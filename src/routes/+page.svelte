<script lang="ts">
	import { appState } from '$lib/stores.svelte.js';
	import ImportPage from './import/+page.svelte';
	import ModifyPage from './modify/+page.svelte';
	import ProgramPage from './program/+page.svelte';
	import ExportPage from './export/+page.svelte';
</script>

{#if appState.currentStage === 'import'}
	<ImportPage />
{:else if appState.currentStage === 'modify'}
	<ModifyPage />
{:else if appState.currentStage === 'program'}
	<ProgramPage />
{:else if appState.currentStage === 'export'}
	<ExportPage />
{/if}