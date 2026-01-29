# Data Privacy Solution: Restricting Information Visibility by Organization

## Problem Statement

Currently, all vehicle data stored on Fabric is visible to all organizations (LTO, HPG, Insurance). While this works for government-to-government sharing, we need to ensure that each organization only sees the **minimum required information** for their verification purposes.

## Solution: Multi-Layer Data Minimization

### Layer 1: On-Chain Data Minimization (Chaincode Level)

**Principle**: Store only essential data on-chain. Keep detailed personal information in PostgreSQL (application layer).

#### Current On-Chain Data (Full Record):
```javascript
{
  vin, make, model, year, color,
  engineNumber, chassisNumber,
  owner: { email, firstName, lastName, phone, address }, // TOO MUCH
  pastOwners: [...], // NOT NEEDED BY HPG/INSURANCE
  documents: {...}, // ALL DOCUMENT CIDs
  notes: { admin: '', insurance: '', hpg: '' },
  history: [...], // FULL HISTORY
  officerInfo: {...} // INTERNAL LTO INFO
}
```

#### Proposed On-Chain Data (Minimized):
```javascript
{
  // Vehicle identification (public to all)
  vin, make, model, year, color,
  engineNumber, chassisNumber,
  plateNumber, crNumber,
  
  // Owner (minimal - only what's needed for verification)
  owner: {
    email: "owner@example.com", // Minimal identifier
    name: "John Doe" // For verification matching
    // NO phone, address, detailed personal info
  },
  
  // Verification status (public to all - needed for endorsement)
  verificationStatus: {
    insurance: 'PENDING',
    hpg: 'PENDING',
    admin: 'PENDING'
  },
  
  // Documents (only CIDs, not full metadata)
  certificates: [
    { type: 'or_cr', pdfHash: '...', ipfsCid: '...' },
    { type: 'insurance', pdfHash: '...', ipfsCid: '...' }
  ],
  
  // Status and timestamps
  status: 'REGISTERED',
  registrationDate: '...',
  lastUpdated: '...',
  
  // History (minimal - only verification actions)
  history: [
    { action: 'VERIFICATION_APPROVED', verifierType: 'hpg', timestamp: '...' }
    // NO officer details, NO full transaction history
  ]
  
  // NO pastOwners array (not needed for verification)
  // NO detailed notes (keep in PostgreSQL)
  // NO officerInfo (internal LTO only)
}
```

---

### Layer 2: MSP-Aware Query Functions (Chaincode Level)

**Principle**: Create separate query functions that return filtered views based on the caller's MSP.

#### New Chaincode Functions:

```javascript
// 1. GetVehicleForVerification - Filtered view for HPG/Insurance
async GetVehicleForVerification(ctx, vin) {
    const clientMSPID = ctx.clientIdentity.getMSPID();
    const vehicleBytes = await ctx.stub.getState(vin);
    if (!vehicleBytes || vehicleBytes.length === 0) {
        throw new Error(`Vehicle with VIN ${vin} not found`);
    }
    
    const vehicle = JSON.parse(vehicleBytes.toString());
    
    // Filter based on MSP
    if (clientMSPID === 'HPGMSP') {
        return JSON.stringify({
            vin: vehicle.vin,
            make: vehicle.make,
            model: vehicle.model,
            year: vehicle.year,
            color: vehicle.color,
            engineNumber: vehicle.engineNumber,
            chassisNumber: vehicle.chassisNumber,
            plateNumber: vehicle.plateNumber,
            owner: {
                name: vehicle.owner?.name || vehicle.owner?.firstName + ' ' + vehicle.owner?.lastName,
                email: vehicle.owner?.email // Minimal - for verification only
            },
            verificationStatus: {
                hpg: vehicle.verificationStatus?.hpg || 'PENDING'
            },
            certificates: vehicle.certificates?.filter(c => 
                c.type === 'or_cr' || c.type === 'hpg_clearance'
            ) || [],
            status: vehicle.status,
            registrationDate: vehicle.registrationDate
            // NO pastOwners, NO full history, NO admin notes
        });
    }
    
    if (clientMSPID === 'InsuranceMSP') {
        return JSON.stringify({
            vin: vehicle.vin,
            make: vehicle.make,
            model: vehicle.model,
            year: vehicle.year,
            color: vehicle.color,
            owner: {
                name: vehicle.owner?.name || vehicle.owner?.firstName + ' ' + vehicle.owner?.lastName,
                email: vehicle.owner?.email // Minimal - for verification only
            },
            verificationStatus: {
                insurance: vehicle.verificationStatus?.insurance || 'PENDING'
            },
            certificates: vehicle.certificates?.filter(c => 
                c.type === 'insurance' || c.type === 'or_cr'
            ) || [],
            status: vehicle.status,
            registrationDate: vehicle.registrationDate
            // NO engine/chassis (not needed for insurance), NO pastOwners, NO full history
        });
    }
    
    // LTO sees full record
    if (clientMSPID === 'LTOMSP') {
        return JSON.stringify(vehicle); // Full access
    }
    
    throw new Error(`Unauthorized MSP: ${clientMSPID}`);
}

// 2. QueryVehiclesForVerification - Filtered list for HPG/Insurance
async QueryVehiclesForVerification(ctx, status) {
    const clientMSPID = ctx.clientIdentity.getMSPID();
    const startKey = '';
    const endKey = '\uffff';
    const resultsIterator = await ctx.stub.getStateByRange(startKey, endKey);
    const vehicles = [];
    
    while (true) {
        const result = await resultsIterator.next();
        if (result.value) {
            try {
                const vehicle = JSON.parse(result.value.value.toString());
                
                // Filter by status if provided
                if (status && vehicle.status !== status) {
                    continue;
                }
                
                // Apply MSP-based filtering
                if (clientMSPID === 'HPGMSP') {
                    vehicles.push({
                        vin: vehicle.vin,
                        make: vehicle.make,
                        model: vehicle.model,
                        year: vehicle.year,
                        verificationStatus: { hpg: vehicle.verificationStatus?.hpg },
                        status: vehicle.status
                    });
                } else if (clientMSPID === 'InsuranceMSP') {
                    vehicles.push({
                        vin: vehicle.vin,
                        make: vehicle.make,
                        model: vehicle.model,
                        year: vehicle.year,
                        verificationStatus: { insurance: vehicle.verificationStatus?.insurance },
                        status: vehicle.status
                    });
                } else if (clientMSPID === 'LTOMSP') {
                    vehicles.push(vehicle); // Full access
                }
            } catch (parseError) {
                // Skip non-vehicle entries
            }
        }
        if (result.done) break;
    }
    
    await resultsIterator.close();
    return JSON.stringify(vehicles);
}
```

