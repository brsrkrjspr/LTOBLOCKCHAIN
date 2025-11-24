-- Add IPFS CID column to documents table
-- Run this migration to add IPFS support

ALTER TABLE documents ADD COLUMN IF NOT EXISTS ipfs_cid VARCHAR(255);

-- Create index for faster IPFS CID lookups
CREATE INDEX IF NOT EXISTS idx_documents_ipfs_cid ON documents(ipfs_cid);

-- Add comment
COMMENT ON COLUMN documents.ipfs_cid IS 'IPFS Content Identifier (CID) for documents stored on IPFS';

