## tikz-svg labelDistance asymmetry bug

`labelDistance` works on `labelSide: 'left'` but has little/no visible effect on `labelSide: 'right'`.

### Root cause (suspected)

In `src-v2/geometry/labels.js` line 203, the guard `if (distance > 0)` skips offset for 0 or negative values. For `'right'`, the sign is -1, so `sign * distance` produces a negative offset — but the guard already passed, so the math runs. The asymmetry may come from how `perpendicularOffset` interacts with SVG y-down coords after commit `c5a053c` changed the formula.

### Impact

Labels overlap on tree diagrams when labelDistance can't push them apart on the right side.

### Potential fix

Change guard to `if (distance !== 0)` — but verify the sign logic produces correct visual results for both sides before shipping.

### Key files

- `src-v2/geometry/labels.js` (line 203)
- `src-v2/core/math.js` (lines 103-112)