---

### Layer 3: Backend Service Filtering (Application Level)

**Principle**: Even if chaincode returns filtered data, add an additional filtering layer in the backend service.

#### Updated `optimizedFabricService.js`:

```javascript
// Get vehicle with automatic filtering based on user context
async getVehicle(vin, userContext = null) {
    if (!this.isConnected) {
        throw new Error('Not connected to Fabric network');
    }
    
    try {
        // Use filtered query if user context is provided
        if (userContext) {
            const userRole = userContext.role;
            const userEmail = userContext.email;
            
            // HPG and Insurance use filtered query
            if (['hpg_admin', 'hpg_officer'].includes(userRole) || 
                (userRole === 'admin' && userEmail && userEmail.toLowerCase().includes('hpg'))) {
                const result = await this.contract.evaluateTransaction('GetVehicleForVerification', vin);
                return {
                    success: true,
                    vehicle: JSON.parse(result.toString()),
                    filtered: true // Indicate data was filtered
                };
            }
            
            if (['insurance_verifier', 'insurance_admin'].includes(userRole)) {
                const result = await this.contract.evaluateTransaction('GetVehicleForVerification', vin);
                return {
                    success: true,
                    vehicle: JSON.parse(result.toString()),
                    filtered: true
                };
            }
        }
        
        // LTO uses full query
        const result = await this.contract.evaluateTransaction('GetVehicle', vin);
        return {
            success: true,
            vehicle: JSON.parse(result.toString()),
            filtered: false
        };
        
    } catch (error) {
        // Error handling...
    }
}
```

---

### Layer 4: Route-Level Filtering (API Level)

**Principle**: Final filtering at the API route level before sending response to frontend.

#### Updated `backend/routes/vehicles.js`:

