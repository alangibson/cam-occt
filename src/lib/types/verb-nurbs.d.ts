/**
 * Type definitions for verb-nurbs library
 */

declare module 'verb-nurbs' {
  // Basic types
  export type VerbPoint = number[];
  export type VerbVector = number[];
  export type VerbDerivatives = number[][];

  // Namespace declarations for type usage
  export namespace verb {
    namespace geom {
      // TODO remove this ignore rule when VerbCurve is renamed to actual verb type
      // eslint-disable-next-line
      interface ICurve extends VerbCurve {}
      // TODO remove this ignore rule when VerbCurve is renamed to actual verb type
      // eslint-disable-next-line
      interface ISurface extends VerbSurface {}
      type NurbsCurve = VerbCurve;
      type NurbsSurface = VerbSurface;
    }
  }

  // Core data structures
  export interface NurbsCurveData {
    degree: number;
    knots: number[];
    controlPoints: VerbPoint[];
  }

  export interface NurbsSurfaceData {
    degreeU: number;
    degreeV: number;
    knotsU: number[];
    knotsV: number[];
    controlPoints: VerbPoint[][];
  }

  export interface Interval {
    min: number;
    max: number;
  }

  export interface CurveCurveIntersection {
    u0: number;
    u1: number;
    pt: VerbPoint;
  }

  export interface ClosestPointResult {
    u: number;
    pt: VerbPoint;
    d: number;
  }

  // TODO this is actually verb.geom.NurbsCurve
  // Curve interface
  export interface VerbCurve {
    degree(): number;
    knots(): number[];
    controlPoints(): VerbPoint[];
    weights(): number[];
    asNurbs(): NurbsCurveData;
    clone(): VerbCurve;
    domain(): Interval;
    transform(mat: number[][]): VerbCurve;
    transformAsync(mat: number[][]): Promise<VerbCurve>;
    point(u: number): VerbPoint;
    pointAsync(u: number): Promise<VerbPoint>;
    tangent(u: number): VerbVector;
    tangentAsync(u: number): Promise<VerbVector>;
    derivatives(u: number, numDerivs?: number): VerbDerivatives;
    derivativesAsync(u: number, numDerivs?: number): Promise<VerbDerivatives>;
    closestPoint(pt: VerbPoint): ClosestPointResult;
    closestPointAsync(pt: VerbPoint): Promise<ClosestPointResult>;
    closestParam(pt: VerbPoint): number;
    closestParamAsync(pt: VerbPoint): Promise<number>;
    length(): number;
    lengthAsync(): Promise<number>;
    lengthAtParam(u: number): number;
    lengthAtParamAsync(u: number): Promise<number>;
    paramAtLength(len: number, tolerance?: number): number;
    paramAtLengthAsync(len: number, tolerance?: number): Promise<number>;
    divideByEqualArcLength(divisions: number): VerbPoint[];
    divideByEqualArcLengthAsync(divisions: number): Promise<VerbPoint[]>;
    divideByArcLength(arcLength: number): VerbPoint[];
    divideByArcLengthAsync(arcLength: number): Promise<VerbPoint[]>;
    split(u: number): VerbCurve[];
    splitAsync(u: number): Promise<VerbCurve[]>;
    reverse(): VerbCurve;
    reverseAsync(): Promise<VerbCurve>;
    tessellate(tolerance?: number): VerbPoint[];
    tessellateAsync(tolerance?: number): Promise<VerbPoint[]>;
  }

  // TODO this is actually verb.geom.NurbsSurface
  // Surface interface
  export interface VerbSurface {
    degree(): [number, number];
    controlPoints(): VerbPoint[][];
    knotsU(): number[];
    knotsV(): number[];
    asNurbs(): NurbsSurfaceData;
    point(u: number, v: number): VerbPoint;
    derivatives(u: number, v: number, numDerivs: number): VerbDerivatives[];
    tessellate(tolerance?: number): { points: VerbPoint[][]; faces: number[][] };
  }

