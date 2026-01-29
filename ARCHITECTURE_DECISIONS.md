# Architecture Decisions: Privacy, Identity, and Tokenization

## 1. Private Data Collections (PDCs) - Do We Need Them?

### Current Implementation
- **All vehicle data is public** to all organizations on the channel
- HPG and Insurance can see:
  - Vehicle details (VIN, make, model, year, etc.)
  - Owner information (email, name)
  - Document CIDs (IPFS links)
  - Verification status
  - Full transaction history

### Analysis: What Data Should Be Private?

#### **Option A: No PDCs (Current Approach)** ✅ **RECOMMENDED**

**Pros:**
- Simpler implementation (no PDC configuration needed)
- All orgs can verify vehicles independently
- Full audit trail visible to all participants
- Faster queries (no PDC reconciliation needed)
- Lower complexity for thesis demonstration

**Cons:**
- Owner email/name visible to HPG and Insurance
- Document CIDs visible to all orgs (though documents themselves are in IPFS)

**When this works:**
- Government-to-government data sharing (LTO, HPG, Insurance are all government agencies)
- Data privacy laws allow inter-agency sharing for verification purposes
- Transparency is prioritized over privacy

#### **Option B: Use PDCs for Sensitive Data** ⚠️ **COMPLEX**

**What could be private:**
- Owner personal information (email, phone, address)
- Document CIDs (IPFS links to documents)
- Officer information (for internal LTO use)

**What must be public:**
- Vehicle VIN, make, model, year (needed for verification)
- Verification status (needed for endorsement policy)
- Transaction history (needed for audit)

**Implementation complexity:**
- Requires PDC configuration in chaincode
- Requires gossip protocol for PDC distribution
- More complex queries (need to reconcile public + private data)
- Additional testing overhead

### **Recommendation: NO PDCs for This Implementation**

**Rationale:**
1. **Government-to-Government Context**: LTO, HPG, and Insurance are all government agencies. Inter-agency data sharing for vehicle verification is standard practice and legally acceptable.

2. **Verification Requirements**: HPG and Insurance need to verify vehicles belong to specific owners. Hiding owner information would complicate verification workflows.

3. **Thesis Scope**: Adding PDCs increases complexity significantly without clear benefit for the use case. The focus should be on demonstrating multi-org verification and preventing technical carnapping.

4. **Data Minimization Alternative**: Instead of PDCs, we can:
   - Store minimal owner info on-chain (email only, not full address/phone)
   - Keep detailed personal info in PostgreSQL (application layer)
   - Use application-level access control to restrict UI visibility

### **If PDCs Are Required Later:**

**Implementation approach:**
```javascript
// In chaincode, use PutPrivateData instead of PutState for sensitive fields
const privateCollection = 'collectionLTOOnly'; // Only LTO peers have this collection

// Store owner email privately
await ctx.stub.putPrivateData(privateCollection, `owner~${vin}`, Buffer.from(vehicle.owner.email));

// Store document CIDs privately
await ctx.stub.putPrivateData(privateCollection, `docs~${vin}`, Buffer.from(JSON.stringify(documentCids)));
```

**PDC Configuration (configtx.yaml):**
```yaml
Capabilities:
  Application: &ApplicationCapabilities
    V2_0: true
    V2_5: true  # Required for PDCs

Organizations:
  - &LTO
    # ... existing config ...
    # Add private data collection config
```

**Trade-offs:**
- ✅ Better privacy for owner data
- ❌ More complex implementation
- ❌ Slower queries (PDC reconciliation)
- ❌ Additional configuration overhead
- ❌ Harder to debug

---

## 2. Should Each User/Owner Have Different Wallet Addresses?

### Clarification: Fabric Uses Identities, Not "Addresses"

**Hyperledger Fabric does NOT use "wallet addresses" like Ethereum.** Instead:
- **Fabric uses X.509 certificates** (public key certificates)
- **Identities are stored in wallets** (file system or HSM)
- **No concept of "addresses"** - identities are identified by enrollment ID (usually email)

### Current Implementation ✅ **CORRECT**

**Server-Side Wallet Model:**
- **Org identities**: `admin-lto`, `admin-hpg`, `admin-insurance` (one per organization)
- **Staff identities**: Enrolled via Fabric CA when staff accounts are created (e.g., `hpg@hpg.gov.ph`)
- **Vehicle owners**: **NO Fabric identities** (functional control only, no cryptographic authority)

**Why This Works:**
1. **Prevents Insider Abuse**: Vehicle owners cannot directly submit Fabric transactions
2. **Enforces Verification Gates**: Only authorized orgs can approve/verify
3. **Simpler Key Management**: No need to manage thousands of owner keys
4. **Matches Thesis Scope**: Focus on preventing technical carnapping, not owner self-sovereignty

