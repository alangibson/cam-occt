You are absolutely correct. My apologies for the outdated API call and thank you for the correction. The `Intersect` module is indeed under `verb.geom`.

Here is the updated, corrected guide that uses `verb` for all ellipse-related intersections as requested, providing a more unified approach for curved shapes, and reflects the correct function path `verb.geom.Intersect.curves()`.

### **1. Line – Line**

- **Best Method:** Direct analytical solution.
- **How it Works:** Each line is defined by a parametric equation. By setting the two equations equal to each other, a system of two linear equations is created. Solving this system gives the exact intersection point. The intersection is valid only if the solution falls within the bounds of both line segments.
- **Recommended Library:** `kld-intersections`: Use the static method `Intersection.intersect()` with two `ShapeInfo.line()` objects.

---

### **2. Line – Polyline**

- **Best Method:** Iterative line-line intersection.
- **How it Works:** A polyline is a series of connected line segments. To find intersections, you iterate through every line segment that makes up the polyline and perform a **Line – Line** intersection test against the other line. This is handled automatically by the library.
- **Recommended Library:** `kld-intersections`: Use the static method `Intersection.intersect()` with `ShapeInfo.line()` and `ShapeInfo.polyline()` objects.

---

### **3. Line – Circle**

- **Best Method:** Analytical solution using a quadratic equation.
- **How it Works:** Substitute the parametric equation of the line into the implicit equation of the circle. This produces a quadratic equation (`at² + bt + c = 0`). Solving this equation for the parameter `t` yields zero, one (tangent), or two intersection points.
- **Recommended Library:** `kld-intersections`: Use the static method `Intersection.intersect()` with `ShapeInfo.line()` and `ShapeInfo.circle()` objects.

---

### **4. Line – Circle Arc**

- **Best Method:** Analytical solution for the full circle, followed by a bounds check.
- **How it Works:** First, the intersection between the line and the arc's parent circle is calculated. Then, each intersection point is checked to verify it lies within the start and end angles of the arc. The library handles this logic internally.
- **Recommended Library:** `kld-intersections`: Use the static method `Intersection.intersect()` with `ShapeInfo.line()` and `ShapeInfo.arc()` objects.

---

### **5. Line – Ellipse**

- **Best Method:** Convert both shapes to NURBs and use a numerical intersection routine.
- **How it Works:** The line and the ellipse are both converted into their exact NURBs representations. Then, a powerful numerical algorithm finds the intersection points between these two NURBs curves. This unifies the approach for all complex curve intersections.
- **Recommended Library:** `verb-nurbs`: Use `verb.geom.Intersect.curves()` with `verb.geom.Line` and `verb.geom.Ellipse` objects.

---

### **6. Line – Ellipse Arc**

- **Best Method:** Convert both shapes to NURBs and use a numerical intersection routine.
- **How it Works:** The line and the ellipse arc are converted into their NURBs curve representations. The standard `verb` numerical intersection algorithm is then used to find the intersection points between them.
- **Recommended Library:** `verb-nurbs`: Use `verb.geom.Intersect.curves()` with `verb.geom.Line` and `verb.geom.EllipseArc` objects.

---

### **7. Line – Spline**

- **Best Method:** Convert the line to a NURBs curve and use a NURBs–NURBs intersection routine.
- **How it Works:** A line is a degree 1 NURBs curve. By representing the line in this way, a powerful numerical algorithm can find the intersection points with the other NURBs curve. These algorithms typically subdivide the curves until they are nearly flat, then perform a simpler intersection test.
- **Recommended Library:** `verb-nurbs`: Use the function `verb.geom.Intersect.curves()` after creating a line object with `verb.geom.Line()`.

---

### **8. Polyline – Polyline**

- **Best Method:** Iterative line-line intersection.
- **How it Works:** This involves a nested loop process where every line segment in the first polyline is tested against every line segment in the second polyline. The library optimizes this process.
- **Recommended Library:** `kld-intersections`: Use the static method `Intersection.intersect()` with two `ShapeInfo.polyline()` objects.

---

### **9. Polyline – Circle**

- **Best Method:** Iterative line-circle intersection.
- **How it Works:** Iterate through each line segment of the polyline. For each segment, perform a **Line – Circle** intersection test. The library handles the iteration and collects all valid intersection points.
- **Recommended Library:** `kld-intersections`: Use the static method `Intersection.intersect()` with `ShapeInfo.polyline()` and `ShapeInfo.circle()` objects.

