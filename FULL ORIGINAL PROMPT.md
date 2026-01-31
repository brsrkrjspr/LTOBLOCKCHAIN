Contexts to use:
- Source of truth and must not produce other than what is mentioned here. What is mentioned here must be the only ones present in this codebase @blockchain%20capstone.docx 
- We are using digital ocean through establishing ssh connection
- We did this before @IMPLEMENTATION_SUMMARY.md @IMPLEMENTATION_PHASES.md 
- This is what we run in ssh server@docker-compose.unified.yml 
- These are the present docker containers in digital ocean ssh:
root@ubuntu-s-4vcpu-8gb-sgp1-01:~/LTOBLOCKCHAIN# docker ps
CONTAINER ID   IMAGE                            COMMAND        
          CREATED          STATUS                    PORTS     


                    NAMES
17b60c3b0f66   ltoblockchain-lto-app            "dumb-init -- node s…"   23 minutes ago   Up 23 minutes (healthy)   3001/tcp  


                    lto-app
f2268513373e   vehicle-registration-cc:latest   "npx fabric-chaincod…"   47 minutes ago   Up 27 minutes             0.0.0.0:9999->9999/tcp, [::]:9999->9999/tcp

                    chaincode-vehicle-reg
5504ebc730bb   nginx:alpine                     "/docker-entrypoint.…"   18 hours ago     Up 27 minutes             0.0.0.0:80->80/tcp, [::]:80->80/tcp, 0.0.0.0:443->443/tcp, [::]:443->443/tcp
                    nginx
8001ac6ffe1f   hyperledger/fabric-tools:2.5     "/bin/bash"    
          18 hours ago     Up 27 minutes


                    cli
e160373ba792   hyperledger/fabric-peer:2.5      "peer node start"        18 hours ago     Up 27 minutes             7051/tcp, 
0.0.0.0:9051->9051/tcp, [::]:9051->9051/tcp

                    peer0.insurance.gov.ph
143d7fba9330   hyperledger/fabric-peer:2.5      "peer node start"        18 hours ago     Up 27 minutes             7051/tcp, 
0.0.0.0:8051->8051/tcp, [::]:8051->8051/tcp

                    peer0.hpg.gov.ph
f4f3a04220bf   hyperledger/fabric-peer:2.5      "peer node start"        18 hours ago     Up 27 minutes             0.0.0.0:7051->7051/tcp, [::]:7051->7051/tcp

                    peer0.lto.gov.ph
42d359b4c19a   hyperledger/fabric-orderer:2.5   "orderer"      
          18 hours ago     Up 27 minutes             0.0.0.0:7050->7050/tcp, [::]:7050->7050/tcp

                    orderer.lto.gov.ph
c89003fc117f   couchdb:3.2                      "tini -- /docker-ent…"   18 hours ago     Up 27 minutes (healthy)   4369/tcp, 
9100/tcp, 0.0.0.0:5984->5984/tcp, [::]:5984->5984/tcp

                    couchdb
bece9298292c   hyperledger/fabric-ca:1.5        "sh -c 'fabric-ca-se…"   18 hours ago     Up 27 minutes             0.0.0.0:7054->7054/tcp, [::]:7054->7054/tcp

                    ca-lto
9353723c326d   postgres:15-alpine               "docker-entrypoint.s…"   18 hours ago     Up 27 minutes (healthy)   0.0.0.0:5432->5432/tcp, [::]:5432->5432/tcp

                    postgres
1141054cfad4   hyperledger/fabric-ca:1.5        "sh -c 'fabric-ca-se…"   18 hours ago     Up 27 minutes             0.0.0.0:9054->7054/tcp, [::]:9054->7054/tcp

                    ca-insurance
67d721b54085   ipfs/kubo:latest                 "/bin/sh -c 'if [ ! …"   18 hours ago     Up 27 minutes (healthy)   0.0.0.0:4001->4001/tcp, [::]:4001->4001/tcp, 0.0.0.0:5001->5001/tcp, [::]:5001->5001/tcp, 4001/udp, 0.0.0.0:8080->8080/tcp, [::]:8080->8080/tcp, 8081/tcp   ipfs
fc3078c4676b   hyperledger/fabric-ca:1.5        "sh -c 'fabric-ca-se…"   18 hours ago     Up 27 minutes             0.0.0.0:8054->7054/tcp, [::]:8054->7054/tcp

                    ca-hpg

