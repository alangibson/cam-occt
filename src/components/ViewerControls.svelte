<script lang="ts">
	import { appState } from '$lib/stores.svelte.js';
	import type { UnitType } from '../types/index.js';

	interface Props {
		loading?: boolean;
		errorMessage?: string;
		loadingStep?: string;
		unitsLocked?: boolean;
		onUnitsChange?: (units: UnitType) => void;
		onResetZoom?: () => void;
		onFitToView?: () => void;
	}

	let {
		loading = false,
		errorMessage = '',
		loadingStep = '',
		unitsLocked = false,
		onUnitsChange,
		onResetZoom,
		onFitToView
	}: Props = $props();

	function handleUnitsChange(event: Event) {
		const target = event.target as HTMLSelectElement;
		const newUnits = target.value as UnitType;
		appState.applicationSettings = { ...appState.applicationSettings, units: newUnits };
		onUnitsChange?.(newUnits);
	}
</script>

<div class="viewer-controls">
	<div class="control-group">
		<label for="units-select">Units:</label>
		<select 
			id="units-select"
			value={appState.applicationSettings.units}
			onchange={handleUnitsChange}
			disabled={unitsLocked}
			title={unitsLocked ? 'Units are locked after file import. Reset to change units.' : 'Select measurement units'}
		>
			<option value="mm">Millimeters (mm)</option>
			<option value="inches">Inches (in)</option>
		</select>
		{#if unitsLocked}
			<small class="units-locked-hint">Units locked after import</small>
		{/if}
	</div>

	<div class="control-group">
		<div class="button-group">
			<button 
				class="btn btn-small"
				onclick={onResetZoom}
				title="Reset zoom to 100%"
			>
				Reset Zoom
			</button>
			<button 
				class="btn btn-small"
				onclick={onFitToView}
				title="Fit all geometry to view"
			>
				Fit to View
			</button>
		</div>
	</div>

	{#if loading}
		<div class="loading-indicator">
			<div class="loading-spinner"></div>
			<span>{loadingStep || 'Loading...'}</span>
		</div>
	{/if}

	{#if errorMessage}
		<div class="error-message">
			<span class="error-icon">⚠️</span>
			<span>{errorMessage}</span>
		</div>
	{/if}
</div>

<style>
	.viewer-controls {
		background: white;
		border: 1px solid var(--border-color);
		border-radius: 8px;
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.control-group {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.control-group label {
		font-size: 0.8rem;
		font-weight: 600;
		color: #666;
		text-transform: uppercase;
	}

	.control-group select {
		padding: 0.5rem;
		border: 1px solid var(--border-color);
		border-radius: 4px;
		font-size: 0.9rem;
		background: white;
	}

	.control-group select:disabled {
		background: #f5f5f5;
		color: #999;
		cursor: not-allowed;
	}

	.units-locked-hint {
		font-size: 0.7rem;
		color: #999;
		font-style: italic;
	}

	.button-group {
		display: flex;
		gap: 0.5rem;
	}

	.btn {
		padding: 0.5rem 1rem;
		border: 1px solid var(--border-color);
		border-radius: 4px;
		background: white;
		cursor: pointer;
		font-size: 0.8rem;
		transition: all 0.2s;
	}

	.btn:hover {
		background: #f8f9fa;
		border-color: var(--primary-color);
	}

	.btn-small {
		padding: 0.4rem 0.8rem;
		font-size: 0.8rem;
	}

	.loading-indicator {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem;
		background: #f8f9fa;
		border-radius: 4px;
		font-size: 0.8rem;
		color: #666;
	}

	.loading-spinner {
		width: 16px;
		height: 16px;
		border: 2px solid #f3f3f3;
		border-top: 2px solid var(--primary-color);
		border-radius: 50%;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		0% { transform: rotate(0deg); }
		100% { transform: rotate(360deg); }
	}

	.error-message {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem;
		background: #fff3cd;
		border: 1px solid #ffeaa7;
		border-radius: 4px;
		font-size: 0.8rem;
		color: #856404;
	}

	.error-icon {
		font-size: 1rem;
	}
</style>