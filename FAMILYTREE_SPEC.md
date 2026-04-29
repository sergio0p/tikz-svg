# Claude Code Spec: Orioli-Tavernari Family Tree — Interactive Infinite Canvas

## Overview

Build a single self-contained HTML file (`family-tree.html`) — an interactive infinite-canvas family tree visualization telling the story of the Orioli and Tavernari families, from northern Italy in the 1820s to Porto Real, Brazil and beyond.

**Stack:**
- **`tikz-svg`** local library at `./src/automata/automata.js` — for nodes and directed edges
- **GSAP** via CDN — for pan animation, annotation fade-in/out, hover effects
- **Google Fonts** — Playfair Display + DM Sans
- Pure HTML/CSS/JS — no framework

---

## Visual Design

**Aesthetic:** Modern, editorial, clean. White background. Generous spacing. Nothing squeezed.

**Typography:**
- Names: `Playfair Display`, bold, 15px
- Dates: `DM Sans`, 12px, color `#888`
- Location: `DM Sans`, 11px, italic, family-colored
- Hover cards: `DM Sans`, 13px
- Annotations: `DM Sans`, italic, 12px, `#999`

**Color system (CSS variables):**
```css
--bg: #ffffff
--tavernari: #8b4513        /* sienna — Italian earth */
--orioli: #1a3a5c           /* deep navy */
--merged: #2c4a2e           /* forest green — Brazil */
--node-fill: #f8f6f2        /* warm off-white */
--node-stroke: #2c2c2c
--edge: #bbb
--annotation: #999
--hover-shadow: 0 4px 24px rgba(0,0,0,0.12)
```

**Node design:**
- Shape: `rectangle` (tikz-svg), SVG `rx=8` for rounded corners
- Left border accent strip: 4px colored (Tavernari=sienna, Orioli=navy, merged=green, historical figure=gray)
- Always show: full name + years + location — never truncate
- Min width: 200px
- Marriage pairs sit side by side connected by a dashed horizontal edge
- Key figures (Clementina, Alessio, Romualdo, Ieda) slightly larger

**Edge design:**
- Parent→child: solid, `stealth` arrow, stroke `#bbb`, strokeWidth 1.5
- Marriage: dashed horizontal, no arrow, stroke `#ccc`
- Partner (Alfonso↔Clementina): dotted line, no arrow
- Alfonso→Emperor connection: represented as annotation ANN-1 near Alfonso node

**Annotations (canvas floating cards):**
- Thin-bordered card, italic DM Sans, subtle `#fafaf8` background, max-width 280px
- Positioned near relevant nodes on the canvas
- **Only visible when their region enters the viewport**
- GSAP fade: `opacity 0→1`, `y: 8→0`, duration 0.4s on enter; reverse on leave
- Proximity trigger: visible when annotation center is within 45% of viewport dimensions from center

---

## Canvas Layout

Reading **left to right**, oldest generation to newest. Tavernari branch top half, Orioli branch bottom half, converging at Romualdo + Amelia in the middle-right, then continuing right to Omar and Ieda.

**Canvas size:** 5000px × 2400px. Min 280px horizontal gap between generations, 160px vertical between siblings.

---

## Complete Person Node Data

### TAVERNARI BRANCH (accent: #8b4513 sienna)

**domenico** — Domenico Bonaventura Tavernari
- Dates: –1860
- Location: Concordia sulla Secchia, Modena, Italy
- Hover: "Patriarch of the Tavernari family of Concordia sulla Secchia. Father of Clementina, Eugenio, and Luigi."

**rosaComi** — Rosa Comi
- Dates: –1860
- Location: Concordia sulla Secchia, Modena, Italy
- Hover: "Wife of Domenico Tavernari. Mother of Clementina, the colony founder."

**eugenio** — Eugenio Tavernari
- Dates: 1819–?
- Location: Concordia sulla Secchia, Modena, Italy
- Hover: "Elder brother of Clementina Tavernari."

**clementina** — Clementina Placida Tavernari ⭐ KEY NODE
- Dates: 1820–1875
- Location: Concordia sulla Secchia → Rio de Janeiro, Brazil
- Hover: "Freemason and revolutionary. Exiled after the 1848 uprisings, fled to Switzerland then to Brazil with Alfonso Malavasi. After Alfonso's death in 1873, received an imperial mandate from Dom Pedro II to recruit 50 Italian farming families. Returned to Italy, organized the emigration aboard the Anna Pizzorno. Died of yellow fever on 17 April 1875 in Rio de Janeiro — four months after the families arrived, before seeing the colony flourish. Known in Brazil as Madama Adelina Malavasi."

