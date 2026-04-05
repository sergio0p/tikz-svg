# TikZ Loop Geometry Source Code Extraction Map

## Files Located and Copied

| File | Path | Size | Purpose |
|------|------|------|---------|
| `tikzlibrarytopaths.code.tex` | `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/` | 11K | Implements `to` path library with loop, bend, curve rendering |
| `tikzlibraryautomata.code.tex` | `/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/libraries/` | 3.9K | Automata-specific styles: states, initial/accepting markers |

Both files now in: `docs/References/`

---

## Key Sections in tikzlibrarytopaths.code.tex

### Loop Styles Definition (CRITICAL)
**Lines 364–375:** Loop style configuration with default parameters

```tex
\tikzset{loop/.style={
  to path={
    \pgfextra{\let\tikztotarget=\tikztostart}
    [looseness=8,min distance=5mm,every loop]
    \tikz@to@curve@path
  }}}

\tikzset{every loop/.style={->,shorten >=1pt}}
\tikzset{loop right/.style={right,out=15,in=-15,loop}}
\tikzset{loop above/.style={above,out=105,in=75,loop}}
\tikzset{loop left/.style={left,out=195,in=165,loop}}
\tikzset{loop below/.style={below,out=285,in=255,loop}}
```

**Key Parameters:**
- `looseness=8` — Default multiplier for control point distance
- `min distance=5mm` — Minimum distance from node center (≈ 14.17 pt)
- `out=105°, in=75°` — Default exit/entry angles (varies per direction)

---

### TikZOption Registrations (Lines 62–64)
```tex
\tikzoption{in looseness}{\tikz@to@set@in@looseness{#1}}
\tikzoption{out looseness}{\tikz@to@set@out@looseness{#1}}
\tikzoption{looseness}{\tikz@to@set@in@looseness{#1}\tikz@to@set@out@looseness{#1}}
```

**Function:** Registers user-settable `looseness` parameters

---

### Default Constants (Lines 119–130)
```tex
\def\tikz@to@bend{30}              % bend curve parameter
\def\tikz@to@out{45}               % default exit angle
\def\tikz@to@in{135}               % default entry angle
\def\tikz@to@out@looseness{1}      % output looseness multiplier (default)
\def\tikz@to@in@looseness{1}       % input looseness multiplier (default)
\def\tikz@to@in@min{0pt}           % minimum input control distance
\def\tikz@to@in@max{10000pt}       % maximum input control distance
\def\tikz@to@out@min{0pt}          % minimum output control distance
\def\tikz@to@out@max{10000pt}      % maximum output control distance
```

**Important:** Loop styles override with `looseness=8`, not the default `1`

---

### Main Path Computation (Lines 134–163)
```tex
\def\tikz@to@curve@path{
  [every curve to]
  \pgfextra{\iftikz@to@relative\tikz@to@compute@relative\else\tikz@to@compute\fi}
  \tikz@computed@path
  \pgfextra{\tikz@updatenexttrue\tikz@updatecurrenttrue}%
  \tikztonodes%
}

\def\tikz@to@compute{
  \let\tikz@tofrom=\tikztostart
  \let\tikz@toto=\tikztotarget
  \tikz@to@modify\tikz@tofrom\tikz@to@out
  \tikz@to@modify\tikz@toto\tikz@to@in
  % ... compute distances ...
  \tikz@to@start@compute
  \tikz@to@end@compute
  \edef\tikz@computed@path{.. controls \tikz@computed@start and \tikz@computed@end .. (\tikztotarget)}
}
```

**Result:** Cubic Bézier path: `.. controls pt1 and pt2 .. end`

---

### Distance Calculation Algorithm (Lines 165–223) — CRITICAL
```tex
\def\tikz@to@compute@distance@main{%
  \pgf@process{\pgfpointdiff{\tikz@first@point}{\tikz@second@point}}%
  \ifdim\pgf@x<0pt\pgf@xa=-\pgf@x\else\pgf@xa=\pgf@x\fi%
  \ifdim\pgf@y<0pt\pgf@ya=-\pgf@y\else\pgf@ya=\pgf@y\fi%
  
  % Normalize to [0, 1]
  \pgf@process{\pgfpointnormalised{\pgfqpoint{\pgf@xa}{\pgf@ya}}}%
  \ifdim\pgf@x>\pgf@y%
    \c@pgf@counta=\pgf@x%
    \ifnum\c@pgf@counta=0\relax%
    \else%
      \divide\c@pgf@counta by 255\relax%
      \pgf@xa=16\pgf@xa\relax%
      \divide\pgf@xa by\c@pgf@counta%
      \pgf@xa=16\pgf@xa\relax%
    \fi%
  \else%
    \c@pgf@counta=\pgf@y%
    % ... similar logic for Y ...
  \fi%
  
  % Apply 0.3915 constant and looseness multipliers
  \pgf@x=0.3915\pgf@xa%
  \pgf@xa=\tikz@to@out@looseness\pgf@x%     % OUT control distance
  \pgf@xb=\tikz@to@in@looseness\pgf@x%      % IN control distance
  
  % Clamp to min/max bounds
  \pgfmathsetlength{\pgf@ya}{\tikz@to@out@min}
  \ifdim\pgf@xa<\pgf@ya\pgf@xa=\pgf@ya\fi%
  \pgfmathsetlength{\pgf@ya}{\tikz@to@out@max}
  \ifdim\pgf@xa>\pgf@ya\pgf@xa=\pgf@ya\fi%
  \pgfmathsetlength{\pgf@ya}{\tikz@to@in@min}
  \ifdim\pgf@xb<\pgf@ya\pgf@xb=\pgf@ya\fi%
  \pgfmathsetlength{\pgf@ya}{\tikz@to@in@max}
  \ifdim\pgf@xb>\pgf@ya\pgf@xb=\pgf@ya\fi%
}
```

