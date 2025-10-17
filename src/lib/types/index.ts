export * from './algorithm-parameters';
export * from './cam';
export * from './direction';
export * from './geometry';
export * from '$lib/cam/part/part-detection';
export * from './ui';
export { Unit } from '$lib/utils/units';
export { WorkflowStage } from '$lib/stores/workflow/enums';

// Re-export geometry types for backward compatibility
export type { Arc } from '$lib/geometry/arc';
export type { Circle } from '$lib/geometry/circle';
export type { Line } from '$lib/geometry/line';
export type { Ellipse } from '$lib/geometry/ellipse';
export type { Polyline, PolylineVertex } from '$lib/geometry/polyline';