**alfonso** — Alfonso Malavasi [historical figure — gray accent, dotted partner edge to clementina]
- Dates: –1873
- Location: Emilia-Romagna, Italy → Rio de Janeiro, Brazil
- Hover: "Flautist from Emilia-Romagna. His concerts in Rio de Janeiro won him an invitation to perform at the imperial court before Emperor Dom Pedro II and Empress Maria Teresa Cristina di Borbone. The music forged a deep personal friendship between the couple and the Brazilian imperial family. Without this connection — a flute and an emperor's ear — there would have been no mandate, no Anna Pizzorno, no Porto Real. Alfonso died of yellow fever in Rio de Janeiro in 1873."

**luigi** — Luigi Tavernari
- Dates: 1822–1869
- Location: Concordia sulla Secchia, Modena, Italy
- Hover: "Younger brother of Clementina. Married Domenica Maria Malvezzi. Father of nine children including Eleuterio and Cleonice. Died in Italy in 1869, leaving his children as orphans under Clementina's care."

**domenicaMalvezzi** — Domenica Maria Malvezzi
- Dates: 1821–1901
- Location: Concordia sulla Secchia, Modena, Italy
- Hover: "Wife of Luigi Tavernari. Mother of nine children. Survived her husband by 32 years."

**eleuterio** — Eleuterio Tavernari
- Dates: 1845–1914
- Location: Concordia sulla Secchia → São Sebastião de Barra Mansa, Brazil
- Hover: "Eldest son of Luigi Tavernari and nephew of Clementina. Emigrated to Brazil with the Porto Real colony. Married Rosa Maretti on 10 January 1877. Father of Amelia, who married Romualdo Orioli."

**rosaMaretti** — Rosa Maretti
- Dates: 1855–1941
- Location: São Sebastião de Barra Mansa, Brazil
- Hover: "Wife of Eleuterio Tavernari. Married 10 January 1877 in São Sebastião de Barra Mansa. Mother of Amelia Fiorita Maria Tavernari."

**amelia** — Amelia Fiorita Maria Tavernari ⭐ KEY NODE
- Dates: 1888–1975
- Location: Porto Real, Rio de Janeiro, Brazil
- Hover: "Daughter of Eleuterio Tavernari and Rosa Maretti. Great-niece of Clementina, the colony founder. Born in the colony 13 years after its founding. Married Romualdo Orioli on 9 November 1908 in Porto Real, uniting the two founding families of the colony. Had nine children. Lived to 87 years old."

**adelaide** — Adelaide Tavernari
- Dates: 1890–?
- Location: Porto Real, Rio de Janeiro, Brazil
- Hover: "Sister of Amelia Tavernari. Daughter of Eleuterio and Rosa Maretti."

**cleonice** — Cleonice Filomena Tavernari
- Dates: 1855–1897
- Location: Concordia sulla Secchia → Barra Mansa, Brazil
- Hover: "Daughter of Luigi Tavernari, niece of Clementina. Brought to Rio de Janeiro in 1873 alongside her sister Adelina. Survived the yellow fever epidemic. Married Enrico Secchi on 16 August 1875 in Barra Mansa — six months after arriving in Brazil."

**adelina** — Adelina Elisa Maria Tavernari
- Dates: 1856–1873
- Location: Rio de Janeiro, Brazil
- Hover: "Daughter of Luigi Tavernari. Brought to Rio de Janeiro in 1873 by her aunt Clementina to be educated. Died of yellow fever at age 17 — one year before the Porto Real colony was founded."

**enricoSecchi** — Enrico Secchi ⭐ KEY NODE
- Dates: 1851–1931
- Location: Concordia sulla Secchia → Porto Real, Brazil
- Hover: "Schoolteacher from Concordia sulla Secchia and co-organizer of the Porto Real emigration. Kept a meticulous diary of the entire voyage and colony founding — the essential historical source for this story. Married Cleonice Tavernari on 16 August 1875. Completed his diary around 1920; discovered posthumously in São Paulo. Published as 'Un sogno: la Merica! I miei 56 anni di Brasile' (Baraldini Editore, Finale Emilia, 1998, bilingual Italian/Portuguese)."

**rosaEmilia** — Rosa Emilia Tavernari
- Dates: 1851–1928
- Location: Italy
- Hover: "Daughter of Luigi Tavernari and Domenica Malvezzi."

**bonaventura2** — Bonaventura Tavernari
- Dates: 1860–1933
- Location: Italy/Brazil
- Hover: "Son of Luigi Tavernari and Domenica Malvezzi."

**angelo** — Angelo Domenico Bonaventura Tavernari
- Dates: 1864–?
- Location: Italy/Brazil
- Hover: "Son of Luigi Tavernari and Domenica Malvezzi."

---

### ORIOLI BRANCH (accent: #1a3a5c navy)