- We establish everything in digital ocean using this: @unified-setup.sh 
- We fixed some irregular stuff using this: @fix-endorsement-policy.sh 
- This is the full schema: @all%20schema.sql 
- This is the full data: @all%20data.sql 


Goal:
-  Create an implementation plan
- The plan must consist of phase by phase detailed implementation to achieve what is states inside @blockchain%20capstone.docx 
- Fabric must be the source of truth
- Fabric and postgres must properly work together
- Minted vehicles must be displaying in the lto admin:
<div class="card-body">
                                <div id="preMintedVehiclesLoading" style="text-align: center; padding: 2rem; display: block;">
                                    <i class="fas fa-spinner fa-spin" style="font-size: 2rem; color: #0284c7;"></i>
                                    <p>Loading pre-minted vehicles from Fabric...</p>
                                </div>
                                <div id="preMintedVehiclesTableContainer" style="display: none;">
                                    <table id="preMintedVehiclesTable" style="width: 100%; border-collapse: collapse;">
                                        <thead>
                                            <tr style="background: #f0f9ff; border-bottom: 2px solid #e0f2fe;">
                                                <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: #0c4a6e;">
                                                    VIN</th>
                                                <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: #0c4a6e;">
                                                    Make/Model</th>
                                                <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: #0c4a6e;">
                                                    Year</th>
                                                <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: #0c4a6e;">
                                                    Plate Number</th>
                                                <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: #0c4a6e;">
                                                    Status</th>
                                                <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: #0c4a6e;">
                                                    Minted Date</th>
                                                <th style="padding: 0.75rem; text-align: left; font-weight: 600; color: #0c4a6e;">
                                                    Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody id="preMintedVehiclesTableBody">
                                            <!-- Vehicle rows will be inserted here -->
                                        </tbody>
                                    </table>
                                    <div id="preMintedVehiclesEmpty" style="text-align: center; padding: 3rem; color: #64748b; display: none;">
                                        <i class="fas fa-inbox" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                                        <p style="font-size: 1.1rem;">No pre-minted vehicles found</p>
                                        <p style="font-size: 0.9rem; margin-top: 0.5rem;">Create a new pre-minted
                                            vehicle using the form above</p>
                                    </div>
                                </div>
                            </div>


- Implementation of correct session handling all throughout
- Implementation of 2FA for the org accounts which you can see the all schema and all data to know more but they should be the three:
admin@lto.gov.ph
insurance@insurance.gov.ph
hpg@hpg.gov.ph

