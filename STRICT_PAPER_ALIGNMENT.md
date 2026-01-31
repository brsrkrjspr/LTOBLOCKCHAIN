# Strict Paper Alignment Implementation Plan
**Objective:** Align the technical implementation strictly with the "TrustChain" Capstone Paper (Chapter 3: Research Methodology & Chapter 6: Security and Governance).

## 1. Core Requirement: Three-Node Consortium (Critical)
**Paper Citation:**  
> "The blockchain network is deployed as a **three-node consortium**... Each node corresponds to a participating organization (LTO, HPG, Insurance) and hosts a peer that maintains a complete copy of the distributed ledger." (Chapter 3, Section 5.4)

**Current Gap:**  
The running network is currently effectively a "Single Organization" (LTO-only) bootstrap to fix certificate errors. The HPG and Insurance peers are defined in `docker-compose.yaml` but are not actively participating due to missing crypto material.

**Strict Solution:**
We must **re-enable** the full 3-Org network. This is non-negotiable for "Strict Alignment".
1.  **Generate Certificates** for HPG and Insurance using `cryptogen` or Fabric CA.
2.  **Join Peers to Channel**: Ensure `peer0.hpg.gov.ph` and `peer0.insurance.gov.ph` are joined to `ltochannel`.
3.  **Endorsement Policy**: Update chaincode endorsement to require LTO + (HPG or Insurance) for final approval, matching the governance model.

## 2. Core Requirement: Role-Based Endorsement
**Paper Citation:**  
> "The HPG peer endorses transactions by confirming that vehicles... are not reported as stolen... Insurance verification is treated as a prerequisite condition... using a simulated role." (Chapter 6, Section 6.1)

**Strict Solution:**
1.  **HPG Peer**: Must have its own MSP (`HPGMSP`). The application must invoke the HPG peer for "Clearance" transactions.
2.  **Insurance Peer**: Must have its own MSP (`InsuranceMSP`).
3.  **LTO Peer**: Validates final registration (`LTOMSP`).

## 3. Core Requirement: CSR as "Pre-Minted" Baseline
**Paper Citation:**  
> "...CSR derived information is initialized as **baseline vehicle records**... ownership status marked as UNASSIGNED." (Chapter 2, Section 2.7)

**Strict Solution:**
1.  **Maintain "Minted" Status**: Continue using the `MINTED` status for new vehicles.
2.  **No Dealership Node**: Explicitly **exclude** a dealership org. The system *starts* with LTO admin minting the vehicle (simulating the API feed from manufacturers), exactly as implemented.

## 4. Modified Implementation Roadmap (Strict Mode)

### Step 1: Crypto Generation (The "Fix")
We cannot run a 3-node network without 3 sets of certificates.
- **Action**: Run a script to generate crypto-config for `HPG` and `INSURANCE` organizations.
- **Why**: To fix the `ENOENT` errors that forced us into single-org mode.

### Step 2: Full Network Boot
- **Action**: Restore `network-config.json` to include all 3 organizations.
- **Action**: Start `docker-compose.unified.yml` with ALL peers active.

### Step 3: Channel Join
- **Action**: Execute `peer channel join` for HPG and Insurance peers.
- **Action**: Update Anchor Peers for all 3 orgs.

### Step 4: Chaincode Verification
- **Action**: Install `vehicle-registration` chaincode on **ALL 3 PEERS**.
- **Action**: Approve chaincode definition for **ALL 3 ORGS**.
- **Action**: Commit chaincode with policy: `AND('LTOMSP.peer', OR('HPGMSP.peer', 'InsuranceMSP.peer'))` (or similar governance rule).

## 5. Summary of Divergence
| Feature | Strict Paper Requirement | Current "Quick Fix" State | Action Required |
| :--- | :--- | :--- | :--- |
| **Topology** | 3 Organizations (LTO, HPG, Insurance) | 1 Organization (LTO) | **Generate Certs & Join Peers** |
| **Peers** | 3 Physical/Logical Peers | 1 Active Peer | **Start HPG/Insurance Containers** |
| **Endorsement**| Consensus across organizations | LTO Self-Endorsement | **Update Endorsement Policy** |
| **CSR** | Pre-Existing / Unassigned | Pre-Existing / Unassigned | **Keep (Aligned)** |

**Conclusion:**
To strictly reflect the paper, we must move out of the "Single-Org Debug Mode" and properly instantiate the HPG and Insurance nodes. This requires fixing the missing certificate issue properly (by generating them) rather than bypassing it (by removing the orgs).
