# Offset System

## Arcs

### Arc Offset Fundamentals

When offsetting an arc:
- **Outset** (positive offset): Creates an arc with radius = original_radius + offset_distance
- **Inset** (negative offset): Creates an arc with radius = original_radius - offset_distance
- The center point and angular span remain identical
- Start and end points are recalculated based on the new radius

### Arc Offsets in Chains

**CRITICAL**: The inset/outset nature of an individual arc offset does NOT determine whether it belongs to the inner or outer chain offset. The correct classification depends on the arc's position and orientation within the chain, not its radius

## Chains

### Overview

Chain offsetting generates offset shapes for all shapes in a chain, trims them to create sharp corners, and then classifies them geometrically based on their spatial relationship to the original chain.

Chains have offsets that completely offset the entire chain. In that sense the are offset chains, ie chains of individual offset shapes.

Chain offsetting code goes in ./src/lib/algorithms/offset-calculation/chain. This directory should contain *all* chain offset related code and tests.

Offset left/right or inner/outer status of shapes that are in a chain are irrelevant to the chain. They must be spatially reclassified on the chain level.

### Invariants

**CRITICAL**: These invariants must ALWAYS be satisfied for any chain offsetting.

Chain offsets must never cross original chain. If an offset chain crosses the original chain, it indicates a fundamental error in the offset calculation or direction classification. This should NEVER happen.

Topological correctness: Maintain continuity and intended direction. Closed chains remain closed with consistent winding; open chains remain open.

Geometric correctness: Remove overlaps and fill gaps accurately within tolerance.

Parallel-offset invariant: Offsets must stay parallel to their original shapes. Any deviation outside explicit filler transitions is a bug.

Sharp-corner preference: Produce corners as sharp as possible, smoothing only when necessary to avoid gaps or collisions.

Determinism/Robustness: Always produce the same result for the same input; handle small gaps, overlaps, and nearly-coincident geometry reliably.

Perpendicular Distance: Every point on an offset line must be exactly the offset distance from the corresponding point on the original line 
(measured perpendicular to the line)

Extension Correctness: When lines are extended, the extended portions must maintain the perpendicular distance rule

### Procedure

#### 1. Create offsets

Closed chains: The chain offset algorithm must absolutely disregard the provided inner/outer labels. It must determine geometrically which offsets lie inside and which lie outside the chain. This is done by evaluating points offset from the primitive’s midpoint along its normal and checking whether they are contained within the chain polygon.

Open chains: Pick an arbitrary “right” or “left” orientation for the chain as a whole, but the algorithm must still determine geometrically which side each shape offset lies on. This ensures correct trimming and gap-filling regardless of initial labels.

This side determination step is the foundation for all trimming, filling, and parallelism checks. If it is wrong, every downstream operation will produce incorrect toolpaths.

1. Generate ALL possible shape offsets (both positive and negative distances)
2. Group them geometrically based on their spatial relationship to the original chain
3. Use pure geometric detection to determine inside/outside or left/right side classification

#### 2. Detect Intersections

For each adjacent offset pair, compute all intersections. For large offsets, also check a small neighborhood of non-adjacent offsets where geometric proximity makes overlaps possible.

#### 3. Classify Intersection Types
- **Overlap:** Offsets intersect in a way that one intrudes into the other. These regions must be trimmed.
- **Gap:** Endpoints do not meet. Requires filler.
- **Tangential contact:** Endpoints meet tangentially; preserve tangency.

#### 4. Choose Trimming Points
At each joint, select the intersection closest to the joint point along both offsets that lies on the correct side. Use geometric side determination, not metadata. Ensure trimming leaves each offset on the intended side of the chain.

#### 5. Trim overlap
Remove the overlapping portions beyond the chosen intersection points. Maintain exact geometry for trimmed primitives.

For any consecutive shape offsets in the chain offset that overlap, trim them at their intersection point. Intersection point need not be exact, only needs to be within the global tolerance setting (default = 0.05)

#### 6. Fill gaps
If endpoint separation ≤ γ, snap them together.

For any consecutive shape offsets in the chain offset that do not meet at a common intersection point, fill the gaps in the way that produces the sharpest possible corner. The proper method depends on shape type:

- line: extend the line
- circle arc: move start or end point along radius
- spline: extend the spline
- ellipse arc: same as circle arc
- polyline: same as line

Same tolerance rule applies as with 'trim overlap'.

#### 7. Local Conflict Resolution
Check for overlaps or gaps introduced by trimming/filling with immediate neighbors. Resolve with small-scale union/difference operations to ensure local cleanliness.

#### 8. Validate Parallelism
Sample normals along each offset and measure distance to the corresponding original primitive. Any deviation beyond ε outside of filler regions indicates a bug.

#### 9. Final Checks
Ensure continuity, correct side assignment, and absence of self-intersections. For closed chains, confirm winding consistency.

### Important Notes

- Don't propose solutions where shape offsetting logic is aware of chain offsets.
- Trimming preserves shape order and chain continuity
- Works with all shape types (line, arc, circle, polyline, spline, ellipse)
- Classification is purely geometric - ensures consistency regardless of how offsets were generated
- Line trimming MUST extend lines to intersection points
- Validation should check perpendicular distance and parallelism only
- Gap filling should only be used when geometric intersection is impossible
- Extended line portions must maintain constant perpendicular distance from original
- Analytic intersections: Use exact formulas for line/arc combinations.
- Spline intersections: Use bounding-box subdivision with numeric root-finding and parameter polishing.
- Cluster near-duplicate intersection points within γ.
- Snap parameters near endpoints to the exact endpoint.
- For convex corners in outward offsets, expect gaps; fill only if necessary.
- For concave corners in outward offsets, expect overlaps; trim precisely at intersection.
- Avoid rounding unless toolpath safety or physical kerf behavior demands it.
- ε: max(1e-6 units, diagonal_bbox × 1e-8)
- γ: ~10×ε
- Neighborhood check distance: proportional to |d| and average primitive length

## Definitions
- **Chain** — Ordered list of connected primitives where each ends where the next begins.
- **Offset primitive** — Offset of an individual primitive at distance *d* after correct side determination.
- **Tolerance (ε)** — Small positive value for geometric precision.
- **Snap threshold (γ)** — Distance below which endpoints are merged.

## Testing & Verification
- CRITICAL: do not fake tests by adding 'mock' data that makes it pass
- Follow test driven development
- Write mathematical validation before visual tests
- If a visual validation error is reported, also check the svg to make sure you have truly fixed the error
- Do not just change tests to make them pass. Fix the root cause.
- Include geometric cases such as:
    - Convex line-line corners (gap handling)
    - Concave line-line corners (overlap trimming)
    - Arc-line joints with large offset
    - Spline-spline transitions with high curvature
    - Closed chain with mixed primitives and misleading `inner`/`outer` metadata

Each case verifies: correct side detection, parallelism, sharpness preservation, and gap/overlap resolution.
