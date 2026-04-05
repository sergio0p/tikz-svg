# How TikZ Implements Beamer Overlay Syntax (`\node<4>`, `\draw<3>`)

## Summary

The angle-bracket overlay syntax on TikZ commands (`\node<4>`, `\draw<3>`,
`\path<2-5>`, etc.) is **not a PGF/TikZ feature**. It is a collaboration
between TikZ and Beamer, implemented through a thin coupling layer in
`tikz.code.tex` that delegates entirely to Beamer's `\alt` macro.

This mechanism is essentially undocumented in the PGF/TikZ manual. The Beamer
manual documents `\alt` and overlay specifications, but the TikZ-side wiring
that makes `\node<4>` work is not covered in either manual.

---

## The Three Files

| File | Role |
|------|------|
| `tikz.code.tex` (lines 1947–2090) | Detects `<spec>`, rewrites commands, calls `\alt` |
| `beamerbaseoverlay.sty` (lines 54–61) | Defines `\alt<spec>{yes}{no}` |
| `beamerbasedecode.sty` (lines 40–300) | Parses overlay specs, compares to current slide |

All paths below are relative to:
```
/usr/local/texlive/2025/texmf-dist/tex/
```
- TikZ: `generic/pgf/frontendlayer/tikz/tikz.code.tex`
- Beamer: `latex/beamer/beamerbaseoverlay.sty`
- Decoder: `latex/beamer/beamerbasedecode.sty`

---

## Phase 1: Command Definitions (tikz.code.tex, lines 1947–1976)

TikZ defines its drawing commands in two groups with different overlay strategies.

### Group A: Simple aliases to `\path` (no overlay awareness)

```tex
% tikz.code.tex, lines 1947–1958
\let\path=\tikz@command@path%
\def\draw{\path[draw]}%
\def\fill{\path[fill]}%
\def\filldraw{\path[fill,draw]}%
\def\shade{\path[shade]}%
\def\shadedraw{\path[shade,draw]}%
\def\clip{\path[clip]}%
\def\useasboundingbox{\path[use as bounding box]}%
```

These commands (`\draw`, `\fill`, etc.) are thin wrappers around `\path`. They
do **not** check for `<spec>` themselves. Instead, `\path` (which is
`\tikz@command@path`) handles it.

### Group B: Commands routed through `\tikz@path@overlay` (extra layer)

```tex
% tikz.code.tex, lines 1959–1962
\def\node{\tikz@path@overlay{node}}%
\def\pic{\tikz@path@overlay{pic}}%
\def\coordinate{\tikz@path@overlay{coordinate}}%
\def\matrix{\tikz@path@overlay{node[matrix]}}%
```

These commands go through a wrapper that explicitly peeks for `<`:

```tex
% tikz.code.tex, lines 1973–1976
\def\tikz@path@overlay#1{%
  \let\tikz@signal@path=\tikz@signal@path%
  \pgfutil@ifnextchar<{\tikz@path@overlayed{#1}}{\path #1}}%
\def\tikz@path@overlayed#1<#2>{\path<#2> #1}%
```

**What this does:** If `\node<4>[red]{A}` is written, `\tikz@path@overlay`
detects the `<4>`, strips it off, and rewrites the invocation as:
```tex
\path<4> node[red]{A}
```

This is necessary because `\node` is not just `\path[node]` — it's
`\path node`, and the overlay spec must precede the path operation argument.

### Why two groups?

`\draw` expands to `\path[draw]`, and `\path` is `\tikz@command@path` which
already checks for `<`. So `\draw<3>` expands to `\path[draw]<3>`, and
`\tikz@command@path` handles the argument reordering (line 2078):

```tex
% tikz.code.tex, lines 2076–2078
\def\tikz@check@earg[#1]{%
  \pgfutil@ifnextchar<{\tikz@swap@args[#1]}{\tikz@@command@path[#1]}}
\def\tikz@swap@args[#1]<#2>{\tikz@command@path<#2>[#1]}%
```

So `\path[draw]<3>` becomes `\path<3>[draw]` — the overlay spec is moved before
the options.

But `\node` expands to `\path node`, and if overlay is present:
`\path node<4>`. Here `\tikz@command@path` would NOT see the `<` because it's
after `node`, not directly after `\path`. That's why `\node`, `\pic`,
`\coordinate`, and `\matrix` need the extra `\tikz@path@overlay` wrapper to
intercept `<` before delegating to `\path`.