We will use system email here @2FA_EMAIL_REQUIREMENTS.md . But since the other three are not real accounts and might be in conflict with existing one, codes must be send to their counterparts (this means creation of column if not existing to add the counterpart emails:
lto.lipaph@gmail.com
insurance.lipaph@gmail.com
hpg.lipaph@gmail.com


These two are connected:
- Reconfigure the frontend of @transfer-certificate-generator.html  @certificate-generator.html  to make sure they can easily be accessed with both clickable button in nav tab. They become a separate entity with admin but since they are related to admin identity for accessing certain features (LTOMSP an stuff since certificates become linked with either vehicles or owners) they are still regarded as admin. 
- When certificategenerator@generator.com account is accessed, it is redirected to @transfer-certificate-generator.html   @certificate-generator.html . They must be combined but properly separated in one. Do you get it? they have their own nav. Just trace it to know more.


--------
Additional information on current workflows which you should verify in both frontend, backend, and database:
Initial vehicle registration:
- Pre minted vehicle is necessary. This skips the dealership x LTO transaction because it is outside the scope of initial registration which concerns the vehicle owner and the initial registration flow in real world
- Pre minting vehicle generates csr and sales invoice which is send to ltolipablockchain@gmail.com
- Vehicle minted and the csr and sales invoice is in fabric and ipfs for documents with cid ofcourse. there is also an implementation of data/information extraction from pdf for auto verification when LTO receives initial vehicle regisration applications
- HPG clearance and CTPL are generated in certificate generator. We also skipped physical compliance and insurance x vehicle owner transactions since we just want to showcase the feasibility of a blockchain technology in LTO transactions. This generated ones are also then hashed and info is extracted. This is to be used for auto verification purposed later on when owner submits their documents. The user receives these documents by inputting their email and name. Since we have pre minted vehicles already, info in cert generation must now not be random. We can either submit the CSR to extract info and auto generate the CTPL and HPG clearance, or have a dropdown of the pre minted vehicles stored in fabric. Choose the easiest to implement. 
- Owner receives the certificates and submits them in their accounts. @registration-wizard.js  is used here.
- Once submitted the applicaiton, they should be prompted to a screenshot of payment. Only if the application actually went through and was submitted. (This is not yet implemented so look at @blockchain capstone.docx . This is just mock so submission of screenshot immediately goes okay is successful. Also, owner is notified OR is received through email later once registration is completed.
- Uploaded documents are auto sent and auto verified (CSR and CTPL and Sales Invoice)
- HPG has its own process @hpg-admin-dashboard.html @hpg-verification-form.html 
- LTO then oversees and can only approve once orgs already approved of their corresponding certs received.
- Recent Verification Responses, and Emission
 must be removed in organization verification tracker frontend and backend. Ensure proper UI implementation due to this.
- Inspection related things must be removed from initial registration related things and this must be done VERY CAREFULLY in order not to break existing codes and functionalities: @admin-dashboard.html 
- Since csr and sales invoice is verified through the pre minted vehicle workflow earlier, you can add some frontend implementation in the Application Details modal just to show CSR is auto validated.
- LTO then now can approve or reject. This also send notifications, and the ORCR to the owner through email.
- ORCR can still be downloaded through the owner account in view details. Trace it and look for download certificate button to know more.
Note:
Tell me if I missed out something,


Transfer of ownership workflow:
- Trace @transfer-certificate-generator.html 
- Seller initiates and submits sales invoice and owner id. ORCR is not prompted to be submitted cause the seller basically owns the vehicle already and is verified through fabric.
- Buyer receives transfer request. The buyer upload ctpl, hpg, tin id, and owner id and accepts transfer. MVIR is not prompted to be submitted since LTO must do it physically. The process for this is mentioned later.
- LTO receives. Documents are auto sent to their corresponding orgs.
- LTO sees whether the vehicle has been inspected and with date and name
- There is a vehicle inspection in @lto-inspection-form.html . Must be properly configured to support the auto verification that the vehicle for transfer has been inspected. Vehicle data are in fabric. When doing physical inspection, paper is used as form through inspection so there is an existing mvir upload document. There are fields and it is important a name and timestamp is also implemented. The problem is how to justify inspection is actually done for transfer? 
- LTO oversees. Certificates are verified. Transferred if accepted.

Transfer Approved:
- Fabric vehicle data is appended
- New owner of vehicle
- ORCR generation uses new owner
- Email notif is sent

Transfer Declined:
- Transaction fails. 
- Nothing noteworthy happened other than transactions are recorded.


Provide recommendations on unclear parts:
- Use of blockchain in terms of tracking, tracing vehicle owners, checking transactions. hashes/transaction id not fully shown, refinement of orcr desing style


Notes:
- Trace workflows to know more if lacking in context
- Pre minted vehicles should properly be showing in where they should be showing up
- Dropdown when choosing which vehicles to inspect must be using fabric
- Clean up postgres data other than accounts.
- Ask me about anything unclear


Clarifications from me to you:
- Reading the contexts, is fabric cleaned up?
- Is it possible to clean up postgres data other than accounts?




.env contents:
# ============================================
# TrustChain LTO - Production Environment Configuration
# ============================================
# DO NOT commit this file to version control
# Last Updated: 2026-01-29

# ============================================
# SERVER CONFIGURATION
# ============================================

NODE_ENV=production
PORT=3001
TRUST_PROXY=1
FRONTEND_URL=https://ltoblockchain.duckdns.org
APP_BASE_URL=https://ltoblockchain.duckdns.org

# ============================================
# SECURITY (REQUIRED - MUST CHANGE IN PRODUCTION)
# ============================================

# JWT Secret Key - Used for signing authentication tokens
# Generate a strong random string (minimum 32 characters)
# Example: openssl rand -base64 32
JWT_SECRET=wYQ9tBXifJUiRIWvpxgREzlFGcK52V6N0EiD0WjXcV0=

# JWT Token Expiry Times
JWT_ACCESS_EXPIRY=10m
JWT_REFRESH_EXPIRY=7d

# Encryption Key - Used for encrypting sensitive data
# Must be exactly 32 characters
# Example: openssl rand -base64 24 | head -c 32
ENCRYPTION_KEY=nwcjeT1goyw5G0OWQvPvdFmyBKEElhqo

# ============================================
# DATABASE CONFIGURATION
# ============================================

# PostgreSQL Database Configuration
# These can override docker-compose.unified.yml defaults
DB_HOST=postgres
DB_PORT=5432
DB_NAME=lto_blockchain
DB_USER=lto_user
POSTGRES_PASSWORD=lyd2PrWIgsN6/RaFWLCfR0+H

# CouchDB Configuration (for Fabric state database)
COUCHDB_PASSWORD=9+x1ECU/9cNYIciMYoYankxG

# ============================================
# BLOCKCHAIN CONFIGURATION (Hyperledger Fabric)
# ============================================

# Blockchain Mode
BLOCKCHAIN_MODE=fabric

# Fabric Network Configuration
FABRIC_NETWORK_CONFIG=./network-config.json
FABRIC_CHANNEL=ltochannel
FABRIC_CHAINCODE=vehicle-registration
FABRIC_AS_LOCALHOST=false

# ============================================
# STORAGE CONFIGURATION
# ============================================

# Storage Mode (ipfs or local)
STORAGE_MODE=ipfs
# IPFS Node Configuration
IPFS_HOST=ipfs
IPFS_PORT=5001
IPFS_PROTOCOL=http

# ============================================
# EMAIL CONFIGURATION (Gmail API OAuth2)
# ============================================

# Gmail Account Email Address
# The Gmail account that will send system emails
GMAIL_USER=ltolipablockchain@gmail.com

# Gmail API OAuth2 Credentials
# Create OAuth2 credentials in Google Cloud Console
# Scope: https://www.googleapis.com/auth/gmail.send
GMAIL_CLIENT_ID=57584307080-ktnjq0j5c4k13i19pk1dr1n58segdn08.apps.googleusercontent.com
GMAIL_CLIENT_SECRET=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
GMAIL_REFRESH_TOKEN=1//04S7SU5UozhRiCgYIARAAGAQSNwF-L9IrMejqtThuPbrv80DdrKJVLvL3BkoCoDkRofJiDo_EeEb5eH3H6>

# ============================================
# EMAIL VERIFICATION CONFIGURATION
# ============================================

# Email Verification Token Expiry Time
VERIFICATION_EMAIL_EXPIRY=24h
VERIFICATION_LINK_EXPIRY_HOURS=24

# Allow Unverified Login (set to false in production)
ALLOW_UNVERIFIED_LOGIN=false

# Scheduled Tasks (cleanup of expired tokens)
ENABLE_SCHEDULED_TASKS=true

# OCR CONFIGURATION
# ============================================

# Enable/disable OCR functionality
OCR_ENABLED=true

# Maximum number of PDF pages to process
OCR_MAX_PAGES=5

# Enable image preprocessing for better OCR accuracy
OCR_PREPROCESSING_ENABLED=true

# OCR timeout in milliseconds (30 seconds)
OCR_TIMEOUT=30000

# Tesseract language code
OCR_LANGUAGE=eng

# Temporary directory for PDF to image conversion
OCR_TEMP_DIR=./temp-ocr

# Cleanup temporary image files
OCR_CLEANUP_ON_SUCCESS=true
OCR_CLEANUP_ON_ERROR=true

# ============================================
# FEATURE FLAGS
# ============================================

# Emission feature (disabled)
EMISSION_FEATURE_ENABLED=false

# Auto-verification enabled
AUTO_VERIFICATION_ENABLED=true
AUTO_VERIFICATION_MIN_SCORE=90

# ============================================
# NOTES
# ============================================
#
# Email Address Updates (Database):
# - admin@lto.gov.ph → lto.lipaph@gmail.com
# - hpg@hpg.gov.ph → hpg.lipaph@gmail.com
# - insurance@hpg.gov.ph → insurance.lipaph@gmail.com
# - certificategenerator@generator.com (new account)
#
# These email addresses are stored in the PostgreSQL database,
# not in this .env file. Update them via SQL migration.
#
# ============================================
# GENERATING SECURE SECRETS
# ============================================
#
# Linux/Mac:
#   JWT_SECRET=$(openssl rand -base64 32)
#   ENCRYPTION_KEY=$(openssl rand -base64 24 | head -c 32)
#
# Windows PowerShell:
#   $jwtSecret = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | % {[char]$_})
#   $encryptionKey = -join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | % {[char]$_})        
#
# ============================================



BLOCKCHAIN_MODE=fabric





------------------------------------
PROCEED ONLY IF YOU UNDERSTAND
------------------------------------


