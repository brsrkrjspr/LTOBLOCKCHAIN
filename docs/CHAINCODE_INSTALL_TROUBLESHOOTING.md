# Chaincode Install Troubleshooting

## Problem summary

1. **"npm: not found"** — The peer uses `fabric-ccenv` as the chaincode **builder** image; that image does not include Node/npm. Node.js chaincode build needs npm.
2. **"FROM requires either one or three arguments"** — The peer generates a Dockerfile for the build; if builder image variables are missing or wrong, the `FROM` line can be malformed (e.g. two arguments instead of one).

## Fixes applied in this repo

### 1. Node-capable builder image

- **Script:** `scripts/fix-node-chaincode-build.sh`
- Pulls `hyperledger/fabric-nodeenv:2.5` (has Node.js and npm) and tags it as:
  - `hyperledger/fabric-ccenv:amd64-v2.5.0`
  - `hyperledger/fabric-ccenv:2.5`
- Run on the **host** (where Docker runs), then run `scripts/quick-fix-install-chaincode.sh`.

### 2. Peer env vars for builder image

- **File:** `docker-compose.unified.yml`
- All peers (LTO, HPG, Insurance) have:
  - `DOCKER_NS=hyperledger`
  - `TWO_DIGIT_VERSION=2.5`
- So the peer’s generated Dockerfile gets a single `FROM` image like `hyperledger/fabric-ccenv:2.5` and the image exists (from step 1).

### 3. Order of operations on the server

1. Apply the compose changes and **restart peers** so they get the new env vars:
   ```bash
   docker compose -f docker-compose.unified.yml up -d peer0.lto.gov.ph peer0.hpg.gov.ph peer0.insurance.gov.ph
   ```
2. Run the node builder fix (on host):
   ```bash
   bash scripts/fix-node-chaincode-build.sh
   ```
3. Install chaincode:
   ```bash
   bash scripts/quick-fix-install-chaincode.sh
   ```

## If install still fails: "FROM requires either one or three arguments"

Possible causes:

- Peer is using a different tag (e.g. from a custom `core.yaml`). Ensure the host has both tags:
  ```bash
  docker tag hyperledger/fabric-ccenv:2.5 hyperledger/fabric-ccenv:amd64-v2.5.0
  # or the reverse, depending on what you pulled
  ```
- A custom `fabric-network/config/core.yaml` overrides chaincode builder. Use a **literal** value with no variables, e.g. `builder: hyperledger/fabric-ccenv:2.5`, so the generated Dockerfile has exactly one argument after `FROM`.

## Fallback: Chaincode as a Service (CCAAS)

If the peer’s Docker build keeps failing, you can avoid it by running chaincode as an external service and installing a CCAAS package (metadata + `connection.json`), so the peer does not run `docker build`. See:

- [Fabric: Running Chaincode as an External Service](https://hyperledger-fabric.readthedocs.io/en/release-2.5/cc_service.html)
- [fabric-samples CHAINCODE_AS_A_SERVICE_TUTORIAL.md](https://github.com/hyperledger/fabric-samples/blob/main/test-network/CHAINCODE_AS_A_SERVICE_TUTORIAL.md)

High level:

1. Build your Node chaincode into a Docker image (Dockerfile with `FROM hyperledger/fabric-nodeenv:2.5`, COPY, RUN npm install, etc.).
2. Run that image as a service (e.g. in the same compose network) and expose the chaincode port.
3. Package chaincode as type CCAAS (metadata.json + connection.json pointing at that service).
4. Install that package with `peer lifecycle chaincode install <package>.tar.gz` and approve/commit as usual.

Then the peer never builds the image; it only connects to your running chaincode container.