---

## Phase 2: The `\path` Command Processes `<spec>` (tikz.code.tex, lines 2071–2090)

Once the overlay spec is in the right position (`\path<spec> ...;`), the main
path command handles it:

```tex
% tikz.code.tex, lines 2071–2074
\def\tikz@command@path{%
  \let\tikz@signal@path=\tikz@signal@path%
  \pgfutil@ifnextchar[{\tikz@check@earg}%
  {\pgfutil@ifnextchar<{\tikz@doopt}{\tikz@@command@path}}}%
```

The decision tree is:
1. Next char is `[` → parse options, then check for `<` again (line 2077)
2. Next char is `<` → go to overlay handling (`\tikz@doopt`)
3. Otherwise → proceed normally (`\tikz@@command@path`)

The overlay handler:

```tex
% tikz.code.tex, lines 2080–2090
\def\tikz@doopt{%
  \let\tikz@next=\tikz@eargnormalsemicolon%
  \ifnum\the\catcode`\;=\active\relax%
    \let\tikz@next=\tikz@eargactivesemicolon%
  \fi%
  \tikz@next}%
\long\def\tikz@eargnormalsemicolon<#1>#2;{%
  \alt<#1>{\tikz@@command@path#2;}{\tikz@path@do@at@end}}%
{
  \catcode`\;=\active
  \long\global\def\tikz@eargactivesemicolon<#1>#2;{%
    \alt<#1>{\tikz@@command@path#2;}{\tikz@path@do@at@end}}%
}
```

**What this does:**

1. Grabs everything between `<spec>` and the terminating `;`
2. Wraps it in: `\alt<spec>{ execute-the-path }{ skip }`
3. Two versions exist because `;` might be an active character (babel French, etc.)

The "skip" branch calls `\tikz@path@do@at@end`, which is effectively a no-op
(it just runs scope cleanup, line 2443):

```tex
% tikz.code.tex, line 2443
\def\tikz@path@do@at@end{\tikz@lib@scope@check}%
```

---

## Phase 3: Beamer's `\alt` (beamerbaseoverlay.sty, lines 54–61)

The `\alt` macro is defined by Beamer:

```tex
% beamerbaseoverlay.sty, lines 54–61
\newrobustcmd*\alt{\@ifnextchar<{\beamer@alt}{\beamer@alttwo}}

\long\def\beamer@alt<#1>#2#3{%
  \gdef\beamer@doifnotinframe{#3}%
  \def\beamer@doifinframe{#2}%
  \beamer@masterdecode{#1}\beamer@donow}
```

**What this does:**

1. Parses `\alt<spec>{yes-branch}{no-branch}`
2. Stores both branches
3. Calls `\beamer@masterdecode` to evaluate the overlay spec against the current
   slide number
4. Calls `\beamer@donow`, which is:

```tex
% beamerbasedecode.sty, line 300
\def\beamer@donow{\beamer@doifnotinframe}
```

By default, the "no" branch runs. The decoder *overrides* `\beamer@doifnotinframe`
with `\beamer@doifinframe` if the spec matches — a double-negation pattern.

---

## Phase 4: Overlay Spec Decoding (beamerbasedecode.sty, lines 40–300)

The decoder is a full parser that handles the overlay specification language:

```tex
% beamerbasedecode.sty, lines 40–59
\xdef\beamer@masterdecode#1{%
  \noexpand\beamer@localanotherslidefalse%
  \setbox\beamer@decode@box=\hbox{%
    % ... catcode normalization for |, :, -, +, (, ), space ...
    \edef\noexpand\beamer@@@temp{#1\string|stop\string:0\string|}%
    \unexpanded{%
      \expandafter\beamer@decode\beamer@@@temp%
      \ifbeamer@localanotherslide
        \aftergroup\beamer@localanotherslidetrue
      \fi}%
  }%
}%
```

The spec is split on `|` (pipe) for mode-specific sub-specs, then each part is
parsed for ranges and individual slide numbers.

### Range matching (beamerbasedecode.sty, lines 270–287):

```tex
\def\beamer@decoderange#1-#2,{%
  \ifnum#1>\beamer@slideinframe
  \else
    \ifnum#2<\beamer@slideinframe
    \else
      \gdef\beamer@doifnotinframe{\beamer@doifinframe}%
    \fi
  \fi
  \beamer@@decode}
```

### Single-number matching (beamerbasedecode.sty, lines 288–298):

```tex
\def\beamer@decodeone#1,{%
  \ifnum#1=\beamer@slideinframe
    \gdef\beamer@doifnotinframe{\beamer@doifinframe}%
  \fi
  \beamer@@decode}
```

### Supported overlay spec syntax:

| Spec | Meaning |
|------|---------|
| `<3>` | Only on slide 3 |
| `<2-5>` | Slides 2 through 5 |
| `<3->` | Slide 3 onwards |
| `<-4>` | Up to slide 4 |
| `<1,3,5>` | Slides 1, 3, and 5 |
| `<1-3,5,7->` | Combined ranges and individual slides |
| `<+->` | From "current pause counter" onwards (auto-incrementing) |
| `<.(2)->` | Relative offset from current pause |
| `<alert@3>` | Action-qualified spec (triggers `\beamer@action` processing) |

---

## Complete Trace: `\node<4>[red]{A};`

```
Step 1: \node<4>[red]{A};
        ↓ expands \node
        \tikz@path@overlay{node}<4>[red]{A};

Step 2: \tikz@path@overlay peeks, sees '<'
        ↓ calls \tikz@path@overlayed{node}<4>
        \path<4> node[red]{A};

Step 3: \path is \tikz@command@path
        peeks next char: not '[', not '<' ... wait, it IS '<'
        ↓ calls \tikz@doopt
        ↓ selects \tikz@eargnormalsemicolon

Step 4: \tikz@eargnormalsemicolon<4>node[red]{A};
        captures #1 = "4", #2 = "node[red]{A}"
        ↓ expands to:
        \alt<4>{\tikz@@command@path node[red]{A};}{\tikz@path@do@at@end}

Step 5: \alt (Beamer) parses <4>
        yes-branch = \tikz@@command@path node[red]{A};
        no-branch  = \tikz@path@do@at@end
        ↓ calls \beamer@masterdecode{4}

Step 6: Decoder compares 4 to \beamer@slideinframe
        If slide 4: \beamer@doifnotinframe := yes-branch → node is drawn
        If not:     \beamer@doifnotinframe remains no-branch → node is skipped

Step 7: \beamer@donow executes \beamer@doifnotinframe
```

## Complete Trace: `\draw<3>[thick] (0,0) -- (1,1);`

```
Step 1: \draw<3>[thick] (0,0) -- (1,1);
        ↓ expands \draw
        \path[draw]<3>[thick] (0,0) -- (1,1);

Step 2: \tikz@command@path peeks, sees '['
        ↓ calls \tikz@check@earg[draw]
        \tikz@check@earg peeks again, sees '<'
        ↓ calls \tikz@swap@args[draw]<3>
        rewritten to: \tikz@command@path<3>[draw][thick] (0,0) -- (1,1);

Step 3: \tikz@command@path peeks, now sees '<'
        ↓ calls \tikz@doopt → \tikz@eargnormalsemicolon

Step 4: \tikz@eargnormalsemicolon<3>[draw][thick] (0,0) -- (1,1);
        captures #1 = "3", #2 = "[draw][thick] (0,0) -- (1,1)"
        ↓ expands to:
        \alt<3>{\tikz@@command@path[draw][thick] (0,0) -- (1,1);}
               {\tikz@path@do@at@end}

Step 5–7: Same as above — Beamer decodes "3" against current slide.
```

Note the extra reordering step: `\path[draw]<3>` becomes `\path<3>[draw]` via
`\tikz@swap@args`. This is because the overlay spec must be consumed before the
options.

---

## What Happens Outside Beamer?

**TikZ does not define `\alt`.** If you use `\node<4>` in a standalone document
(no `\documentclass{beamer}`), `\alt` is undefined and you get a compilation
error — unless some other package provides it.

PGF's utility layer does not provide a fallback `\alt`. I searched all files in:
- `tex/generic/pgf/utilities/pgfutil-latex.def`
- `tex/generic/pgf/utilities/pgfutil-plain.def`
- `tex/generic/pgf/utilities/pgfutil-context.def`
- `tex/generic/pgf/utilities/pgfutil-common.tex`

None define `\alt`. This means:

- **`\documentclass{beamer}`**: works, Beamer provides `\alt`
- **`\documentclass{article}` + `\usepackage{beamerarticle}`**: works, Beamer article mode provides `\alt`
- **`\documentclass{article}` without Beamer**: **error** — `\alt` is undefined
- **Plain TeX / ConTeXt**: **error** — `\alt` is undefined

---

## Design Critique

### The Good

1. **Separation of concerns**: TikZ doesn't know anything about slides. It just
   calls `\alt`, which could be provided by any framework.
2. **Minimal coupling**: Only two points of contact — `\alt` and `\tikz@path@do@at@end`.
3. **Complete path capture**: The entire path from `<spec>` to `;` is captured
   as a unit, so all path operations (coordinates, `--`, `to`, `node`, etc.)
   are included or excluded atomically.

### The Questionable

1. **Undocumented dependency**: TikZ calls `\alt` without defining it or
   documenting the requirement. There's no `\ifdefined\alt` guard.

2. **Token-stream peeking**: `\pgfutil@ifnextchar<` is fragile. If catcodes
   change (e.g., in some babel configurations, or inside `\verb`), the `<`
   might not be recognized.

3. **Argument reordering hacks**: The `\tikz@swap@args` trick
   (`\path[draw]<3>` → `\path<3>[draw]`) works but means the overlay spec
   can appear in positions that look inconsistent to users:
   ```tex
   \draw<3>[thick] ...;     % works: <3> after \draw, before options
   \path<3>[draw,thick] ...; % works: <3> directly after \path
   \path[draw]<3>[thick] ...; % works: <3> between option groups (!)
   ```

4. **All-or-nothing granularity**: The overlay applies to the entire `\path`
   command. You cannot overlay individual nodes or segments within a single
   path:
   ```tex
   % This does NOT make only the second node appear on slide 2:
   \path (0,0) node{A} (1,0) node<2>{B};  % <2> is NOT parsed here
   ```
   The `<spec>` is only detected at the beginning of `\path`, not at
   arbitrary points within it.

5. **Hard failure outside Beamer**: Using `\node<4>` without Beamer produces a
   raw TeX error about `\alt` being undefined, which halts compilation. A
   silent no-op fallback (treating `\alt` as `\@secondoftwo`) would arguably
   be better — it would let the document compile so you can inspect the output
   and fix multiple issues in one pass, rather than hitting a wall on the
   first overlay spec.

6. **Two semicolon variants**: The need for both `\tikz@eargnormalsemicolon`
   and `\tikz@eargactivesemicolon` (lines 2086–2089) exists because French
   babel makes `;` an active character. This is a workaround for a TeX-level
   problem, but it means the overlay code has to be duplicated.

---

## Beamer Overlay Spec Syntax (Complete Reference)

From `beamerbasedecode.sty`:

```
<slidespec> ::= <modespec> | <modespec> "|" <slidespec>
<modespec>  ::= [<mode> ":"] <rangelist>
<rangelist> ::= <range> | <range> "," <rangelist>
<range>     ::= <number>
              | <number> "-" <number>
              | <number> "-"
              | "-" <number>
              | "+"
              | "+(" <offset> ")"
<mode>      ::= "beamer" | "article" | "second" | "presentation" | "all"
<action>    ::= <actionname> "@" <range>
```

Examples:
```tex
\node<3>{X}              % Slide 3 only
\draw<2->{...}           % Slide 2 onwards
\fill<1,3,5>{...}        % Slides 1, 3, 5
\path<beamer:2-|article:1>{...}  % Mode-specific
\node<+->{}              % From current \pause counter onwards
\node<alert@3>{X}        % Use "alert" action on slide 3
```

---

## File Listing

For reproducibility, the exact files examined (TeX Live 2025):

```
/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/frontendlayer/tikz/tikz.code.tex
/usr/local/texlive/2025/texmf-dist/tex/latex/beamer/beamerbaseoverlay.sty
/usr/local/texlive/2025/texmf-dist/tex/latex/beamer/beamerbasedecode.sty
/usr/local/texlive/2025/texmf-dist/tex/latex/beamer/beamerbasearticle.sty
/usr/local/texlive/2025/texmf-dist/tex/latex/beamer/beamerbasecompatibility.sty
/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/utilities/pgfutil-latex.def
/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/utilities/pgfutil-plain.def
/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/utilities/pgfutil-context.def
/usr/local/texlive/2025/texmf-dist/tex/generic/pgf/utilities/pgfutil-common.tex
```

---

*Report generated 2026-03-27 from TeX Live 2025 source inspection.*
