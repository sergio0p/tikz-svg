# TikZ Loop Edge Geometry Reference

This directory contains extracted source code and documentation from TeX Live 2025 describing how TikZ computes self-loop control points and edge geometry.

## Files in This Reference

### Source Code (from TeX Live 2025)

- **`tikzlibrarytopaths.code.tex`** (11 KB)
  - Official TikZ `to` path library implementation
  - Contains loop style definitions, distance calculations, control point positioning
  - **Key sections:** Lines 62–375
  - **Critical sections:** 176–223 (distance algorithm), 225–230 (control point positioning), 364–375 (loop styles)

- **`tikzlibraryautomata.code.tex`** (3.9 KB)
  - Official TikZ automata library (states, initial/accepting arrows)
  - Referenced by main `tikz.code.tex`
  - Note: Loop behavior defined in `tikzlibrarytopaths`, not here

### Documentation (Created for tikz-svg)

- **`QUICK_REFERENCE.txt`** ⭐ **START HERE**
  - Quick lookup for default parameters and formulas
  - Loop angles by direction
  - Implementation checklist
  - Example calculation walkthrough

- **`EXTRACTION_MAP.md`**
  - Line-by-line breakdown of critical source code sections
  - Detailed table of parameters with defaults
  - JavaScript implementation guidance
  - Constant summary for code

- **`LOOP_GEOMETRY_NOTES.md`**
  - Full algorithm explanation with TeX code
  - JavaScript pseudocode for control distance calculation
  - Step-by-step walkthrough of TikZ computation pipeline

- **`README_LOOP_GEOMETRY.md`** (this file)
  - Overview and navigation guide

## Key Findings

### Loop Parameters

| Parameter | Default | For Self-Loops | Unit |
|-----------|---------|---|---|
| **looseness** | 1 | **8** | multiplier |
| **out angle** | 45° | 75–105° | degrees |
| **in angle** | 135° | 75–105° | degrees |
| **min distance** | 0 | **5mm** | length |

### Control Point Distance Formula

```
base_distance = 0.3915 × distance_between_nodes
control_distance = looseness × base_distance
                 = 8 × 0.3915 × distance_between_nodes
                 = 3.132 × distance_between_nodes

control_distance = clamp(control_distance, 5mm, 10000pt)
```

For self-loops where `distance_between_nodes = 0`, the min_distance (5mm) provides a default.

### Loop Direction Styles

```
loop above:  out = 105°, in = 75°    (arc curves upward)
loop below:  out = 285°, in = 255°   (arc curves downward)
loop left:   out = 195°, in = 165°   (arc curves left)
loop right:  out = 15°,  in = -15°   (arc curves right)
```

### Control Point Positioning

```
cp_out = node_center + (distance × cos(out_angle), distance × sin(out_angle))
cp_in  = node_center + (distance × cos(in_angle),  distance × sin(in_angle))
```

For self-loops, both control points are calculated from the same node center.

## For tikz-svg Implementation

### Where to Use This

Implement loop edge rendering in: `/src/geometry/edges.js`

### Implementation Steps

1. Detect when `source_node === target_node` (self-loop)
2. Determine loop direction: `'above'`, `'below'`, `'left'`, or `'right'`
3. Extract angle pair from direction (see tables in QUICK_REFERENCE.txt)
4. Calculate control distance using formula above
5. Compute control point positions using polar coordinates
6. Create cubic Bézier path in SVG

### Reference Constants

```javascript
const LOOP_LOOSENESS_DEFAULT = 8;
const LOOP_MIN_DISTANCE_PT = 14.17;  // 5mm ≈ 14.17 points
const BASE_DISTANCE_MULTIPLIER = 0.3915;

const LOOP_ANGLES = {
  'above': { out: 105, in: 75 },
  'below': { out: 285, in: 255 },
  'left': { out: 195, in: 165 },
  'right': { out: 15, in: -15 }
};
```

## File Locations

All files are located in: `/Users/sergiop/Dropbox/Scripts/tikz-svg/References/`

```
References/
├── tikzlibrarytopaths.code.tex       [TeX Live 2025 source]
├── tikzlibraryautomata.code.tex      [TeX Live 2025 source]
├── QUICK_REFERENCE.txt               [Quick lookup]
├── EXTRACTION_MAP.md                 [Detailed breakdown]
├── LOOP_GEOMETRY_NOTES.md            [Algorithm explanation]
└── README_LOOP_GEOMETRY.md           [This file]
```

## How to Navigate

1. **Quick lookup:** Read `QUICK_REFERENCE.txt`
2. **Implementation details:** See `EXTRACTION_MAP.md` (Constants Summary table)
3. **Algorithm deep-dive:** Read `LOOP_GEOMETRY_NOTES.md`
4. **Source code:** Refer to specific line numbers in `tikzlibrarytopaths.code.tex`

## Key Source Code Sections

### In tikzlibrarytopaths.code.tex

| Section | Lines | Purpose |
|---------|-------|---------|
| Loop style definitions | 364–375 | Defines `loop`, `loop above`, `loop below`, `loop left`, `loop right` |
| Default constants | 119–130 | Default angles, looseness, distance bounds |
| Distance calculation | 176–223 | Computes control point distances from node positions |
| Control point positioning | 225–230 | Places control points relative to nodes |
| Looseness registration | 62–64 | Registers `looseness`, `in looseness`, `out looseness` options |

## Important Notes

- **TikZ angle convention:** 0° = East, counter-clockwise positive (differs from SVG)
- **Fixed-point math in TikZ:** Lines 188, 197 use fixed-point scaling (16×value / 255)
- **Self-loop special handling:** Line 365 sets `tikztotarget = tikztostart` for self-loops
- **Cubic Bézier format:** `M start C cp1, cp2, end` (SVG path notation)

## References

- TeX Live 2025: `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/`
- TikZ/PGF Documentation: https://tikz.dev/
- SVG Cubic Bézier Paths: https://developer.mozilla.org/en-US/docs/Web/SVG/Tutorial/Paths

---

**Created:** 2026-03-23  
**Source Distribution:** TeX Live 2025  
**Project:** tikz-svg (JavaScript TikZ → SVG renderer)
