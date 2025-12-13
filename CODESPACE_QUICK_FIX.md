# Quick Fix: Apply Schema in Codespace

Since the scripts aren't in Codespace yet, here's how to apply the schema directly:

## Option 1: Apply Schema Directly (Quickest)

```bash
# In Codespace terminal, run:
docker exec -i postgres psql -U lto_user -d lto_blockchain < database/add-transfer-ownership.sql
```

If the schema file doesn't exist in Codespace either, you can apply it manually:

```bash
# Create and apply the schema in one command
docker exec -i postgres psql -U lto_user -d lto_blockchain << 'EOF'
-- Create transfer_requests table
CREATE TABLE IF NOT EXISTS transfer_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    vehicle_id UUID REFERENCES vehicles(id) ON DELETE CASCADE NOT NULL,
    seller_id UUID REFERENCES users(id) NOT NULL,
    buyer_id UUID REFERENCES users(id),
    buyer_info JSONB,
    status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'REVIEWING', 'APPROVED', 'REJECTED', 'COMPLETED', 'FORWARDED_TO_HPG')),
    submitted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMP,
    rejection_reason TEXT,
    forwarded_to_hpg BOOLEAN DEFAULT false,
    hpg_clearance_request_id UUID REFERENCES clearance_requests(id),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_transfer_vehicle ON transfer_requests(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_transfer_seller ON transfer_requests(seller_id);
CREATE INDEX IF NOT EXISTS idx_transfer_buyer ON transfer_requests(buyer_id);
CREATE INDEX IF NOT EXISTS idx_transfer_status ON transfer_requests(status);

-- Create transfer_documents table
CREATE TABLE IF NOT EXISTS transfer_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transfer_request_id UUID REFERENCES transfer_requests(id) ON DELETE CASCADE NOT NULL,
    document_type VARCHAR(30) NOT NULL CHECK (document_type IN ('deed_of_sale', 'seller_id', 'buyer_id', 'or_cr', 'emission_cert', 'insurance_cert', 'other')),
    document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
    uploaded_by UUID REFERENCES users(id) NOT NULL,
    uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_transfer_docs_request ON transfer_documents(transfer_request_id);
CREATE INDEX IF NOT EXISTS idx_transfer_docs_type ON transfer_documents(document_type);

-- Create transfer_verifications table
CREATE TABLE IF NOT EXISTS transfer_verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transfer_request_id UUID REFERENCES transfer_requests(id) ON DELETE CASCADE NOT NULL,
    document_id UUID REFERENCES documents(id) ON DELETE SET NULL,
    verified_by UUID REFERENCES users(id) NOT NULL,
    status VARCHAR(20) NOT NULL CHECK (status IN ('APPROVED', 'REJECTED', 'PENDING')),
    notes TEXT,
    checklist JSONB DEFAULT '{}',
    flagged BOOLEAN DEFAULT false,
    verified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_transfer_verif_request ON transfer_verifications(transfer_request_id);
CREATE INDEX IF NOT EXISTS idx_transfer_verif_document ON transfer_verifications(document_id);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_transfer_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER IF NOT EXISTS trigger_update_transfer_requests_updated_at
BEFORE UPDATE ON transfer_requests
FOR EACH ROW
EXECUTE FUNCTION update_transfer_requests_updated_at();
EOF

# Verify tables were created
docker exec postgres psql -U lto_user -d lto_blockchain -c "\dt transfer*"
```

## Option 2: Pull Latest Changes

If the files are in the repo, pull them:

```bash
git pull origin main
# Then run the scripts
bash scripts/apply-transfer-schema.sh
```

## Option 3: Test APIs Manually

Once schema is applied, test the APIs:

```bash
# Login and get token
TOKEN=$(curl -s -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@lto.gov.ph","password":"admin123"}' | \
  grep -o '"token":"[^"]*' | cut -d'"' -f4)

# Test admin stats
curl -X GET http://localhost:3001/api/admin/stats \
  -H "Authorization: Bearer $TOKEN" | jq

# Test transfer requests
curl -X GET http://localhost:3001/api/vehicles/transfer/requests \
  -H "Authorization: Bearer $TOKEN" | jq
```

