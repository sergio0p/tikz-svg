# TikZ Loop Edge Geometry Analysis

## Files Extracted from TeX Live 2025

### 1. tikzlibrarytopaths.code.tex
**Location:** `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/`
**Size:** Defines the `to` path library with loop, bend, curve rendering
**Status:** ✓ Copied to References/

### 2. tikzlibraryautomata.code.tex  
**Location:** `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/`
**Size:** Defines automata-specific styles (states, initial/accepting)
**Status:** ✓ Copied to References/

---

## Key Default Values for Loop Parameters

### Loop Style Definition (Lines 364-375)
```
\tikzset{loop/.style={
  to path={
    \pgfextra{\let\tikztotarget=\tikztostart}
    [looseness=8, min distance=5mm, every loop]
    \tikz@to@curve@path
  }
}}
```

**Default Loop Looseness:** `8` (very loose for self-loops)  
**Default Min Distance:** `5mm` (minimum from node center)

### Directional Loop Styles
```
loop right:  out=15°,   in=-15°   (exits/enters at 15° on right)
loop above:  out=105°,  in=75°    (exits/enters near top-left/top-right)
loop left:   out=195°,  in=165°   (exits/enters at left)
loop below:  out=285°,  in=255°   (exits/enters near bottom)
```

### Default in/out Angles (Lines 119-122)
```
\def\tikz@to@bend{30}      % bend curve parameter
\def\tikz@to@out{45}       % default exit angle
\def\tikz@to@in{135}       % default entry angle
```

### Default Looseness Values (Lines 124-125)
```
\def\tikz@to@out@looseness{1}  % out control point distance multiplier
\def\tikz@to@in@looseness{1}   % in control point distance multiplier
```

### Distance Bounds (Lines 127-130)
```
\def\tikz@to@in@min{0pt}        % minimum entry control point distance
\def\tikz@to@in@max{10000pt}    % maximum entry control point distance
\def\tikz@to@out@min{0pt}       % minimum exit control point distance
\def\tikz@to@out@max{10000pt}   % maximum exit control point distance
```

---

## Control Point Calculation Algorithm

### Main Distance Computation (Lines 176-223)

The algorithm computes control point distances based on the Euclidean distance between nodes:

1. **Vector Difference** (Lines 177-179)
   ```
   diff = target - start
   |diff_x| = absolute value of x-component
   |diff_y| = absolute value of y-component
   ```

2. **Normalization** (Line 183)
   ```
   normalized = normalize(|diff_x|, |diff_y|)
   ```

3. **Distance Factor Calculation** (Lines 184-202)
   - If normalized_x > normalized_y, use x-component
   - Else use y-component
   - Apply fixed-point division: `16 * distance / 255`
   - Result is normalized distance in PGF units

4. **Control Point Distance** (Line 203)
   ```
   base_distance = 0.3915 * normalized_distance
   ```

5. **Apply Looseness Multiplier** (Lines 204-205)
   ```
   out_control_dist = out_looseness * base_distance
   in_control_dist = in_looseness * base_distance
   ```
   
   **Key:** For loops with `looseness=8`, control points are **8x farther** from node

6. **Clamp to Min/Max** (Lines 207-222)
   ```
   out_control_dist = clamp(out_control_dist, out_min, out_max)
   in_control_dist = clamp(in_control_dist, in_min, in_max)
   ```

### Control Point Position Computation (Lines 225-230)

After distance calculation, control points are positioned:

```
\tikz@to@start@compute@looseness:
  computed_start = [shift=(out_angle : distance)] start_node

\tikz@to@end@compute@looseness:
  computed_end = [shift=(in_angle : distance)] end_node
```

**Result:** Cubic Bézier path with control points placed relative to nodes at specified angles.

### Final Path Construction (Line 162)
```
path = .. controls computed_start and computed_end .. (target)
```

This generates a cubic Bézier curve from source to target node.

---

## Loop Self-Reference Special Handling (Line 365)

```
\pgfextra{\let\tikztotarget=\tikztostart}
```

For self-loops, the target is set equal to the source. The distance computation then:
1. Calculates diff = (0, 0) nominally
2. But the `looseness` parameter still applies
3. The `in` and `out` angles determine the curve direction
4. Min distance prevents degenerate loops

---

## Implementation Notes for tikz-svg

### Formula Summary for JavaScript

```javascript
// Pseudocode for control point distance calculation
function computeControlDistance(startNode, endNode, looseness, minDist, maxDist) {
  // Vector from start to end
  let dx = endNode.x - startNode.x;
  let dy = endNode.y - startNode.y;
  
  // Absolute values
  let absDx = Math.abs(dx);
  let absDy = Math.abs(dy);
  
  // Normalize to [0, 1]
  let maxDist_val = Math.max(absDx, absDy);
  let normX = maxDist_val > 0 ? absDx / maxDist_val : 0;
  let normY = maxDist_val > 0 ? absDy / maxDist_val : 0;
  
  // Use larger component
  let normalizedDist = normX > normY ? normX : normY;
  
  // Apply fixed constant (0.3915) and looseness
  let baseDistance = 0.3915 * normalizedDist * maxDist_val;
  let controlDist = looseness * baseDistance;
  
  // Clamp to bounds
  controlDist = Math.max(minDist, Math.min(controlDist, maxDist));
  
  return controlDist;
}
```

### Default Loop Parameters for Implementation

For automata self-loops without explicit parameters:
- **looseness:** 8
- **out_angle:** 75–105° (depends on `loop above/below/left/right`)
- **in_angle:** 75–105° (complementary to out_angle)
- **min_distance:** 5mm (~14.17 points)
- **out_looseness_multiplier:** 8
- **in_looseness_multiplier:** 8

---

## References

- **tikzlibrarytopaths.code.tex:** Lines 62–375 (all loop/looseness code)
- **tikzlibraryautomata.code.tex:** Lines 1–105 (automata state styles)
