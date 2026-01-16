# OCR Auto-Fill System - Quick Reference

## 🚀 What Was Updated

### Backend: `ocrService.js`
Advanced regex patterns now extract ALL LTO vehicle information fields:
- **Identifiers:** vin, plateNumber, engineNumber, mvFileNumber
- **Descriptors:** make, series, bodyType, yearModel, color, fuelType  
- **Weights:** grossWeight, netCapacity

### Frontend: `registration-wizard.js`
Strict mapping logic auto-fills form fields from OCR response:
```javascript
const strictFieldMapping = {
    'vin': 'vin',
    'series': 'model',           // LTO series → HTML model
    'yearModel': 'year',         // LTO yearModel → HTML year
    'grossWeight': 'grossVehicleWeight',
    'netCapacity': 'netWeight',
    'bodyType': 'vehicleType',
    // ... and more
};
```

---

## 📋 Field Mapping Reference

| Backend Field | HTML Form ID | Example |
|---------------|-------------|---------|
| vin | vin | 1HGBH41JXMN123456 |
| engineNumber | engineNumber | 2NR-FE123456 |
| plateNumber | plateNumber | ABC-1234 |
| make | make | TOYOTA |
| series | **model** | Vios |
| yearModel | **year** | 2023 |
| color | color | WHITE |
| bodyType | **vehicleType** | SEDAN |
| fuelType | fuelType | GAS |
| grossWeight | **grossVehicleWeight** | 1500 |
| netCapacity | **netWeight** | 1200 |
| firstName | firstName | Juan |
| lastName | lastName | Dela Cruz |
| idNumber | idNumber | 123456789 |
| address | address | Manila |
| phone | phone | 09xxxxxxxxx |

**Bold fields** = LTO standard name differs from HTML ID

---

## 🔍 Regex Patterns Used

| Field | Pattern | Flags |
|-------|---------|-------|
| vin | `/\b(?![IOQ])[A-HJ-NPR-Z0-9]{17}\b/` | ISO Standard |
| plateNumber | `/\b([A-Z]{3}\s?\d{3,4}\|[A-Z]\s?\d{3}\s?[A-Z]{2})\b/i` | Case-insensitive |
| engineNumber | `/(?:Engine\|Motor)\s*No\.?[\s:.]*([A-Z0-9\-]+)/i` | Case-insensitive |
| make | `/(?:Make\|Brand)[\s:.]*([A-Z]+)/i` | Case-insensitive |
| series | `/(?:Series\|Model)[\s:.]*([A-Z0-9\s]+?)(?=\n\|Body)/i` | Case-insensitive |
| yearModel | `/(?:Year\|Model)[\s:.]*(\d{4})/` | 4-digit year |
| color | `/(?:Color)[\s:.]*([A-Z]+)/i` | Case-insensitive |
| fuelType | `/(?:Fuel\|Propulsion)[\s:.]*([A-Z]+)/i` | Case-insensitive |
| grossWeight | `/(?:Gross\s*Wt\.?)[\s:.]*(\d+)/i` | Case-insensitive |
| netCapacity | `/(?:Net\s*Cap\.?\|Net\s*Wt\.?)[\s:.]*(\d+)/i` | Case-insensitive |

---

## 🎯 How It Works

```
1. User uploads document (Registration Cert, Sales Invoice, CSR, etc.)
   ↓
2. Backend OCR extracts text
   ↓
3. Advanced regex patterns parse fields
   ↓
4. Returns JSON response with extracted fields
   ↓
5. Frontend receives response
   ↓
6. Strict mapping matches OCR fields → HTML IDs
   ↓
7. Auto-fills form fields
   ↓
8. Triggers change/input events for validation
   ↓
9. User sees pre-filled form ready to review
```

---

## ✅ Supported Document Types

- ✓ Certificate of Registration (OR/CR)
- ✓ Sales Invoice
- ✓ Certificate of Stock Report (CSR)
- ✓ HPG Clearance Certificate
- ✓ Owner Valid ID

---

## 🔧 Developer Notes

### Backend Response Format
```json
{
  "success": true,
  "extractedData": {
    "vin": "1HGBH41JXMN123456",
    "engineNumber": "2NR-FE123456",
    "plateNumber": "ABC-1234",
    "make": "TOYOTA",
    "series": "Vios",
    "yearModel": "2023",
    "color": "WHITE",
    "bodyType": "SEDAN",
    "fuelType": "GAS",
    "grossWeight": "1500",
    "netCapacity": "1200",
    "firstName": "Juan",
    "lastName": "Dela Cruz",
    "idType": "drivers-license",
    "idNumber": "D23-12-345678"
  }
}
```

### Frontend Auto-Fill Process
```javascript
// For each extracted field:
1. Check if value is not empty
2. Look up HTML element ID from mapping
3. Find element in DOM
4. Skip if already has value
5. Set field value
6. Add 'ocr-auto-filled' CSS class
7. Dispatch change + input events
```

### Debug Console Output
```javascript
[OCR AutoFill] Processing extracted data: {...}
[OCR AutoFill] Field filled: vin → vin = "1HGBH41JXMN123456"
[OCR AutoFill] Field filled: series → model = "Vios"
[OCR AutoFill] Field filled: yearModel → year = "2023"
[OCR AutoFill] Successfully auto-filled 12 field(s)
```

---

## ⚠️ Edge Cases Handled

✅ Empty/null values → Skipped  
✅ Already-filled fields → Not overwritten  
✅ Missing HTML elements → Gracefully skipped  
✅ Malformed OCR text → Partial extraction  
✅ Network errors → User sees manual entry option  
✅ Document image quality → Best-effort extraction  

---

## 📱 Testing Quick Commands

```javascript
// Test in browser console:

// 1. Check if mapping is correct
Object.keys(strictFieldMapping).length  // Should be 26+

// 2. Verify field auto-fill
document.getElementById('vin').value  // Should see value

// 3. Check CSS class
document.getElementById('vin').classList  // Should include 'ocr-auto-filled'

// 4. Monitor events
document.addEventListener('change', (e) => console.log('Change:', e.target.id))
```

---

## 🚀 Deployment Steps

1. **Backup current files**
   ```bash
   cp backend/services/ocrService.js backend/services/ocrService.js.backup
   cp js/registration-wizard.js js/registration-wizard.js.backup
   ```

2. **Deploy updated files**
   - Upload `ocrService.js` to backend
   - Upload `registration-wizard.js` to frontend

3. **Clear browser cache**
   - Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)

4. **Test with sample document**
   - Upload test registration certificate
   - Verify fields auto-fill correctly

5. **Monitor logs**
   - Check backend: `[OCR Debug]` logs
   - Check frontend: `[OCR AutoFill]` logs

---

## 📞 Support Reference

| Issue | Solution |
|-------|----------|
| Fields not auto-filling | Check browser console for mapping errors |
| Partial fields extracted | Document image quality may be poor |
| Events not triggering | Verify event listeners are attached |
| Old field names not working | Use new LTO standard field names |
| Form shows errors | Review extracted data in console |

---

## 📚 Documentation Files

- `OCR_AUTOFILL_UPDATE_SUMMARY.md` - Detailed technical documentation
- `OCR_IMPLEMENTATION_VERIFICATION.md` - Complete verification checklist
- This file - Quick reference guide

---

**Version:** 1.0  
**Last Updated:** January 16, 2026  
**Status:** ✅ Production Ready