  // Main verb object structure
  export const verb: {
    core: {
      Vec: {
        add(a: VerbVector, b: VerbVector): VerbVector;
        sub(a: VerbVector, b: VerbVector): VerbVector;
        mul(scalar: number, vec: VerbVector): VerbVector;
        div(vec: VerbVector, scalar: number): VerbVector;
        dot(a: VerbVector, b: VerbVector): number;
        cross(a: VerbVector, b: VerbVector): VerbVector;
        norm(vec: VerbVector): number;
        normSquared(vec: VerbVector): number;
        normalized(vec: VerbVector): VerbVector;
        dist(a: VerbPoint, b: VerbPoint): number;
        distSquared(a: VerbPoint, b: VerbPoint): number;
        angleBetween(a: VerbVector, b: VerbVector): number;
        positiveAngleBetween(a: VerbVector, b: VerbVector, n: VerbVector): number;
        signedAngleBetween(a: VerbVector, b: VerbVector, n: VerbVector): number;
        neg(arr: VerbVector): VerbVector;
        min(arr: number[]): number;
        max(arr: number[]): number;
        sum(arr: number[]): number;
        rep(num: number, ele: number): number[];
        zeros1d(rows: number): number[];
        zeros2d(rows: number, cols: number): number[][];
        zeros3d(rows: number, cols: number, depth: number): number[][][];
        range(max: number): number[];
        span(min: number, max: number, step: number): number[];
        lerp(i: number, u: VerbVector, v: VerbVector): VerbVector;
        onRay(origin: VerbPoint, dir: VerbVector, u: number): VerbPoint;
        addMutate(a: VerbVector, b: VerbVector): void;
        subMutate(a: VerbVector, b: VerbVector): void;
        mulMutate(scalar: number, vec: VerbVector): void;
      };

      Intersect: {
        curveCurve(curve1: VerbCurve, curve2: VerbCurve, tolerance?: number): CurveCurveIntersection[];
      };

      Constants: {
        TOLERANCE: number;
        EPSILON: number;
        VERSION: string;
      };

      BoundingBox: new (pts: VerbPoint[]) => {
        min: VerbPoint;
        max: VerbPoint;
        contains(pt: VerbPoint): boolean;
        intersects(bb: BoundingBox, tol: number): boolean;
        clear(): void;
        add(pt: VerbPoint): void;
        addRange(pts: VerbPoint[]): void;
      };

      Interval: new (min: number, max: number) => Interval;

      NurbsCurveData: new (degree: number, knots: number[], controlPoints: VerbPoint[]) => NurbsCurveData;

      NurbsSurfaceData: new (
        degreeU: number,
        degreeV: number,
        knotsU: number[],
        knotsV: number[],
        controlPoints: VerbPoint[][]
      ) => NurbsSurfaceData;
    };

    geom: {
      NurbsCurve: {
        new (data: NurbsCurveData): VerbCurve;
        byKnotsControlPointsWeights(
          degree: number,
          knots: number[],
          controlPoints: VerbPoint[],
          weights?: number[]
        ): VerbCurve;
        byPoints(points: VerbPoint[], degree?: number): VerbCurve;
        byControlPoints(controlPoints: VerbPoint[], degree?: number): VerbCurve;
      };

      NurbsSurface: {
        new (data: NurbsSurfaceData): VerbSurface;
      };

      Arc: {
        new (
          center: VerbPoint,
          xaxis: VerbVector,
          yaxis: VerbVector,
          radius: number,
          minAngle: number,
          maxAngle: number
        ): VerbCurve;
      };

      Circle: {
        new (center: VerbPoint, xaxis: VerbVector, yaxis: VerbVector, radius: number): VerbCurve;
      };

      Ellipse: {
        new (
          center: VerbPoint,
          xaxis: VerbVector,
          yaxis: VerbVector,
          xradius: number,
          yradius: number
        ): VerbCurve;
      };

      EllipseArc: {
        new (
          center: VerbPoint,
          xaxis: VerbVector,
          yaxis: VerbVector,
          xradius: number,
          yradius: number,
          minAngle: number,
          maxAngle: number
        ): VerbCurve;
      };

      Line: {
        new (start: VerbPoint, end: VerbPoint): VerbCurve;
      };

      BezierCurve: {
        new (points: VerbPoint[], weights?: number[]): VerbCurve;
      };

      Intersect: {
        curves(first: VerbCurve, second: VerbCurve, tol?: number): CurveCurveIntersection[];
        curvesAsync(first: VerbCurve, second: VerbCurve, tol?: number): Promise<CurveCurveIntersection[]>;
        curveAndSurface(curve: VerbCurve, surface: VerbSurface, tol?: number): CurveSurfaceIntersection[];
        curveAndSurfaceAsync(curve: VerbCurve, surface: VerbSurface, tol?: number): Promise<CurveSurfaceIntersection[]>;
        surfaces(first: VerbSurface, second: VerbSurface, tol?: number): VerbCurve[];
        surfacesAsync(first: VerbSurface, second: VerbSurface, tol?: number): Promise<VerbCurve[]>;
      };
    };

    eval: {
      Eval: {
        curvePoint(curve: NurbsCurveData, u: number): VerbPoint;
        curveDerivatives(curve: NurbsCurveData, u: number, numDerivs: number): VerbDerivatives;
        rationalCurvePoint(curve: NurbsCurveData, u: number): VerbPoint;
        rationalCurveDerivatives(curve: NurbsCurveData, u: number, numDerivs: number): VerbDerivatives;
        dehomogenize1d(controlPoints: VerbPoint[]): VerbPoint[];
        homogenize1d(controlPoints: VerbPoint[], weights: number[]): VerbPoint[];
        weight1d(controlPoints: VerbPoint[]): number[];
        rationalCurveTangent(curve: NurbsCurveData, u: number): VerbVector;
      };

      Make: {
        rationalInterpCurve(points: VerbPoint[], degree: number): NurbsCurveData;
        rationalBezierCurve(points: VerbPoint[], weights?: number[]): NurbsCurveData;
        polyline(points: VerbPoint[]): NurbsCurveData;
        arc(
          center: VerbPoint,
          xaxis: VerbVector,
          yaxis: VerbVector,
          radius: number,
          minAngle: number,
          maxAngle: number
        ): NurbsCurveData;
        ellipse(
          center: VerbPoint,
          xaxis: VerbVector,
          yaxis: VerbVector,
          xradius: number,
          yradius: number
        ): NurbsCurveData;
        ellipseArc(
          center: VerbPoint,
          xaxis: VerbVector,
          yaxis: VerbVector,
          xradius: number,
          yradius: number,
          minAngle: number,
          maxAngle: number
        ): NurbsCurveData;
      };

      Analyze: {
        rationalCurveClosestPoint(curve: NurbsCurveData, pt: VerbPoint): ClosestPointResult;
        rationalCurveClosestParam(curve: NurbsCurveData, pt: VerbPoint): number;
        rationalCurveArcLength(curve: NurbsCurveData, u?: number): number;
        rationalCurveParamAtArcLength(curve: NurbsCurveData, len: number, tolerance?: number): number;
      };

      Divide: {
        rationalCurveByEqualArcLength(curve: NurbsCurveData, divisions: number): VerbPoint[];
        rationalCurveByArcLength(curve: NurbsCurveData, arcLength: number): VerbPoint[];
        curveSplit(curve: NurbsCurveData, u: number): NurbsCurveData[];
      };

      Modify: {
        rationalCurveTransform(curve: NurbsCurveData, mat: number[][]): NurbsCurveData;
        curveReverse(curve: NurbsCurveData): NurbsCurveData;
      };

      Tess: {
        rationalCurveAdaptiveSample(curve: NurbsCurveData, tolerance?: number, includeKnots?: boolean): VerbPoint[];
      };

      Check: {
        isValidNurbsCurveData(data: NurbsCurveData): NurbsCurveData;
      };
    };

  };

  // Global constants
  export const TOLERANCE: number;
  export const EPSILON: number;
  export const VERSION: string;

  // Default export is the verb object
  export default verb;
}