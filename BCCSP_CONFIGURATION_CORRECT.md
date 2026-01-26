# Correct BCCSP Configuration for core.yaml

**Issue:** Empty `FileKeyStore.KeyStore:` values are incorrect

---

## ✅ **Correct Minimal BCCSP Configuration**

For Hyperledger Fabric 2.5, the minimal BCCSP configuration should **NOT** include empty `FileKeyStore` values:

```yaml
peer:
  BCCSP:
    Default: SW
    SW:
      Hash: SHA2
      Security: 256
```

**Note:** `FileKeyStore` section is **optional** and can be omitted. Fabric will use default keystore location.

---

## ❌ **Incorrect Configuration (Empty Values)**

```yaml
peer:
  BCCSP:
    Default: SW
    SW:
      Hash: SHA2
      Security: 256
      FileKeyStore:        # ← This section is optional
        KeyStore:          # ← Empty value causes issues
```

**Problem:** Empty `KeyStore:` value can cause YAML parsing errors or configuration issues.

---

## ✅ **If FileKeyStore is Needed**

If you need to specify a custom keystore path, use a proper path value:

```yaml
peer:
  BCCSP:
    Default: SW
    SW:
      Hash: SHA2
      Security: 256
      FileKeyStore:
        KeyStore: /var/hyperledger/production/msp/keystore
```

**But for minimal config, omit FileKeyStore entirely.**

---

## 📋 **Complete Correct core.yaml**

```yaml
chaincode:
  mode: dev

handlers:
  endorsers:
    escc:
      name: DefaultEndorsement
  validators:
    vscc:
      name: DefaultValidation

discovery:
  enabled: true
  authCacheEnabled: true
  authCacheMaxSize: 1000
  authCachePurgeRetentionRatio: 0.75
  orgMembersAllowedAccess: false

peer:
  BCCSP:
    Default: SW
    SW:
      Hash: SHA2
      Security: 256

metrics:
  provider: disabled
```

---

## 🔧 **Quick Fix Command**

```bash
cd ~/LTOBLOCKCHAIN

cat > fabric-network/config/core.yaml << 'EOF'
chaincode:
  mode: dev

handlers:
  endorsers:
    escc:
      name: DefaultEndorsement
  validators:
    vscc:
      name: DefaultValidation

discovery:
  enabled: true
  authCacheEnabled: true
  authCacheMaxSize: 1000
  authCachePurgeRetentionRatio: 0.75
  orgMembersAllowedAccess: false

peer:
  BCCSP:
    Default: SW
    SW:
      Hash: SHA2
      Security: 256

metrics:
  provider: disabled
EOF
```

---

## 🎓 **Key Points**

1. **FileKeyStore is optional** - Can be omitted for minimal config
2. **Empty values are invalid** - Don't use `KeyStore:` with no value
3. **Default keystore location** - Fabric uses `/var/hyperledger/production/msp/keystore` by default
4. **Minimal config works** - Just `Default: SW`, `Hash: SHA2`, `Security: 256` is sufficient

---

**Summary:** Remove `FileKeyStore` section entirely from minimal BCCSP configuration.
