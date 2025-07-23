import type { AppStage, Project, ApplicationSettings } from '../types/index.js';

export const stages: AppStage[] = [
	{ id: 'import', name: 'Import', description: 'Import 2D drawing from file, cloud or AI' },
	{ id: 'modify', name: 'Modify', description: 'Modify drawing if needed' },
	{ id: 'program', name: 'Program', description: 'Configure and apply cutting operations' },
	{ id: 'export', name: 'Export', description: 'Render and export G-code' }
];

export interface LayerInfo {
	name: string;
	entityCount: number;
	visible: boolean;
	entityTypes: string[];
}

// Global state using the object pattern from Svelte docs
// This pattern works because we're updating properties, not reassigning the objects
export const appState = $state({
	currentStage: 'import' as AppStage['id'],
	project: {
		name: 'Untitled Project',
		currentStage: 'import',
		cutPaths: []
	} as Project,
	applicationSettings: {
		units: 'mm'
	} as ApplicationSettings,
	viewerZoomLevel: 1.0,
	hoveredShapeInfo: null as any,
	selectedShapeInfo: null as any,
	drawingDimensions: null as {
		width: number;
		height: number;
		units: string;
	} | null,
	drawingLayers: [] as LayerInfo[]
});

// Export individual getters and setters for convenience
export function getCurrentStage() {
	return appState.currentStage;
}

export function setCurrentStage(stage: AppStage['id']) {
	appState.currentStage = stage;
}

export function getProject() {
	return appState.project;
}

export function setProject(project: Project) {
	appState.project = project;
}

export function getApplicationSettings() {
	return appState.applicationSettings;
}

export function setApplicationSettings(settings: ApplicationSettings) {
	appState.applicationSettings = settings;
}

export function getViewerZoomLevel() {
	return appState.viewerZoomLevel;
}

export function setViewerZoomLevel(level: number) {
	appState.viewerZoomLevel = level;
}

export function getHoveredShapeInfo() {
	return appState.hoveredShapeInfo;
}

export function setHoveredShapeInfo(info: any) {
	appState.hoveredShapeInfo = info;
}

export function getSelectedShapeInfo() {
	return appState.selectedShapeInfo;
}

export function setSelectedShapeInfo(info: any) {
	appState.selectedShapeInfo = info;
}

export function getDrawingDimensions() {
	return appState.drawingDimensions;
}

export function setDrawingDimensions(dimensions: { width: number; height: number; units: string; } | null) {
	appState.drawingDimensions = dimensions;
}

export function getDrawingLayers() {
	return appState.drawingLayers;
}

export function setDrawingLayers(layers: LayerInfo[]) {
	appState.drawingLayers = layers;
}