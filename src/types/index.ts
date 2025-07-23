export interface AppStage {
	id: 'import' | 'modify' | 'program' | 'export';
	name: string;
	description: string;
}

export interface Material {
	name: string;
	thickness: number;
	feedRate: number;
	cutHeight: number;
}

export interface CutPath {
	id: string;
	geometry: any; // OpenCascade geometry
	feedRate: number;
	cutHeight: number;
}

export type UnitType = 'mm' | 'inches';

export interface ApplicationSettings {
	units: UnitType;
	// Future settings can be added here
}

export interface Project {
	name: string;
	currentStage: AppStage['id'];
	importedFile?: File;
	geometry?: any; // OpenCascade geometry
	cutPaths: CutPath[];
	material?: Material;
	units?: UnitType; // Units detected from DXF file, overrides application default
}