### **If Owners Need Fabric Identities (Scope Increase):**

**What would change:**
1. Enroll each owner in Fabric CA when they register
2. Store owner identity in server-side wallet (key: `owner.email`)
3. Create owner-callable chaincode functions (e.g., `OwnerInitiateTransfer`)
4. Owner signs their own transactions

**Trade-offs:**
- ✅ True cryptographic control for owners
- ✅ Better decentralization
- ❌ Significant scope increase
- ❌ Key management complexity (thousands of identities)
- ❌ Wallet size grows with user base
- ❌ Requires owner key recovery mechanisms

**Recommendation: Keep Current Model**
- Current model aligns with thesis scope
- Owners have functional control (initiate workflows, view state)
- Cryptographic control remains with authorized orgs (prevents abuse)

---

## 3. Token IDs for Vehicles: VIN vs Separate Token ID

### Current Implementation ✅ **USING VIN AS KEY**

**Chaincode uses VIN as the primary key:**
```javascript
await ctx.stub.putState(vehicle.vin, Buffer.from(JSON.stringify(vehicleRecord)));
```

### Analysis: Do We Need Separate Token IDs?

#### **Option A: Use VIN as Token ID (Current)** ✅ **RECOMMENDED**

**Pros:**
- VIN is globally unique (17 characters, standardized)
- VIN is immutable (never changes)
- VIN is human-readable (easier debugging)
- No additional ID generation needed
- Aligns with real-world vehicle registration systems

**Cons:**
- VIN is public information (visible on vehicle)
- Cannot be "minted" without VIN (but this is fine - CSR provides VIN)

**When this works:**
- Vehicle registration systems (standard practice)
- VIN is the natural identifier
- No need for abstract tokenization

#### **Option B: Generate Separate Token ID** ⚠️ **UNNECESSARY COMPLEXITY**

**What would change:**
- Generate UUID or sequential ID for each vehicle
- Store token ID on-chain
- Use token ID as key instead of VIN
- Maintain VIN → Token ID mapping

**Trade-offs:**
- ✅ Abstract tokenization (like ERC-721 NFTs)
- ❌ Additional complexity (need mapping)
- ❌ Less intuitive (VIN is the natural identifier)
- ❌ Not aligned with real-world vehicle registration

### **Recommendation: Keep VIN as Primary Key**

**Rationale:**
1. **Real-World Alignment**: Vehicle registration systems use VIN as the primary identifier
2. **Simplicity**: No need for token ID generation or mapping
3. **Pre-Minted Vehicles**: VIN exists before owner attachment (from CSR), so it's perfect for minting
4. **Query Efficiency**: Direct VIN lookup is faster than token ID → VIN mapping

### **For Pre-Minted Vehicles:**

**Current approach (correct):**
- `MintVehicle()` creates vehicle with VIN as key, `status='MINTED'`, `owner=null`
- `AttachOwnerToMintedVehicle()` attaches owner, changes status to `REGISTERED`
- VIN serves as both "token ID" and vehicle identifier

**No separate token ID needed** - VIN is sufficient.

### **If Tokenization Is Required (Future Enhancement):**

**Use case**: If you want to represent vehicles as tradeable tokens (like NFTs)

**Implementation:**
```javascript
// Generate token ID during minting
const tokenId = `VEHICLE-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

// Store token ID in vehicle record
vehicleRecord.tokenId = tokenId;

// Create composite key for token lookup
const tokenKey = ctx.stub.createCompositeKey('token~vin', [tokenId, vehicle.vin]);
await ctx.stub.putState(tokenKey, Buffer.from(vehicle.vin));

// Use VIN as primary key, token ID as secondary identifier
await ctx.stub.putState(vehicle.vin, Buffer.from(JSON.stringify(vehicleRecord)));
```

**But this is NOT needed for vehicle registration** - VIN is sufficient.

---

## Summary of Recommendations

### 1. Private Data Collections: **NO** ✅
- Current public data model is appropriate for government-to-government sharing
- Application-level access control can restrict UI visibility
- PDCs add complexity without clear benefit for this use case

### 2. Wallet Addresses per Owner: **NO** ✅
- Current server-side wallet model is correct
- Owners have functional control, not cryptographic control
- Org/staff identities are sufficient for multi-org verification

### 3. Separate Token IDs: **NO** ✅
- VIN is the natural identifier and serves as the "token ID"
- Pre-minted vehicles use VIN as key (no owner needed)
- No additional tokenization layer required

---

## Implementation Status

All three decisions are **already correctly implemented** in the current codebase:
- ✅ No PDCs (public data model)
- ✅ Server-side wallet (org identities only)
- ✅ VIN as primary key (no separate token IDs)

No code changes needed for these architectural decisions.