**francesco** — Francesco Orioli
- Dates: ?–?
- Location: Sustinente, Mantova, Italy
- Hover: "Head of the Orioli family of Sustinente — a small comune on the left bank of the Po river, province of Mantova. Led his family to Brazil as one of the original 50 capifamiglia. Gathered at the Locanda della Rondine in Modena on 3 December 1874, then traveled by train to Genoa in the snow."

**fenicola** — Fenicola Marazzi
- Dates: ?–?
- Location: Sustinente, Mantova, Italy
- Hover: "Wife of Francesco Orioli. Mother of Alessio. Emigrated to Brazil aboard the Anna Pizzorno, December 1874."

**alessio** — Alessio Orioli ⭐ KEY NODE
- Dates: 1860–1933
- Location: Sustinente, Mantova → Porto Real, Brazil
- Hover: "Born 9 May 1860 in Sustinente, Mantova. Baptized at the Chiesa di San Michele Arcangelo. Boarded the Anna Pizzorno in Genoa on 22 December 1874 at age 14. Arrived Rio de Janeiro 16 February 1875. Spent his entire adult life in Porto Real. Married Delmira Fontanesi on 22 December 1892 — exactly 18 years to the day after the ship left Genoa."

**delmira** — Delmira Enrichetta Caterina Fontanesi
- Dates: 1868–1941
- Location: Porto Real, Rio de Janeiro, Brazil
- Hover: "Wife of Alessio Orioli. Married 22 December 1892 in Porto Real. Almost certainly also a daughter of one of the original 50 colonist families — the Fontanesi surname is characteristic of the Modena/Reggio Emilia area where Clementina recruited the families."

---

### MERGED BRANCH (accent: #2c4a2e forest green)

**romualdo** — Romualdo Orioli ⭐ KEY NODE
- Dates: 1887–1959
- Location: Porto Real, Rio de Janeiro, Brazil
- Hover: "Son of Alessio Orioli and Delmira Fontanesi. Born in Porto Real, second generation of the colony. Married Amelia Tavernari on 9 November 1908 — uniting the Orioli colonists with the Tavernari founding family. Had nine children: Manoel, Omar Hermes, Helio Aleixo, Zilda, Raul João, Antonieta Maria, Alvaro, Irene, Dilma Joanna. Note: his son Helio bears the name 'Aleixo' — honoring grandfather Alessio."

**omar** — Omar Hermes Orioli
- Dates: 1911–1993
- Location: Porto Real, Rio de Janeiro, Brazil
- Hover: "Son of Romualdo Orioli and Amelia Tavernari. Third generation of the Porto Real colony. Named 'Hermes' likely in honor of President Hermes da Fonseca (1910–1914), the year before his birth. Married Francelina Barbosa da Silva on 15 November 1944 in Porto Real."

**francelina** — Francelina Barbosa da Silva
- Dates: 1923–1988
- Location: Porto Real, Rio de Janeiro, Brazil
- Hover: "Wife of Omar Hermes Orioli. Married 15 November 1944 in Porto Real. Mother of Ieda Maria Orioli."

**ieda** — Ieda Maria Orioli ⭐ TERMINAL NODE
- Dates: 1946–
- Location: Rio de Janeiro, Brazil
- Hover: "Daughter of Omar Hermes Orioli and Francelina Barbosa da Silva. Fourth generation of the Porto Real colony. Great-great-granddaughter of Alessio Orioli, who crossed the Atlantic as a 14-year-old boy in 1874. Through her grandmother Amelia, she is also the great-great-niece of Clementina Tavernari — the woman whose imperial connections, born of a flautist's music, made the whole journey possible."

---

## Canvas Annotations

Each annotation fades in when viewport reaches its region. Max 3 visible at once.

**ANN-1** (near Alfonso node)
> "Rio de Janeiro, 1850s. Alfonso Malavasi's flute performances at the imperial court won the deep personal friendship of Emperor Dom Pedro II and Empress Maria Teresa Cristina di Borbone. A musician's gift would open the door for 50 Italian farming families to cross an ocean."

