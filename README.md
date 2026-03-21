# 🏠 £Per (PoundsPer) | Property Truth Engine

**Bridging Information Asymmetry in the UK Real Estate Market.**

£Per is a high-performance "Due Diligence Dashboard" designed to empower buyers and renters. By aggregating fragmented government data, environmental risks, and market analytics into a single "Surgical" interface, £Per reveals the data that estate agents often omit.

---

## 🚀 Core Features

### 🔍 Intelligence Modules
* **Price Transparency:** Real-time calculation of £/m² using HMLR Price Paid data cross-referenced with EPC floor areas.
* **Listing Analytics:** Automatic extraction of Postcodes/UPRNs from Zoopla and Rightmove URLs.
* **Environmental Risk:** Proximity-based flood risk (Environment Agency) and Radon gas alerts.
* **Connectivity Intel:** Ultra-fast broadband availability and 5G mobile coverage (Ofcom).
* **Educational Context:** Nearest school identification with latest Ofsted ratings and age ranges.
* **Staleness Tracker:** Analysis of how long a property has been on the market to aid negotiation.

### 💎 Pro Features (Roadmap)
* **Title Deed Access:** Direct integration with HMLR Business Gateway for Title Registers and Plans.
* **Covenant Detection:** AI-assisted scanning of deeds for restrictive covenants and easements.
* **Watchlists:** Account-based property tracking with price-drop alerts.

---

## 🛠 Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | HTML5, Tailwind CSS, JavaScript (ES6+) |
| **Backend/Bridge** | Cloudflare Workers (Stealth Proxy Logic) |
| **Auth/Database** | Supabase (PostgreSQL) |
| **Payments** | Stripe API |
| **Hosting** | GitHub Pages / Vercel |

---

## 📂 Project Structure

```text
/poundsper-truth-engine
├── index.html       # Dashboard Shell & UI Components
├── style.css       # Custom Glassmorphism & Theme Logic
├── app.js          # Main Orchestrator (Scraping, APIs, UI Injection)
├── worker.js       # Cloudflare Stealth Proxy (Bypassing CORS/Bot detection)
└── README.md       # Project Documentation

This tool is for informational purposes only. Official property decisions should be supported by professional surveys and legal advice.
