## PoundsPer - AI Agent Context File

### 🎯 Project Overview
PoundsPer is a unified, postcode-driven property intelligence scanning platform for homes in the United Kingdom. The primary goal of the system is to consolidate fragmented, authoritative public datasets into a single, coherent, and structured report. This report serves as a lightweight decision-support tool for buyers, renters, and renovators.

### 💡 Core Functionality
The system accepts a UK postcode as input and synthesizes data from multiple specialized sources to provide a comprehensive overview of a property's:
1.  **Condition:** Energy Performance Certificates (EPC).
2.  **Value Context:** Property Price Index (PPI) and House Price Index (HPI).
3.  **Local Amenities:** Local school data.
4.  **Environmental Factors:** Environmental risks (e.g., flood and radon).
5.  **Utilities:** Household utility information.

### 📂 Repository Structure & Module Roles

**Root Files:**
*   `index.html`: The main user interface and entry point for the application.
*   `app.js`: Contains the primary application logic, handling the overall workflow from user input to data synthesis and rendering.
*   `README.md`: Project documentation (general context).
*   `test.txt`: Placeholder or testing file.

**`cloudflare/` Directory:**
*   `worker.js`: Likely handles server-side or edge-based logic, responsible for fetching, aggregating, and potentially sanitizing data from external APIs before it reaches the client. Any changes can be made and end user will copy to cloudflare account. 

**`core/` Directory:**
*   `fetcher.js`: Module responsible for making external API calls and retrieving raw data.
*   `state.js`: Manages the application's state (e.g., the current postcode, loaded data, UI state).
*   `utils.js`: General utility functions used across the application (e.g., formatting, validation).

**`modules/` Directory (Data Specific Modules):**
This directory holds specialized modules, each responsible for fetching, processing, and structuring data from a specific domain:
*   `epc.js`: Handles Energy Performance Certificate data.
*   `ppi.js`: Handles Property Price Index data.
*   `hpi.js`: Handles House Price Index data.
*   `schools.js`: Handles local school data and ratings.
*   `risk.js`: Handles environmental risk data (e.g., flood, radon).
*   `utilities.js`: Handles household utility data.
*   `map.js`: Likely handles geographical mapping and visualization of data points.

### ⚙️ Workflow Summary
1.  User enters a postcode via `index.html`.
2.  `app.js` triggers the data fetching process, potentially utilizing `core/fetcher.js` and `cloudflare/worker.js`.
3.  The system calls the relevant modules in `modules/` (e.g., `epc.js`, `ppi.js`) to gather specific data points.
4.  The data is processed, synthesized, and stored in the application state (`core/state.js`).
5.  Finally, the structured data is passed to `modules/render.js` for presentation to the user.

### 🚀 Key Concepts for AI Agents
*   **Postcode-Driven:** All data retrieval is anchored to a UK postcode.
*   **Data Synthesis:** The core value is not just fetching data, but *synthesizing* it into a single narrative report.
*   **Modular Design:** The separation of concerns into `modules/` makes the system highly extensible for adding new data sources.
*   **Decision Support:** The output must be clear, actionable, and easy for a non-technical user to interpret.