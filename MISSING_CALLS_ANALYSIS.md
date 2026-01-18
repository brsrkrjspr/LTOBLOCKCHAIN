# Missing API Calls, Functions, and Methods Analysis

## Hypotheses

1. **API endpoints called from frontend that don't exist in backend routes**
   - Some endpoints might be called but not registered in server.js
   - Route paths might not match exactly (e.g., `/api/vehicles/transfer/requests/stats` vs `/api/transfer/requests/stats`)

2. **Function calls that reference undefined functions**
   - Functions called but not defined in the scope
   - Functions removed but still referenced

3. **Method calls on objects that don't have those methods**
   - Methods called on objects that don't support them
   - API client methods that don't exist

4. **API client helper methods that don't exist**
   - Methods like `apiClient.get()`, `apiClient.post()` might not be properly implemented
   - Missing convenience methods

5. **Route path mismatches**
   - Frontend calls `/api/vehicles/transfer/requests/stats` but backend might be `/api/transfer/requests/stats`
   - Path parameter mismatches

## Instrumentation Plan

1. Add logging to API client to track all requests and responses
2. Add error tracking for 404s (endpoint not found)
3. Add logging for undefined function calls
4. Compare frontend API calls with backend route registrations
