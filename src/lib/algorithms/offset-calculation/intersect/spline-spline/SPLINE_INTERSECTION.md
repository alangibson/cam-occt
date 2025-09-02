## General Intersection Framework for Spliens

1. **Parameterize both curves**

   * A NURBS spline is given as

     $$
     P(t), \quad t \in [t_{\min}, t_{\max}]
     $$

     where $P(t)$ evaluates the curve from its control points, knots, and degree.
   * The other curve (arc, line, etc.) can be parameterized as $Q(s)$ in a similar form.

2. **Set up the intersection equation**

   $$
   P(t) - Q(s) = 0
   $$

   Which gives two equations in two unknowns $(t, s)$ in 2D.

3. **Use bounding-box pruning first**

   * Recursively subdivide the curves and discard boxes that don’t overlap (Bezier clipping or interval pruning).
   * This avoids unnecessary numeric solving.

4. **Numerically solve candidate pairs**

   * Use Newton–Raphson or bivariate root finding on $f(t, s) = P(t) - Q(s)$ to refine intersection points to within tolerance.

5. **Validate**

   * Check that solutions are within both curves’ parameter domains (respect arc angles, segment lengths, knot range).
   * Remove duplicates within tolerance.

---

## **Case-by-Case Notes**

### **1. Spline vs. Circle Arc**

* **Parameterize circle arc:**

  $$
  Q(s) = C + R \cdot (\cos s, \sin s), \quad s \in [\theta_1, \theta_2]
  $$
* After pruning with bounding boxes, solve:

  $$
  \|P(t) - C\|^2 - R^2 = 0
  $$

  and ensure the angle from $C$ lies within arc bounds.

---

### **2. Spline vs. Ellipse Arc**

* **Parameterize ellipse arc:**

  $$
  Q(s) = C + (a \cos s, b \sin s), \quad s \in [\theta_1, \theta_2]
  $$

  with optional rotation transform.
* Intersection equation is:

  $$
  \frac{(x - C_x)^2}{a^2} + \frac{(y - C_y)^2}{b^2} - 1 = 0
  $$
* Angle filtering as with the circle arc.

---

### **3. Spline vs. Line**

* **Parameterize line:**

  $$
  Q(s) = P_0 + s \cdot (P_1 - P_0), \quad s \in [0, 1]
  $$
* Solve:

  $$
  P(t) - Q(s) = 0
  $$
* Or, substitute $Q(s)$ into $P(t)$ and solve one equation by projecting onto the perpendicular direction of the line.

---

### **4. Spline vs. Polyline**

* Treat each polyline segment as a line (case 3) and check intersections segment-by-segment.
* Keep all valid intersection points.

---

### **5. Spline vs. Spline**

* Both curves are NURBS:

  $$
  P(t), \quad Q(s)
  $$
* Use recursive subdivision (Bezier clipping) on both until segments are flat enough to approximate as lines, then test those lines for intersection (case 3).
* Alternatively, run a full bivariate Newton solve:

  $$
  P(t) - Q(s) = 0
  $$
* Multiple intersections possible; subdivision helps ensure none are missed.

---

If you like, I can also **write Claude Code a concrete pseudo-code algorithm** that implements these cases with Bezier clipping and Newton refinement so it’s implementation-ready. That would make it easier to hand over directly.

Do you want me to prepare that implementation-style guide?

---

## Implementation Plan: Fix Spline-Line Intersection False Positives

### Problem Analysis

Based on the visual output showing excessive yellow intersection points for splines, the current implementation has several issues:

1. **Overly Large Tolerance**: `SUBDIVISION_FLATNESS_TOLERANCE = 0.1` is too large, causing distant points to be considered intersections
2. **Simplified Spline Evaluation**: Uses basic Bezier approximation instead of proper NURBS evaluation with knots and weights
3. **Fixed Subdivision**: Uses uniform subdivision regardless of curve complexity
4. **Weak Validation**: Accepts candidates with low geometric accuracy

### Root Causes

- `evaluateSpline()` fallback to linear interpolation (lines 575-582) oversimplifies complex splines
- `SUBDIVISION_FLATNESS_TOLERANCE = 0.1` accepts geometrically distant points as intersections
- Fixed `numSubdivisions` doesn't adapt to curve complexity
- `signedDistanceToLine()` check with large tolerance generates false positives

### Solution Strategy

#### Phase 1: Reduce False Positives Immediately
1. **Tighten tolerance** from 0.1 to 0.01 (90% reduction)
2. **Strengthen geometric validation** in candidate detection
3. **Improve clustering** to merge near-duplicates more aggressively

#### Phase 2: Improve Spline Evaluation  
1. **Replace simplified evaluation** with proper NURBS math using control points, knots, and weights
2. **Fix derivative calculations** to use analytical derivatives instead of finite differences
3. **Handle degenerate cases** properly (single point, linear splines)

#### Phase 3: Adaptive Algorithms
1. **Implement adaptive subdivision** based on curve curvature
2. **Add bounding box pre-filtering** for better performance
3. **Improve Newton-Raphson convergence** criteria

### Implementation Steps

1. Reduce `SUBDIVISION_FLATNESS_TOLERANCE` to 0.01
2. Add stricter geometric validation in `findSplineLineCandidates()`
3. Improve duplicate filtering tolerance in `filterDuplicateCandidates()`
4. Replace `evaluateSpline()` with proper NURBS evaluation
5. Update `evaluateSplineDerivative()` with analytical derivatives
6. Add adaptive subdivision based on curve complexity
7. Strengthen Newton-Raphson convergence criteria
8. Update unit tests to verify accuracy improvements

### Success Criteria

- Reduce false positive intersections by 90%+
- Maintain detection of actual intersections
- Pass all existing unit tests
- Improve intersection confidence scores
- Visual output shows single yellow points at actual intersections

### Todo List

- [ ] **Phase 1: Immediate fixes**
  - [ ] Reduce `SUBDIVISION_FLATNESS_TOLERANCE` from 0.1 to 0.01
  - [ ] Strengthen geometric validation in `findSplineLineCandidates()` 
  - [ ] Improve duplicate filtering in `filterDuplicateCandidates()`
  - [ ] Run visual tests to verify improvement
- [ ] **Phase 2: Proper NURBS evaluation**
  - [ ] Replace `evaluateSpline()` with proper NURBS math
  - [ ] Update `evaluateSplineDerivative()` with analytical derivatives
  - [ ] Handle edge cases (single point, linear splines)
  - [ ] Test with complex splines
- [ ] **Phase 3: Advanced improvements**
  - [ ] Implement adaptive subdivision based on curvature
  - [ ] Add better bounding box pre-filtering
  - [ ] Improve Newton-Raphson convergence criteria
  - [ ] Performance testing and optimization
- [ ] **Validation**
  - [ ] Update unit tests to verify accuracy
  - [ ] Run visual tests on all chain types
  - [ ] Verify single intersection points in visual output
  - [ ] Performance regression testing