**Algorithm Steps:**
1. Compute vector: `(dx, dy) = target - source`
2. Get absolute values: `|dx|, |dy|`
3. Normalize: `normalized = |dx| or |dy|` (whichever is larger, using fixed-point math)
4. Base distance: `base = 0.3915 × normalized_distance`
5. Apply looseness: `control_distance = looseness × base`
6. Clamp: `control_distance ∈ [min, max]`

---

### Control Point Positioning (Lines 225–230) — CRITICAL
```tex
\def\tikz@to@start@compute@looseness{%
  \edef\tikz@computed@start{([shift=({\tikz@to@out}:\the\pgf@xa)]\tikz@tofrom)}%
}

\def\tikz@to@end@compute@looseness{%
  \edef\tikz@computed@end{([shift=({\tikz@to@in}:\the\pgf@xb)]\tikz@toto)}%
}
```

**Meaning:**
- `computed_start = shift(source_node by distance in out_angle direction)`
- `computed_end = shift(target_node by distance in in_angle direction)`

For loops: `out_angle ∈ [75°, 105°]` and `in_angle ∈ [75°, 105°]`

---

## Key Sections in tikzlibraryautomata.code.tex

### State and Initial/Accepting Styles (Lines 18–35)
```tex
\tikzset{state without output/.style={circle,draw,minimum size=2.5em,every state}}
\tikzset{state with output/.style={circle split,draw,minimum size=2.5em,every state}}
\tikzset{accepting by arrow/.style={...}}
\tikzset{accepting by double/.style={double,outer sep=.5\pgflinewidth+.3pt}}
\tikzset{initial by arrow/.style={...}}
```

**Note:** Automata library itself doesn't define loop behavior — it relies on `tikzlibrarytopaths`.

---

## Constant Summary for JavaScript Implementation

| Parameter | Default | For Loops | Type | Notes |
|-----------|---------|-----------|------|-------|
| `out` | 45° | 75°–105° | angle | Exit angle from source node |
| `in` | 135° | 75°–105° | angle | Entry angle to target node |
| `looseness` | 1 | **8** | multiplier | Control point distance multiplier |
| `out looseness` | 1 | **8** | multiplier | Specific to exit control point |
| `in looseness` | 1 | **8** | multiplier | Specific to entry control point |
| `min distance` | 0 | **5mm** | length | Minimum distance from node center |
| `max distance` | 10000pt | 10000pt | length | Maximum distance from node center |
| `base constant` | — | **0.3915** | factor | Multiplies normalized distance |

---

## For Implementation in tikz-svg

**When rendering a self-loop in automata:**

1. Detect loop: `source_node === target_node`
2. Set direction: Use `loop above`, `loop below`, `loop left`, or `loop right` style
3. Extract angles: `out_angle` and `in_angle` from chosen direction
4. Calculate control distance:
   ```
   distance = 0.3915 × 8 × node_distance
   distance = clamp(distance, 5mm, 10000pt)
   ```
5. Position controls:
   ```
   control_out = node_center + (distance × cos(out_angle), distance × sin(out_angle))
   control_in = node_center + (distance × cos(in_angle), distance × sin(in_angle))
   ```
6. Render Bézier: `node → control_out → control_in → node`

---

## Mathematical Constants Reference

- **0.3915:** Empirically determined multiplier in PGF (likely derived from typical node dimensions)
- **8:** Loop default looseness (makes loops 8× larger than regular edges)
- **5mm ≈ 14.17 pt:** Standard minimum distance for loop edges
- **255:** Fixed-point precision denominator in PGF (line 188, 197)
- **16:** Fixed-point scaling factor (lines 189, 191, 198, 200)

