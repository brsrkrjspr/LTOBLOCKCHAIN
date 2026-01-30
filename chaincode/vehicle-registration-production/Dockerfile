# Vehicle Registration Chaincode - runnable image (for CCAAS or local build)
# Uses official Fabric Node chaincode base so peer never has to run "docker build"
FROM hyperledger/fabric-nodeenv:2.5

WORKDIR /usr/local/src

# Copy package files first for better layer cache
COPY package.json package-lock.json* ./
RUN npm install --production --ignore-scripts

COPY . .

# Chaincode runs as server (CCAAS) or start (in-peer). Default server for CCAAS.
ENV CORE_CHAINCODE_ADDRESS=0.0.0.0:9999
EXPOSE 9999

# CORE_CHAINCODE_ID must be set at runtime after "peer lifecycle chaincode install"
ENTRYPOINT ["npx", "fabric-chaincode-node", "server"]
