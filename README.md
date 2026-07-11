# 🌌 ASTROSCOPE — REAL-TIME SPACE EXPLORER

AstroScope is a futuristic, real-time space telemetry and Mission Control dashboard. It combines cinematic immersive animations, modern typography, glassmorphic UI elements, and a real-time synthesized audio feedback engine to allow users to navigate the cosmos via multiple public astronomy APIs.

---

## 🚀 PROJECT ROADMAP & PROGRESS

### 🟢 PHASE 1: Core Shell, Routing & Living Background (Current Phase)
- [x] **Project Planning**: Design systems, asset architecture, and layout rules.
- [x] **Folder Structure**: Clean vanilla JS, modular styling, and asset containers.
- [x] **File Setup**: Setting up `index.html`, `style.css`, and `script.js` configuration.
- [x] **Glassmorphic Sidebar Layout**: Translucent responsive menu and custom active glows.
- [x] **Responsive Mobile Layout**: Collapsible burger drawers and premium bottom sticky bars.
- [x] **Dual Skin Themes**: Twilit Cosmos (Dark Space) and White Lab (Light High-Contrast).
- [x] **Stateful Client-Side Router**: Interactive views with sliding GSAP cross-fades.
- [x] **Stellar System Clock**: real-time UTC syncer coupled with calculated planetary star-dates.
- [x] **Cyber-Sound Synthesizer**: Web Audio API micro-synth delivering mechanical beep feedback.
- [x] **Living Canvas Starfield**: Twinkling particles, diagonal shooting stars, and parallax drift.

### 🟡 PHASE 2: Dashboard Visualization & Widgets
- [ ] Cinematic Dashboard Hero Banner.
- [ ] Live ISS Quick Track Cards.
- [ ] Active Astronaut Counters & Up-counters.
- [ ] Next-Launch Countdown Timer.
- [ ] Placeholder analytical chart cards for launch histories.

### 🟡 PHASE 3: Public APIs Interlocking
- [ ] NASA APOD Integration.
- [ ] Space Track & Rocket Launch Library Integration.
- [ ] NASA EPIC Earth Live Feeds.
- [ ] Mars Rover Pinterest Photo streams.
- [ ] Open Notify People-In-Space feeds.

### 🟡 PHASE 4: Core Immersive Views
- [ ] Full Leaflet Dark Maps for ISS Live orbits.
- [ ] Planet comparison boards & 3D rotating CSS globes.
- [ ] Mars Masonry Gallery with EXIF modals and downloads.
- [ ] APOD Interactive high-definition explorers.

### 🟡 PHASE 5: Advanced Search, Export, and Calibration
- [ ] Complete Ctrl + K Command Palette.
- [ ] Launch Search and Filtering engines.
- [ ] LocalStorage Favorite list management.
- [ ] jsPDF Mission Control report generator.

---

## 📁 COMPLIANT FOLDER STRUCTURE
```
AstroScope/
├── index.html          # Shell layout, CDN inclusions, and views
├── style.css           # CSS custom variables, typography, and glassmorphism utilities
├── script.js          # Master controller, Web Audio synth, stars canvas, and router
├── assets/             # Vector images, logo backups, and local parameters
├── components/         # Modular script widgets
├── api/                # NASA, Space-X, and Launch API connectors
├── utils/              # Conversion calculators and debouncers
└── README.md           # Documentation and roadmaps
```

---

## 🎨 DESIGN SPECIFICATIONS

- **Typography**: Display: *Space Grotesk*, Sans-serif: *Inter*, Monospace: *JetBrains Mono*.
- **Glassmorphism**: 
  - Backdrop blur filter: `16px`.
  - Border thickness: `1px` translucent.
  - Hover states: Glowing elevations and translated heights.
- **Color Variables**:
  - Cosmic Violet: `#7B61FF`
  - Cosmic Cyber: `#00F5FF`
  - Warning Red: `#FF5D73`
  - Deep Space Canvas: `#02040A` to `#0B1026`

---

*Phase 1 is fully functional and ready for deployment verification.*
