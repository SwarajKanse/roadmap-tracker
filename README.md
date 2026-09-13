# 🛰️ ORBIT // Executive Cockpit

> **50-Week Placement Engineering Roadmap & Minimalist Execution Console**  
> Live Cockpit: **[track.swarajkanse.me](https://track.swarajkanse.me/)**

[![Status](https://img.shields.io/badge/Status-Active%20Execution-8083ff?style=flat-square)](https://track.swarajkanse.me/)
[![Stack](https://img.shields.io/badge/Architecture-Local--First%20%2B%20Supabase-c0c1ff?style=flat-square)](#architecture)
[![Design](https://img.shields.io/badge/Theme-Obsidian%20Cockpit-121316?style=flat-square)](#design-system)
[![License](https://img.shields.io/badge/License-MIT-gray?style=flat-square)](LICENSE)

---

## ⚡ Overview

**ORBIT** is a custom high-performance, distraction-free roadmap tracker designed for engineering mastery across DSA, System Design, AI/ML, and Core CS. 

Built with a **local-first, zero-latency** philosophy, it loads instantly from browser storage, synchronizes changes continuously to a secure Supabase PostgreSQL database, and enforces strict server-side authorization so public visitors can inspect the roadmap in **Guest Read-Only** mode without risking unauthorized modifications.

---

## 🎯 Key Capabilities

- **Zero-Latency Optimistic State**: Every checkbox toggle, note update, and queue interaction persists instantaneously to browser `localStorage` and broadcasts across open tabs via the `StorageEvent` API.
- **Server-Side Protected Cloud Sync**: Background synchronization via Supabase PostgreSQL. Protected by PostgreSQL Row Level Security (RLS) and server-side bcrypt authorization—the public client bundle contains zero exposed master hashes or write credentials.
- **Guest Read-Only Architecture**: Public visitors can inspect progress, deliverables, and notes. Edits are gated behind a 30-day authenticated session.
- **5:30 AM IST Dynamic Rollover Engine**: Study days roll over strictly at 5:30 AM IST (00:00:00 UTC), allowing late-night focus sessions to count toward the active day without premature date changes.
- **Anti-Guilt Weekend Spillover Protocol**: Incomplete weekday tasks can be deferred to 8-hour weekend deep-focus blocks with a single click.
- **Unbroken Activity Heatmap**: Calendar-accurate 365-day contribution matrix mapping daily task completions with LeetCode-style intensity tiers.
- **Precomputed Build Pipeline**: Static generator parses markdown syllabus files, precomputes summary vitals, and generates pre-rendered HTML for all 50 weeks to eliminate runtime hydration overhead.
- **WCAG 2.1 Accessibility**: Checkboxes implement semantic `<button role="checkbox">` patterns with dynamic `aria-checked` and task-specific `aria-label` screen reader announcements.

---

## 🏗️ Architecture & Tech Stack

```
tracker/
├── index.html                    # Pre-rendered Executive Dashboard
├── favicon.svg                   # Obsidian Cockpit vector favicon
├── CNAME                         # Custom domain: track.swarajkanse.me
├── css/
│   ├── style.css                 # Custom glassmorphism, animations & tokens
│   ├── tailwind-input.css        # Tailwind base and utilities entry
│   └── tailwind.min.css          # Precompiled, purged CSS bundle (24KB)
├── js/
│   ├── app.js                    # State controller, cloud sync & UI handlers
│   └── dashboard-summary.js      # Precomputed build-time stats & schedule
├── scripts/
│   └── build_website.py          # Python static site generator
├── supabase_security_setup.sql   # Postgres RLS & server-side auth procedures
├── tailwind.config.js            # Tailwind v3 design token configuration
└── weeks/
    ├── week-01.html              # Pre-rendered weekly execution consoles
    └── ... (weeks 02 to 50)
```

- **Frontend**: Pure Vanilla Modern JavaScript (ES6+), Semantic HTML5.
- **Styling**: Tailwind CSS (compiled and purged via Tailwind CLI) + Custom Obsidian Dark Cockpit design tokens.
- **Database & Sync**: Supabase PostgreSQL with Row Level Security (RLS) and `pgcrypto` RPC stored functions.
- **Generator**: Python 3 AST markdown table parser and HTML generator.
- **Hosting**: GitHub Pages via automated deployment to custom domain `track.swarajkanse.me`.

---

## 🛠️ Build & Development

### 1. Prerequisites
- Python 3.9+
- Node.js 18+ (for Tailwind CLI)

### 2. Regenerate Static Site & Precomputed Blobs
To parse the latest Markdown roadmaps from `../Roadmap` and re-render all 50 weekly consoles and the dashboard:

```bash
cd tracker
python scripts/build_website.py
```

### 3. Compile Production Tailwind CSS
To rebuild the purged and minified stylesheet (`css/tailwind.min.css`):

```bash
npx tailwindcss -i ./css/tailwind-input.css -o ./css/tailwind.min.css --minify
```

---

## 🔐 Security & Database Setup

The database uses PostgreSQL Row Level Security (RLS) and cryptographic stored procedures:

1. **Guest Access**: The public `anon` key has read-only access (`SELECT`) to `tracker_state`. Direct table writes (`INSERT`, `UPDATE`, `DELETE`) are revoked.
2. **Authorized Writes**: State updates are committed exclusively through the `sync_tracker_state()` stored procedure, which checks passwords server-side using PostgreSQL's `crypt()` function with Blowfish salting.
3. **Setup**: Run `supabase_security_setup.sql` in your Supabase Dashboard (*SQL Editor -> New Query -> Run*).

---

## 🎨 Design System

- **Background**: `#121316` (Deep Obsidian Surface)
- **Primary Accent**: `#c0c1ff` (Electric Lavender)
- **Container Accent**: `#8083ff` (Vibrant Indigo)
- **Glassmorphism**: `rgba(27, 27, 31, 0.7)` with `backdrop-filter: blur(12px)`
- **Typography**: Space Grotesk (Headlines), Inter (Body), JetBrains Mono (Telemetry/Metrics)

---

## 👤 Author

**Swaraj Kanse**  
- Portfolio: [swarajkanse.me](https://swarajkanse.me/)  
- Tracker: [track.swarajkanse.me](https://track.swarajkanse.me/)  
- GitHub: [@SwarajKanse](https://github.com/SwarajKanse)