---

### **10. Polyline – Circle Arc**

- **Best Method:** Iterative line-circle-arc intersection.
- **How it Works:** The library iterates through each line segment of the polyline. For each segment, it performs the **Line – Circle Arc** intersection test (intersect with the full circle, then check if the point is on the arc).
- **Recommended Library:** `kld-intersections`: Use the static method `Intersection.intersect()` with `ShapeInfo.polyline()` and `ShapeInfo.arc()` objects.

---

### **11. Polyline – Ellipse**

- **Best Method:** Iterative line-ellipse intersection using NURBs conversion.
- **How it Works:** Iterate through each line segment of the polyline. In each iteration, convert the segment to a `verb.geom.Line` and intersect it with the `verb.geom.Ellipse` (which is also treated as a NURBs curve) using the numerical solver.
- **Recommended Library:** `verb-nurbs`: Loop through polyline segments, calling `verb.geom.Intersect.curves()` with a new `verb.geom.Line()` and the `verb.geom.Ellipse`.

---

### **12. Polyline – Ellipse Arc**

- **Best Method:** Iterative line-ellipse-arc intersection using NURBs conversion.
- **How it Works:** Iterate through each line segment of the polyline. In each step, convert the segment to a `verb.geom.Line` and intersect it with the `verb.geom.EllipseArc` using the numerical solver.
- **Recommended Library:** `verb-nurbs`: Loop through segments, calling `verb.geom.Intersect.curves()` with a `verb.geom.Line` and the `verb.geom.EllipseArc`.

---

### **13. Polyline – Spline**

- **Best Method:** Iterative line-NURBs intersection.
- **How it Works:** You must iterate through each line segment of the polyline. In each iteration, convert the segment into a `verb.geom.Line` and call the `verb.geom.Intersect.curves()` function against the NURBs curve.
- **Recommended Library:** `verb-nurbs`: Loop through polyline segments, calling `verb.geom.Intersect.curves()` with a new `verb.geom.Line()` in each iteration.

---

### **14. Circle – Circle**

- **Best Method:** Direct geometric analytical solution.
- **How it Works:** The intersection is solved by analyzing the distance between the circle centers relative to their radii. This directly yields zero, one, or two intersection points without solving complex polynomial equations.
- **Recommended Library:** `kld-intersections`: Use the static method `Intersection.intersect()` with two `ShapeInfo.circle()` objects.

---

### **15. Circle – Circle Arc**

- **Best Method:** Analytical solution for the full shapes, followed by a bounds check.
- **How it Works:** The intersection between the two parent circles is calculated first. Then, each intersection point is checked to ensure it lies within the angular bounds of the arc.
- **Recommended Library:** `kld-intersections`: Use the static method `Intersection.intersect()` with `ShapeInfo.circle()` and `ShapeInfo.arc()` objects.

---

### **16. Circle – Ellipse**

- **Best Method:** Convert both shapes to NURBs and use a numerical intersection routine.
- **How it Works:** The circle and the ellipse are both converted into their exact NURBs representations. The `verb` numerical intersection algorithm is then used to find the intersection points between these two NURBs curves.
- **Recommended Library:** `verb-nurbs`: Use `verb.geom.Intersect.curves()` with `verb.geom.Circle` and `verb.geom.Ellipse` objects.

---

### **17. Circle – Ellipse Arc**

- **Best Method:** Convert both shapes to NURBs and use a numerical intersection routine.
- **How it Works:** The circle and the ellipse arc are converted to NURBs curves. The standard numerical intersection algorithm is then used to find the points where they cross.
- **Recommended Library:** `verb-nurbs`: Use `verb.geom.Intersect.curves()` with `verb.geom.Circle` and `verb.geom.EllipseArc` objects.

---

### **18. Circle – Spline**

- **Best Method:** Convert the circle to its NURBs representation and use a NURBs–NURBs intersection routine.
- **How it Works:** A circle can be represented perfectly as a rational NURBs curve. Once the circle is in NURBs form, the powerful general **NURBs – NURBs** intersection algorithm can be used.
- **Recommended Library:** `verb-nurbs`: Use the function `verb.geom.Intersect.curves()` after creating a circle object with `verb.geom.Circle()`.

---

### **19. Circle Arc – Circle Arc**

