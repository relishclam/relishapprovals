# Tally Export Feature — Setup Assessment

## How Tally Import Works

Tally does **not** import Excel. Its native import format is **XML** (Tally XML format).  
You import it in Tally via:

> **Gateway of Tally → Import Data → Vouchers → select the `.xml` file**

---

## One-Time Configuration Required

Before the Tally XML export can be generated, the following must be confirmed.  
**All names must match exactly what appears in your Tally company.**

---

### 1. Tally Company Name

The exact name of your company as registered in Tally.

| Field | Value Needed |
|---|---|
| Tally Company Name | e.g., `Relish Food Pvt Ltd` |

---

### 2. Payment Mode → Tally Ledger Mapping

Each payment mode used in the app must map to a Bank/Cash ledger in Tally.

| App Payment Mode | Tally Ledger Name (your Tally) |
|---|---|
| Cash | e.g., `Cash` |
| UPI | e.g., `Canara Bank - UPI` |
| NEFT | e.g., `HDFC Bank A/c No. 1234` |
| Cheque | e.g., `HDFC Bank A/c No. 1234` |

---

### 3. Head of Account → Tally Ledger Mapping

Your app's **Heads of Account** must either:

- **Match exactly** the Ledger/Group names in your Tally company, **OR**
- A mapping table needs to be built (App name → Tally ledger name)

> **Action:** Provide a list of your Heads of Account from the app and the corresponding Ledger names in Tally.

---

## What Will Be Built

| Feature | Status |
|---|---|
| "Download for Tally (XML)" button with date range selector | ✅ Ready to build |
| Folder / Save-As location picker (browser File System API) | ✅ Ready to build |
| One-time Tally config screen (company name + ledger mappings) | ✅ Ready to build |
| Single `.xml` file containing all vouchers in the selected range | ✅ Ready to build |
| Deductions handled correctly (net amount sent to Tally) | ✅ Ready to build |

---

## Sample Tally XML Structure (Payment Voucher)

```xml
<ENVELOPE>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>Vouchers</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY>Your Tally Company Name</SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE>
          <VOUCHER VCHTYPE="Payment" ACTION="Create">
            <DATE>20260502</DATE>
            <VOUCHERNUMBER>VCH-0001</VOUCHERNUMBER>
            <NARRATION>Payment to XYZ for services</NARRATION>
            <ALLLEDGERENTRIES.LIST>
              <!-- Credit side: the bank/cash account being paid from -->
              <LEDGERNAME>Cash</LEDGERNAME>
              <ISDEEMEDPOSITIVE>No</ISDEEMEDPOSITIVE>
              <AMOUNT>-5000</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
            <ALLLEDGERENTRIES.LIST>
              <!-- Debit side: the expense / head of account -->
              <LEDGERNAME>Office Expenses</LEDGERNAME>
              <ISDEEMEDPOSITIVE>Yes</ISDEEMEDPOSITIVE>
              <AMOUNT>5000</AMOUNT>
            </ALLLEDGERENTRIES.LIST>
          </VOUCHER>
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>
```

---

## Next Steps

1. **Provide** your Tally Company Name  
2. **Provide** the Tally ledger names for each payment mode (Cash, UPI, NEFT, Cheque)  
3. **Confirm** whether your app's Heads of Account names match Tally ledger names, or provide the mapping  

Once the above are confirmed, the full "Download for Tally" feature can be implemented.
