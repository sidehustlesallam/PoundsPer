// test/workflow.test.js

import { getEpcRows } from '../modules/epc.js';
import { runDownstream } from '../app.js'; // Assuming runDownstream is exported or accessible for testing
import { state, resetState } from '../core/state.js';
import { fetchPpi } from '../modules/ppi.js';
import { fetchSchools } from '../modules/schools.js';
import { fetchUtilities } from '../modules/utilities.js';
import { fetchFloodRisk } from '../modules/risk.js';
import { fetchRadonRisk } from '../modules/risk.js';
import { initMap } from '../modules/map.js';

// Mock dependencies to simulate failure and control state
jest.mock('../modules/epc.js', () => ({
  getEpcRows: jest.fn(),
  getEpcCertificate: jest.fn(),
  pickEpcRow: jest.fn(),
}));

jest.mock('../modules/ppi.js', () => ({
  fetchPpi: jest.fn(),
  applyHpiAdjustments: jest.fn(),
  computeMarketAverages: jest.fn(),
}));

jest.mock('../modules/schools.js', () => ({
  fetchSchools: jest.fn(),
}));

jest.mock('../modules/utilities.js', () => ({
  fetchUtilities: jest.fn(),
}));

jest.mock('../modules/risk.js', () => ({
  fetchFloodRisk: jest.fn(),
  fetchRadonRisk: jest.fn(),
}));

jest.mock('../modules/map.js', () => ({
  initMap: jest.fn(),
}));

describe('Workflow Resilience Testing', () => {
  beforeEach(() => {
    resetState();
    jest.clearAllMocks();
  });

  it('should run downstream scan successfully even if EPC search fails', async () => {
    // 1. Simulate EPC search failure
    getEpcRows.mockResolvedValue({ rows: [], error: { message: "Simulated EPC API Failure" } });
    
    // 2. Mock all downstream services to resolve successfully
    fetchPpi.mockResolvedValue({});
    fetchSchools.mockResolvedValue({});
    fetchUtilities.mockResolvedValue({});
    fetchFloodRisk.mockResolvedValue({});
    fetchRadonRisk.mockResolvedValue({});
    initMap.mockImplementation(() => {});

    // 3. Mock the core function that runs the scan (assuming we can access it or mock the necessary setup)
    // Since runDownstream is called from app.js, we need to simulate the state setup that leads to it.
    
    // Simulate the state setup that happens when EPC fails but postcode is available
    const mockPostcode = "SW1A 1AA";
    
    // Manually set state to simulate the fallback path in app.js
    state.epc = { localAuthority: "Greater London Authority" }; 
    
    // Execute the function that runs the downstream scan
    await runDownstream(mockPostcode);

    // Assertions
    expect(getEpcRows).toHaveBeenCalledWith({ postcode: mockPostcode, uprn: undefined });
    expect(fetchPpi).toHaveBeenCalledWith(mockPostcode);
    expect(fetchSchools).toHaveBeenCalledWith(mockPostcode);
    expect(fetchUtilities).toHaveBeenCalledWith(mockPostcode);
    expect(fetchFloodRisk).toHaveBeenCalledWith(mockPostcode);
    expect(fetchRadonRisk).toHaveBeenCalledWith(mockPostcode);
    expect(initMap).toHaveBeenCalledWith("map");
  });

  it('should handle missing postcode gracefully during fallback scan', async () => {
    // 1. Simulate EPC search failure
    getEpcRows.mockResolvedValue({ rows: [], error: { message: "Simulated EPC API Failure" } });
    
    // 2. Mock all downstream services
    fetchPpi.mockResolvedValue({});
    fetchSchools.mockResolvedValue({});
    fetchUtilities.mockResolvedValue({});
    fetchFloodRisk.mockResolvedValue({});
    fetchRadonRisk.mockResolvedValue({});
    initMap.mockImplementation(() => {});

    // 3. Simulate the fallback path with no postcode
    const mockPostcode = null;
    
    // Manually set state to simulate the fallback path in app.js
    state.epc = { localAuthority: "Unknown" }; 
    
    // We need to mock the internal logic of app.js's handleSearch to call runDownstream(null)
    // For simplicity in this test, we assume the calling context ensures runDownstream is called with the correct (or null) postcode.
    await runDownstream(mockPostcode);

    // Assertions
    expect(fetchPpi).toHaveBeenCalledWith(mockPostcode);
    expect(fetchSchools).toHaveBeenCalledWith(mockPostcode);
  });
});