- **Best Method:** Analytical solution for the full circles, followed by two bounds checks.
- **How it Works:** After calculating the intersection points of the two parent circles, each point must be checked against the angular bounds of _both_ arcs to be considered a valid intersection.
- **Recommended Library:** `kld-intersections`: Use the static method `Intersection.intersect()` with two `ShapeInfo.arc()` objects.

---

### **20. Circle Arc – Ellipse**

- **Best Method:** Convert both shapes to NURBs and use a numerical intersection routine.
- **How it Works:** The circle arc and the ellipse are converted into their NURBs representations. The numerical intersection algorithm is then used to find the points where they cross.
- **Recommended Library:** `verb-nurbs`: Use `verb.geom.Intersect.curves()` with `verb.geom.Arc` and `verb.geom.Ellipse` objects.

---

### **21. Circle Arc – Ellipse Arc**

- **Best Method:** Convert both shapes to NURBs and use a numerical intersection routine.
- **How it Works:** Both the circle arc and the ellipse arc are converted to their respective NURBs curve representations. The numerical solver then finds the intersection points between these two curves.
- **Recommended Library:** `verb-nurbs`: Use `verb.geom.Intersect.curves()` with `verb.geom.Arc` and `verb.geom.EllipseArc` objects.

---

### **22. Circle Arc – Spline**

- **Best Method:** Convert the circle arc to its NURBs representation and use a NURBs–NURBs routine.
- **How it Works:** A circle arc also has a perfect NURBs representation. After conversion, the standard **NURBs – NURBs** intersection algorithm is used.
- **Recommended Library:** `verb-nurbs`: Use the function `verb.geom.Intersect.curves()` after creating an arc object with `verb.geom.Arc()`.

---

### **23. Ellipse – Ellipse**

- **Best Method:** Convert both shapes to NURBs and use a numerical intersection routine.
- **How it Works:** Both ellipses are converted into their exact NURBs curve representations. The numerical intersection algorithm is then used to find all intersection points.
- **Recommended Library:** `verb-nurbs`: Use `verb.geom.Intersect.curves()` with two `verb.geom.Ellipse` objects.

---

### **24. Ellipse – Ellipse Arc**

- **Best Method:** Convert both shapes to NURBs and use a numerical intersection routine.
- **How it Works:** The full ellipse and the ellipse arc are both represented as NURBs curves. The numerical intersection algorithm is then used to find the points where they cross.
- **Recommended Library:** `verb-nurbs`: Use `verb.geom.Intersect.curves()` with `verb.geom.Ellipse` and `verb.geom.EllipseArc` objects.

---

### **25. Ellipse – Spline**

- **Best Method:** Convert the ellipse to its NURBs representation and use a NURBs–NURBs routine.
- **How it Works:** An ellipse can be represented perfectly as a rational NURBs curve. After conversion, the standard **NURBs – NURBs** intersection algorithm is used.
- **Recommended Library:** `verb-nurbs`: Use the function `verb.geom.Intersect.curves()` after creating an ellipse object with `verb.geom.Ellipse()`.

---

### **26. Ellipse Arc – Ellipse Arc**

- **Best Method:** Convert both shapes to NURBs and use a numerical intersection routine.
- **How it Works:** Both ellipse arcs are converted into their NURBs curve representations. The standard numerical intersection algorithm is then used to find the intersection points.
- **Recommended Library:** `verb-nurbs`: Use `verb.geom.Intersect.curves()` with two `verb.geom.EllipseArc` objects.

---

### **27. Ellipse Arc – NURBs**

- **Best Method:** Convert the ellipse arc to its NURBs representation and use a NURBs–NURBs routine.
- **How it Works:** An ellipse arc has a perfect NURBs representation. Once converted, the standard **NURBs – NURBs** intersection algorithm is used.
- **Recommended Library:** `verb-nurbs`: Use the function `verb.geom.Intersect.curves()` after creating an ellipse arc object with `verb.geom.EllipseArc()`.

---

### **28. NURBs – NURBs**

- **Best Method:** Specialized numerical intersection algorithm.
- **How it Works:** This is the most general case. The algorithm recursively subdivides the curves and checks their bounding boxes for overlap. When the resulting sub-curves are nearly linear, a direct line-segment intersection test is performed to find the precise location.
- **Recommended Library:** `verb-nurbs`: Use the core function `verb.geom.Intersect.curves()` with two NURBs curve objects.