**ANN-2** (near Clementina, after Alfonso's death)
> "1873. Alfonso dies of yellow fever. Dom Pedro II, honoring their friendship, grants Clementina an imperial mandate: return to Italy, recruit 50 farming families, found a colony in the province of Santa Catarina — to be named for the Empress."

**ANN-3** (near Adelina node)
> "Rio de Janeiro, 1873. Clementina brings her nieces Cleonice and Adelina to be educated in Rio. Adelina dies of yellow fever at 17. The epidemic that took Alfonso has now taken her niece. Clementina returns to Italy anyway."

**ANN-4** (between first and second generation, recruitment moment)
> "1874, the lowlands of the Po. When Clementina opened her registration office in Concordia, emigration fever swept the provinces of Modena, Mantova, Ferrara, Reggio Emilia, Parma. Hundreds of families rushed to sign up. Mayors withheld clearance papers. Prefects refused passports. A parliamentary intervention finally freed the first 50."

**ANN-5** (near Francesco + Alessio, departure)
> "3 December 1874, Modena. The 50 capifamiglia gather at the Locanda della Rondine in Piazza Castello. It is snowing. Among them: Francesco Orioli from Sustinente, with his 14-year-old son Alessio. The next morning, by train to Genoa."

**ANN-6** (near Alessio, voyage)
> "22 December 1874. The Anna Pizzorno — four masts, ~600 passengers — leaves Genoa. On 15 February 1875, the Brazilian coast appears at Cabo Frio. A cry goes up from the hold: 'Ades sì ca sem in Merica!!! Viva il Brasilio!!'"

**ANN-7** (near Clementina, death)
> "17 April 1875. Four months after the families arrived, Clementina Tavernari dies of yellow fever in Rio de Janeiro. She is 55. Enrico Secchi continues in her place. A commemorative bust is later erected in Porto Real."

**ANN-8** (near Cleonice + Enrico marriage)
> "16 August 1875, Barra Mansa. Six months after landing in Brazil, Cleonice Tavernari marries Enrico Secchi — the schoolteacher who organized the emigration beside her aunt. The diarist marries the founder's niece."

**ANN-9** (near Eleuterio + Rosa marriage)
> "10 January 1877. The colony takes root. Sugarcane grows on 156 lots. The Engenho Central sugar refinery rises on the Paraíba river. The Associação Italiana Vittorio Emanuele II is founded. Eleuterio Tavernari, Clementina's nephew, marries Rosa Maretti."

**ANN-10** (near Alessio + Delmira marriage)
> "22 December 1892, Porto Real. Alessio Orioli — the boy from Sustinente — marries Delmira Fontanesi. Exactly 18 years to the day since the Anna Pizzorno left Genoa. Both grew up in the colony their parents built."

**ANN-11** (near Romualdo + Amelia, convergence)
> "9 November 1908, Porto Real. Romualdo Orioli — son of the boy from Sustinente — marries Amelia Tavernari — great-niece of the woman who brought his father to Brazil. Two families, one colony, one story."

**ANN-12** (near Ieda, terminal)
> "The colony lives. Porto Real still carries its name. The Associação Vittorio Emanuele II reaches 22 countries on 4 continents. And somewhere in this chain: a flute, an emperor, a snowstorm in Modena, and a 14-year-old boy watching the lights of Genoa disappear."

---

## Interaction Spec

**Pan:** Click and drag. GSAP handles smooth movement.

**Horizontal scroll:** Mouse wheel → horizontal. Left/right arrow buttons fixed at bottom center, each scrolls 600px with GSAP ease.

**Hover card:** Appears above node (or below if near top edge). Fade in 0.25s. Contains name, dates, location, hover text. Disappears on mouse leave.

**Annotation proximity:** On each pan/scroll frame, compute distance from viewport center to each annotation's canvas coordinates. Fade in if within threshold, fade out if outside. Max 3 visible simultaneously.

**Arrow buttons:** Minimal circle design, `#2c2c2c` border, white fill, dark on hover. Fixed bottom center.

---

## Implementation Notes

- Render the full family tree as a single large SVG using tikz-svg, sized to the full canvas (5000×2400)
- Wrap SVG in a `div.canvas` with `position: absolute` inside a `div.viewport` with `overflow: hidden`
- Pan by updating `transform: translate(x, y)` on `div.canvas` via GSAP
- Annotations are HTML elements absolutely positioned on `div.canvas` (not inside SVG)
- Hover cards are HTML elements in a fixed overlay layer, positioned relative to node screen coordinates
- Use tikz-svg named styles for branch coloring; groups for batch application
- The `nodeDistance` should be set to at least 150 for adequate spacing
- For the left border accent: render as an additional thin rectangle SVG element overlaid on each node, or use SVG `foreignObject` with CSS border-left

---

## Key Historical Reference

- **Ship:** Anna Pizzorno, four-masted sailing vessel, ~600 passengers
- **Departure:** Genoa, 22 December 1874
- **Arrival:** Rio de Janeiro, 16 February 1875
- **Colony:** Fazenda de Porto Real, ~200km from Rio, near Resende, on the Paraíba do Sul river
- **Sustinente:** Left bank of Po river, confluence with Mincio, province of Mantova, Lombardy
- **The flute connection:** Alfonso Malavasi → imperial court → friendship with Dom Pedro II → mandate to Clementina → 50 families → Anna Pizzorno → Porto Real. The entire chain begins with a flute.
- **Diary:** Enrico Secchi, *Un sogno: la Merica! I miei 56 anni di Brasile*, Baraldini Editore, 1998. A copy in Portuguese is held by the family in Brazil.
