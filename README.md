# अभ्यास / Placement Engineering Roadmap

> 50-Week Placement Engineering Roadmap & Minimalist Execution Console  
> Live Tracker: [track.swarajkanse.me](https://track.swarajkanse.me/)

[![Status](https://img.shields.io/badge/Status-Active%20Execution-c0c1ff?style=flat-square&labelColor=121316)](https://track.swarajkanse.me/)
[![Architecture](https://img.shields.io/badge/Architecture-Local--First%20%2B%20Supabase-8083ff?style=flat-square&labelColor=121316)](#architecture--tech-stack)
[![Theme](https://img.shields.io/badge/Design-Obsidian%20%26%20Lavender-c0c1ff?style=flat-square&labelColor=121316)](#design-system--palette)
[![License](https://img.shields.io/badge/License-MIT-464554?style=flat-square&labelColor=121316)](LICENSE)

---

## Overview

**अभ्यास** is a minimalist, distraction-free execution tracker engineered for 50 weeks of rigorous placement preparation across Data Structures & Algorithms, System Design (HLD & LLD), Machine Learning / AI, and Core Computer Science.

Built with a local-first, zero-runtime-hydration architecture, the application delivers instant rendering, optimistic UI updates, cross-tab synchronization via `BroadcastChannel`, and background persistence with Supabase PostgreSQL. Public visitors enjoy an uncompromised read-only inspection experience with zero exposed credentials, while authenticated sessions unlock full progress tracking and slippage calibration.

---

## Core Systems

### Minimal Global Roadmap Search
- **Floating Command Bar**: Dark pill search interface (`#1c1c1f`) engineered with zero clutter. Triggered globally via `Ctrl+K`, `/`, or `Ctrl+F`.
- **In-Memory Indexing**: Scans 680+ tasks, deliverables, and clearance gate criteria across all 50 weeks in sub-millisecond execution time.
- **Cross-Week Routing**: Automatically navigates to matching week pages (`week-XX.html?q=...&m=...#taskId`), highlights the target card with a pulsing lavender ring, and centers it in the viewport.
- **Bi-Directional Traversal**: Cycle through search results with keyboard arrows (`ArrowRight` / `ArrowLeft`, `Enter` / `Shift+Enter`) or on-screen controls.

### Execution Hierarchy & Slippage Calibration
- **Tiered Task Structure**: Every week strictly segregates curriculum into **MUST** (critical path core), **SHOULD** (depth & mastery), and **STRETCH** (bonus velocity).
- **Weekly Clearance Gates**: Explicit verification criteria with target tasks and concrete evidence requirements before week completion.
- **Real-Time Slippage Monitoring**: Automatic tracking of actual hours logged against printed estimates:
  - $\le 1.10\times$: On Track
  - $1.11–1.25\times$: Velocity Warning
  - $> 1.25\times$: Scope-Cut Ladder Rung 2 Trigger (protect MUST, defer secondary tasks)
- **Triage Contingency**: Dedicated "If Behind" contingency guidelines for every single week defining non-negotiable protections and safe shifts during academic load spikes.

### Calendar-Accurate 365-Day Activity Heatmap
- **Trailing 1-Year Matrix**: Full 52-week contribution grid ending on today's exact date and beginning exactly 365 days prior.
- **Sunday–Saturday Alignment**: Calendar-accurate weekday grid offsets with dynamic month boundary headers.
- **4-Tier Intensity Scale**: Themed lavender depth mapping (`#242429` -> `#8083ff/30` -> `#8083ff/60` -> `#8083ff` -> `#c0c1ff`).
- **5:30 AM IST Rollover**: Late-night sessions before 5:30 AM IST (00:00:00 UTC) count toward the active study day.

### Local-First Persistence & Supabase Cloud Sync
- **Zero-Latency Optimistic State**: Checkbox toggles and hour logs persist immediately to `localStorage` and broadcast to all open tabs.
- **Server-Side Authorization**: Cloud mutations require authentication against PostgreSQL Row Level Security (RLS) using `crypt()` Blowfish hashing via RPC. Client bundles contain zero private keys or write credentials.
- **Guest Read-Only Protection**: Public viewers can inspect the entire syllabus, study notes, and search without state mutation.

### Wisdom & Dot-Matrix Halftone Engine
- **Atkinson Halftone Pipeline**: Offline Python precompiler converts high-contrast portraits into fine 2.0px dithered dot matrices rendered in theme primary lavender (`#c0c1ff`).
- **Devanagari & Serif Typography**: Sanskrit verses rendered in calligraphic **Rozha One**; English philosophical citations set in italic **Playfair Display**.
- **Smooth Auto-Rotation**: 10-second rotation cycle across figures (Swami Vivekananda, Dr. Kalam, Andrew Ng, Linus Torvalds, Jensen Huang, Shri Krishna) with balanced padding geometry.

---

## 10-Phase Curriculum Roadmap

| Phase | Duration | Focus Area | Core Modules & Deliverables |
| :--- | :--- | :--- | :--- |
| **Phase 1** | Weeks 01–05 | Foundations & Core Language Mastery | Java OOPs Refresh, CS50P, Python Ecosystem, Git Automation |
| **Phase 2** | Weeks 06–10 | Advanced Data Structures & SQL Mastery | Binary Search, Recursion, Relational DBs, Complex SQL Joins & Window Functions |
| **Phase 3** | Weeks 11–15 | Advanced DSA & Data Engineering | Trees, Graphs, Dynamic Programming, Database Internals, B-Trees & LSM Indices |
| **Phase 4** | Weeks 16–20 | Low-Level Design & Clean Architecture | SOLID Principles, GoF Design Patterns, Java/Go Concurrency & Multi-threading Labs |
| **Phase 5** | Weeks 21–25 | High-Level Design & Distributed Systems | CAP Theorem, Sharding, Consistent Hashing, Message Queues (Kafka), Redis Caching |
| **Phase 6** | Weeks 26–30 | Production Backend & Cloud Infrastructure | Microservices, Docker, Kubernetes, gRPC, API Gateways, Prometheus & Grafana |
| **Phase 7** | Weeks 31–35 | Practical Machine Learning & Deep Learning | NumPy from scratch, Scikit-Learn, PyTorch, Linear/Logistic Regression, Neural Nets |
| **Phase 8** | Weeks 36–40 | Applied Generative AI & Large Language Models | Transformers, Multi-Head Attention, RAG Architectures, Vector Databases, Fine-Tuning |
| **Phase 9** | Weeks 41–45 | Competitive Programming & Interview Drills | LeetCode Hard Patterns, Timed Mock Interviews, Behavioral STAR Framework |
| **Phase 10** | Weeks 46–50 | Production Portfolio & Placement Sprint | Capstone System Deployment, Resume Polish, Live Technical Interview Simulations |

---

## Architecture & Tech Stack

```
tracker/
├── index.html                    # Pre-rendered Dashboard
├── favicon.svg                   # Calligraphic Devanagari vector mark
├── CNAME                         # Production domain (track.swarajkanse.me)
├── assets/
│   └── quotes/                   # Precomputed high-contrast WebP/PNG portrait assets
├── css/
│   ├── style.css                 # Custom glassmorphism, calligraphic typography & tokens
│   ├── tailwind-input.css        # Tailwind base and utilities entrypoint
│   └── tailwind.min.css          # Purged, precompiled production CSS bundle
├── js/
│   ├── app.js                    # Global Search, Cloud Sync, Slippage & State Engine
│   ├── dashboard-summary.js      # Compact precomputed roadmap dataset (218 KB)
│   ├── quote-matrix.js           # Canvas dot-matrix engine & HiDPI renderer
│   ├── quotes-data.js            # Precomputed Atkinson dithered dot arrays
│   └── roadmap-data.js           # Comprehensive syllabus dataset with task descriptions
├── scripts/
│   ├── build_website.py          # Python static site generator & precompiler
│   └── process_user_cropped.py   # Atkinson dither precompiler & asset generator
├── supabase_security_setup.sql   # PostgreSQL RLS & server-side auth procedures
├── tailwind.config.js            # Custom Obsidian & Lavender design tokens
└── weeks/
    ├── week-01.html              # Pre-rendered weekly execution consoles
    └── ... (weeks 02 to 50)
```

### Technology Matrix

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Core Client** | Vanilla ES6+ JavaScript | Zero-framework runtime, instant boot, lightweight memory footprint |
| **Markup** | Semantic HTML5 + WCAG 2.1 | Accessible buttons, ARIA state announcements, screen-reader friendly |
| **Styling** | Tailwind CSS + Vanilla CSS | Purged utility bundle + custom calligraphic typography & animations |
| **Persistence** | Browser `localStorage` | Instant local-first writes, offline resiliency, `StorageEvent` tab sync |
| **Cloud Backend** | Supabase (PostgreSQL 15) | Real-time database sync, Row Level Security, transactional RPC |
| **Authentication** | PostgreSQL `pgcrypto` (`crypt`) | Server-side Blowfish password verification with zero client exposure |
| **Static Generator** | Python 3 AST Parser | Pre-renders 50 weekly pages and precomputes summary datasets |
| **Hosting & CDN** | GitHub Pages + Custom Domain | High-speed global edge distribution via `track.swarajkanse.me` |

---

## Keyboard Shortcuts

| Shortcut | Action | Scope |
| :--- | :--- | :--- |
| `Ctrl + K` / `Cmd + K` | Open Minimal Global Search | Global (any page) |
| `/` | Quick-open search (when not in text input) | Global (any page) |
| `Ctrl + F` / `Cmd + F` | Alternative search trigger | Global (any page) |
| `Enter` | Navigate to next search match | Search Bar active |
| `Shift + Enter` | Navigate to previous search match | Search Bar active |
| `ArrowRight` | Iterate to next match across weeks | Search Bar active |
| `ArrowLeft` | Iterate to previous match across weeks | Search Bar active |
| `Escape` | Close search bar & clear highlight rings | Search Bar active |
| Click Week Badge (`W08`) | Jump directly to matching week console | Search Bar active |

---

## Development & Build Pipeline

### Prerequisites
- Python 3.9+ (for static site generation)
- Node.js 18+ (for Tailwind CLI compilation)

### 1. Rebuild Entire Website & Datasets
Parses all roadmap files, updates `dashboard-summary.js`, regenerates `index.html`, and updates all 50 weekly pages:

```bash
cd tracker
python scripts/build_website.py
```

### 2. Compile Production Tailwind CSS
Purges unused utility classes and compiles the minimal production CSS bundle:

```bash
npx tailwindcss -i ./css/tailwind-input.css -o ./css/tailwind.min.css --minify
```

### 3. Local Preview Server
Start a lightweight local HTTP server:

```bash
python -m http.server 8088
# Navigate to: http://localhost:8088/
```

---

## Database Security Configuration

The cloud persistence layer utilizes Supabase PostgreSQL with strict Row Level Security (RLS):

1. **Table Structure & RLS**:
   - `tracker_state` table stores the encrypted user state JSON blob.
   - Public `anon` role has `SELECT` privileges only. Direct `INSERT`, `UPDATE`, and `DELETE` queries are revoked.
2. **Server-Side Password Verification**:
   - State writes execute via the stored procedure `sync_tracker_state(p_password, p_state)`.
   - The password is authenticated server-side using PostgreSQL's native `crypt(p_password, password_hash)`.
3. **Setup**:
   - Run the SQL statements in [`supabase_security_setup.sql`](supabase_security_setup.sql) in your Supabase SQL Editor.

---

## Design System & Palette

अभ्यास employs an **Obsidian & Lavender** palette engineered for prolonged focus during 8+ hour study sessions:

- **Surface Canvas**: `#121316` (Deep Obsidian)
- **Container Surfaces**: `#1f1f23` (Subtle Surface), `#292a2d` (Elevated Surface)
- **Primary Accent**: `#c0c1ff` (Signature Lavender Periwinkle)
- **Primary Container**: `#8083ff` (Deep Iris Purple)
- **On-Surface**: `#e3e2e6` (High-contrast text)
- **On-Surface-Variant**: `#c7c4d7` (Soft lavender muted text)
- **Border Outlines**: `#464554` / `rgba(255, 255, 255, 0.08)`
- **Typography**:
  - Brand Mark: Rozha One / Yatra One (Calligraphic Devanagari)
  - Headlines: Space Grotesk (Technical geometric sans)
  - Body Text: Inter (Optimized UI sans)
  - Telemetry & Badges: JetBrains Mono (Monospaced metrics & counters)
