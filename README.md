# Car Deals Manager (v6)

A self-contained Windows desktop application for tracking car dealership purchases, repairs/expenses, installment payments, printable buying/sale receipts, profit reports, and automatic backups. Built with **Electron + React + TypeScript + SQLite** — works 100% offline with zero external servers.

## What's New in v6

1. **Payments & Installment Tracking (`Payments` button on every car)**
   - Record **Advance / Bayana**, **Installments**, **Token**, and **Final Balance** payments both **Paid to Seller** and **Received from Buyer** (Cash, Bank Transfer, Cheque, Online/JazzCash/EasyPaisa).
   - Live balance-due calculation in the table (`Paid in full` / `Due: Rs ...` and `Received in full` / `Due: Rs ...`) plus a one-click *"Fill remaining balance"* shortcut.
2. **Printable Buying Slip & Sale Receipt PDF (`Receipt` button on every car)**
   - Generates a formatted A4 **Vehicle Purchase / Buying Slip** or **Vehicle Sale Receipt & Delivery Note** with live preview and one-click PDF export.
   - Automatically includes vehicle details (Make, Model, Variant, Year, Color, Reg #, **Engine #**, **Chassis #**, Mileage), party **CNIC**, **Address**, **Amount in Words**, recorded payment schedule, customizable showroom letterhead, witness signature lines, and thumb-impression blocks.
3. **Profit & Inventory Reports (`Reports & Profit` tab)**
   - Filterable by sale date range (`This Month`, `Last 30 Days`, `This Year`, `All Time`, or custom dates).
   - Shows **All-Time Net Profit**, **Profit by Month**, **Money Tied Up in Unsold Cars**, **Payable on Unsold Stock**, and **Best-Selling Makes**.
4. **Automatic Daily Backups & One-Click Restore (`Backup & Restore`)**
   - Automatically saves a timestamped `.db` backup into `Documents\Car Deals Manager Backups` whenever the app closes (retaining the last 10 backups).
   - Restore from any backup directly inside the app (automatically saves a safety snapshot of your current database before restoring).
5. **Soft Delete & Recycle Bin (`Recycle Bin`)**
   - Deleting a car moves it to the **Recycle Bin** with an instant **Undo** toast, instead of erasing it permanently. Restore any deleted car or empty the bin permanently when ready.
6. **Optional App PIN Lock (`PIN Lock`)**
   - Protect customer CNICs, phone numbers, and financial figures with a 4–8 digit PIN on startup, plus a **Lock Now** button in the top bar.

## Build & Run (Windows)

```bash
npm install
npm run dist:win
```

The standalone installer and unpacked desktop executable are created in `release/`.