```javascript
router.get('/:vin', authenticateToken, async (req, res) => {
    try {
        const { vin } = req.params;
        const vehicle = await db.getVehicleByVin(vin);
        
        if (!vehicle) {
            return res.status(404).json({ success: false, error: 'Vehicle not found' });
        }
        
        // Check permissions
        const isAdmin = req.user.role === 'admin';
        const isOwner = String(vehicle.owner_id) === String(req.user.userId);
        const isHPG = ['hpg_admin', 'hpg_officer'].includes(req.user.role) || 
                      (req.user.role === 'admin' && req.user.email?.toLowerCase().includes('hpg'));
        const isInsurance = ['insurance_verifier', 'insurance_admin'].includes(req.user.role);
        
        if (!isAdmin && !isOwner && !isHPG && !isInsurance) {
            return res.status(403).json({ success: false, error: 'Access denied' });
        }
        
        // Get Fabric data with filtering
        const fabricService = require('../services/optimizedFabricService');
        await fabricService.initialize({ role: req.user.role, email: req.user.email });
        const fabricResult = await fabricService.getVehicle(vin, { 
            role: req.user.role, 
            email: req.user.email 
        });
        
        // Apply additional filtering based on role
        let responseVehicle = vehicle;
        
        if (isHPG) {
            // HPG sees: vehicle details, owner name/email (minimal), HPG verification status
            responseVehicle = {
                ...vehicle,
                owner: {
                    name: vehicle.owner_name,
                    email: vehicle.owner_email
                    // NO phone, address, detailed personal info
                },
                // Filter documents - only HPG-relevant
                documents: vehicle.documents?.filter(d => 
                    ['or_cr', 'hpg_clearance', 'owner_id'].includes(d.document_type)
                ) || [],
                // NO ownership history, NO past owners
                history: vehicle.history?.filter(h => 
                    h.action.includes('HPG') || h.action.includes('VERIFICATION')
                ) || []
            };
        }
        
        if (isInsurance) {
            // Insurance sees: vehicle details, owner name/email (minimal), insurance verification status
            responseVehicle = {
                ...vehicle,
                owner: {
                    name: vehicle.owner_name,
                    email: vehicle.owner_email
                    // NO phone, address, detailed personal info
                },
                // Filter documents - only insurance-relevant
                documents: vehicle.documents?.filter(d => 
                    ['insurance_cert', 'or_cr'].includes(d.document_type)
                ) || [],
                // NO ownership history, NO past owners, NO engine/chassis
                engine_number: undefined,
                chassis_number: undefined,
                history: vehicle.history?.filter(h => 
                    h.action.includes('INSURANCE') || h.action.includes('VERIFICATION')
                ) || []
            };
        }
        
        res.json({
            success: true,
            vehicle: responseVehicle,
            fabricData: fabricResult.vehicle,
            filtered: fabricResult.filtered || false
        });
        
    } catch (error) {
        console.error('Error getting vehicle:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
```

---

## Implementation Plan

### Phase 1: Update Chaincode (Data Minimization)
1. ✅ Modify `RegisterVehicle` to store minimal owner data
2. ✅ Modify `MintVehicle` to store minimal data
3. ✅ Add `GetVehicleForVerification` function
4. ✅ Add `QueryVehiclesForVerification` function
5. ✅ Update `GetVehicle` to use filtering logic

### Phase 2: Update Backend Service
1. ✅ Update `optimizedFabricService.js` to use filtered queries
2. ✅ Add `userContext` parameter to query methods
3. ✅ Implement automatic filtering based on user role

### Phase 3: Update API Routes
1. ✅ Update `backend/routes/vehicles.js` with route-level filtering
2. ✅ Update `backend/routes/hpg.js` to use filtered queries
3. ✅ Update `backend/routes/insurance.js` to use filtered queries
4. ✅ Ensure all vehicle queries respect MSP-based filtering

### Phase 4: Testing
1. ✅ Test HPG queries (should see minimal data)
2. ✅ Test Insurance queries (should see minimal data)
3. ✅ Test LTO queries (should see full data)
4. ✅ Verify verification workflows still work

---

## Data Visibility Matrix

| Data Field | LTO | HPG | Insurance |
|------------|-----|-----|-----------|
| VIN | ✅ | ✅ | ✅ |
| Make/Model/Year | ✅ | ✅ | ✅ |
| Color | ✅ | ✅ | ✅ |
| Engine Number | ✅ | ✅ | ❌ |
| Chassis Number | ✅ | ✅ | ❌ |
| Plate Number | ✅ | ✅ | ❌ |
| Owner Name | ✅ | ✅ | ✅ |
| Owner Email | ✅ | ✅ | ✅ |
| Owner Phone | ✅ | ❌ | ❌ |
| Owner Address | ✅ | ❌ | ❌ |
| Past Owners | ✅ | ❌ | ❌ |
| Full History | ✅ | ❌ | ❌ |
| Admin Notes | ✅ | ❌ | ❌ |
| Officer Info | ✅ | ❌ | ❌ |
| All Document CIDs | ✅ | Filtered | Filtered |
| Verification Status | ✅ | Own only | Own only |

---

## Benefits

1. **Privacy by Design**: Each org sees only what's needed
2. **No PDC Complexity**: Achieves privacy without Private Data Collections
3. **Backward Compatible**: LTO still sees full data
4. **Verification Still Works**: HPG/Insurance can still verify vehicles
5. **Audit Trail**: Full data still exists on-chain (LTO can audit)
6. **Performance**: No PDC reconciliation overhead

---

## Migration Notes

- **Existing Data**: Current full records remain on-chain
- **Backward Compatibility**: `GetVehicle` still returns full data for LTO
- **Gradual Rollout**: New filtered functions can be added without breaking existing code
- **Testing**: Test with existing vehicles to ensure verification workflows still work

---

## Alternative: If PDCs Are Required Later

If stricter privacy is needed (e.g., owner email must be completely hidden from HPG/Insurance), we can implement Private Data Collections:

1. Store owner email in PDC `collectionLTOOnly`
2. Store document CIDs in PDC `collectionLTOOnly`
3. HPG/Insurance queries return vehicle data without owner email
4. Verification uses VIN + owner name matching (no email required)

**Trade-off**: More complex, slower queries, harder to debug.

**Recommendation**: Start with multi-layer filtering (this solution). Add PDCs only if legally required or if privacy concerns escalate.
