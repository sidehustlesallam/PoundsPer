

# **£PER | Property Audit Engine v11.9**  
### *Forensic Asset Intelligence for UK Residential Property*

£Per is a **high‑precision due‑diligence engine** that transforms raw property data into actionable intelligence.  
It ingests multiple UK data sources, normalises them, and renders a clean, surgical dashboard designed for investors, analysts, and acquisition teams.

This version (**v11.9**) introduces a hardened Worker, structured error handling, EPC safety wrappers, and module‑level isolation.

---

## **1. System Overview**

£Per performs a multi‑stage audit:

| Module | Source | Purpose |
|--------|--------|---------|
| **UPRN Extraction** | Zoopla HTML | Identifies the unique property reference number. |
| **EPC Intelligence** | EPC ODC API | Retrieves energy rating, floor area, and address metadata. |
| **Market Analysis** | Land Registry PPI | Shows recent sales and calculates local market averages. |
| **Schools Infrastructure** | GetTheData API | Provides Ofsted ratings and school types. |
| **Environmental (Future)** | EA / UKHSA | Flood, radon, and environmental risk. |
| **Connectivity (Future)** | Ofcom | Fibre, FTTC, and 5G availability. |
| **Title Deeds (Pro Tier)** | HMLR Business Gateway | Ownership, charges, covenants, boundaries. |

All modules are isolated using `Promise.allSettled()` to prevent cascading failures.

---

## **2. Project Structure**

```
/poundsper-v11.9
├── index.html        # Dashboard UI (Tailwind + Dark Surgical Theme)
├── app.js            # Audit Engine, EPC wrapper, module orchestration
├── worker.js         # Cloudflare Worker proxy (EPC auth, Zoopla parsing)
└── README.md         # This file
```

---

## **3. Core Technologies**

### **Frontend**
- Vanilla JS (no frameworks)
- TailwindCSS (CDN)
- Roboto Mono + Inter typography
- Modular audit panels with real‑time status indicators

### **Backend**
- **Cloudflare Worker** (secure proxy)
- EPC Basic Auth injection
- Zoopla HTML parsing for UPRN extraction
- JSON fallback shielding to prevent UI crashes

### **Data Sources**
- EPC Open Data Communities  
- Land Registry PPI  
- GetTheData Schools API  
- Zoopla (HTML scraping via Worker)  

---

## **4. Cloudflare Worker (v11.9)**

The Worker performs:

### **✓ EPC Authentication**
Injects Basic Auth token stored in Worker environment variables.

### **✓ Zoopla UPRN Extraction**
Hardened regex handles:
- `"uprn":"123"`
- `'uprn':'123'`
- Minified JS
- Escaped JSON

### **✓ JSON Safety Layer**
If an upstream API returns:
- HTML  
- 404  
- 500  
- malformed JSON  

…the Worker returns a **structured safe‑empty object** instead of letting the frontend crash.

### **✓ CORS Handling**
Full preflight support for browser requests.

---

## **5. Frontend Engine (app.js)**

### **Key Features**
- `safeFetch()` returns structured errors (never null)
- EPC normalization wrapper prevents undefined UI states
- Postcode normalization (clean, spaced, outward)
- Module isolation via `Promise.allSettled()`
- EPC badge error states:
  - Pending  
  - Error  
  - Resolved  

### **Modules Included**
- **Market Data** (Land Registry PPI)
- **Schools Data** (GetTheData)
- **EPC Metrics** (rating, area, address)
- **UPRN Display**

### **Modules Ready for Integration**
- Flood Risk  
- Radon  
- Connectivity  
- Title Deeds (Pro Tier)  

---

## **6. UI (index.html)**

The UI is designed to feel like a **forensic instrument**, not a consumer app.

### **Design Principles**
- Dark surgical theme  
- Monospaced data typography  
- High‑contrast audit panels  
- Real‑time status indicator  
- EPC badge with error/pending states  
- Responsive grid layout  

### **Dashboard Sections**
1. **Registered Asset Location**  
2. **EPC Certificate Panel**  
3. **Environmental Risk**  
4. **Local Education Infrastructure**  
5. **Land Registry PPI Table**  

---

## **7. How the Audit Flow Works**

1. User enters:
   - Zoopla URL  
   - UPRN  
   - Postcode  

2. Worker resolves:
   - UPRN (if Zoopla URL)
   - EPC metadata

3. Frontend normalises:
   - Address  
   - Postcode formats  
   - Floor area  

4. Modules fire in parallel:
   - Market  
   - Schools  
   - (future: Flood, Radon, Connectivity)

5. Dashboard updates in real time.

---

## **8. Environment Variables (Worker)**

In Cloudflare Worker settings:

```
EPC_TOKEN = base64(username:password)
```

This is required for EPC API access.

---

## **9. Roadmap (v12.x)**

### **12.0 — Environmental Intelligence Pack**
- Flood Zone classification  
- Radon probability  
- River/sea proximity  

### **12.1 — Connectivity Module**
- FTTP / FTTC availability  
- 5G coverage  
- Average broadband speeds  

### **12.2 — Title Deeds (Pro Tier)**
- HMLR Business Gateway integration  
- Ownership  
- Charges  
- Restrictive covenants  
- Boundary notes  

### **12.3 — Staleness & Market Pressure**
- Listing age  
- Price reductions  
- Agent behaviour patterns  

---

## **10. License**

This project is proprietary and not licensed for redistribution.  
All rights reserved.

---

