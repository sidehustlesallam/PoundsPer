## PoundsPer - AI Agent Context File

### 🎯 Project Overview
PoundsPer is a unified, postcode-driven property intelligence scanning platform for homes in the United Kingdom. The primary goal of the system is to consolidate fragmented, authoritative public datasets into a single, coherent, and structured report. This report serves as a lightweight decision-support tool for buyers, renters, and renovators.

### 💡 Core Functionality
The system accepts a UK postcode as input and synthesizes data from multiple specialized sources to provide a comprehensive overview of a property's:
1. **Condition:** Energy Performance Certificates (EPC).
2. **Value Context:** Property Price Index (PPI) and House Price Index (HPI).
3. **Local Amenities:** Local school data.
4. **Environmental Factors:** Environmental risks (e.g., flood and radon).
5. **Utilities:** Household utility information.

### 📂 Repository Structure & Module Roles

**Root Files:**
*   `index.html`: The main user interface and entry point for the application.
*   `app.js`: Contains the primary application logic, handling the overall workflow from user input to data synthesis and rendering.
*   `README.md`: Project documentation (general context).
*   `test/workflow.test.js`: Unit tests for the core workflow logic, specifically validating resilience against external API failures.

**`cloudflare/` Directory:**
*   `worker.js`: Acts as the central API gateway and data aggregator. It handles all external API calls (EPC, PPI, Schools, etc.), standardizing the data format and providing robust error handling before passing data to the client. **Note:** Changes here affect the live cloudflare deployment.

**`core/` Directory:**
*   `fetcher.js`: Low-level network layer responsible for making external API calls via `workerFetch`. It wraps `fetch` and handles basic JSON parsing and network error logging.
*   `state.js`: Manages the application's global state (e.g., the current postcode, loaded data, UI state).
*   `utils.js`: General utility functions (e.g., `safeJson`, `round`, `cleanPostcode`) used across the application for data manipulation and validation.

**`modules/` Directory (Data Specific Modules):**
This directory holds specialized modules, each responsible for fetching, processing, and structuring data from a specific domain:
*   `epc.js`: Handles Energy Performance Certificate data. **(Improved: Now includes robust error handling and fallback logic.)**
*   `ppi.js`: Handles Property Price Index data. Includes logic to enrich raw PPI data with EPC details and calculate market averages.
*   `hpi.js`: Handles House Price Index data. Provides factor lookup and price adjustment utilities.
*   `schools.js`: Handles local school data and ratings.
*   `risk.js`: Handles environmental risk data (e.g., flood, radon).
*   `utilities.js`: Handles household utility data.
*   `map.js`: Handles geographical mapping and visualization of data points using coordinates from the EPC data.

### ⚙️ Workflow Summary
1.  **Input:** User enters a postcode/UPRN via `index.html`.
2.  **Orchestration (`app.js`):** `app.js` triggers the data fetching process.
3.  **Data Fetching:** The system calls relevant modules (e.g., `epc.js`, `ppi.js`) which, in turn, use `core/fetcher.js` and `cloudflare/worker.js` to gather raw data.
4.  **Data Synthesis:** Data is processed, synthesized, and stored in the application state (`core/state.js`).
5.  **Rendering:** Finally, the structured data is passed to `modules/render.js` for presentation to the user.

### 🚀 Key Concepts for AI Agents & Future Improvements
*   **Resilience:** The system has been hardened to gracefully degrade. If the EPC data fails, the core workflow continues to fetch and display PPI, Schools, and other data using the postcode fallback.
*   **Extensibility:** The modular design remains highly extensible. Adding a new data source only requires creating a new module and updating `app.js` and `worker.js`.
*   **Testing:** Unit tests (`test/workflow.test.js`) are in place to validate the fallback workflow, ensuring stability when external APIs fail.
*   **Next Iteration Focus:**
    *   **Data Normalization:** Standardize data types and units across all modules (e.g., ensure all area measurements are consistently handled).
    *   **User Feedback:** Implement a mechanism to allow users to report data discrepancies or API failures directly within the UI.
    *   **Advanced Visualization:** Enhance `modules/map.js` to plot multiple data points (e.g., risk zones, school catchment areas) rather than just the single EPC point.