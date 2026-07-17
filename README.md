# 🛒 GroceryVault — Inventory Manager

GroceryVault is a premium, feature-rich, offline-first Progressive Web Application (PWA) designed for grocery stores to manage and track their product inventory in real-time. It features a modern, responsive user interface with full dark mode support, seamless Firebase synchronization, and built-in barcode scanning.

## 🚀 Live Demo & Repository
- **GitHub Repository**: [https://github.com/itz-jainul/grocery-inventory-](https://github.com/itz-jainul/grocery-inventory-)

---

## ✨ Features

- **📊 Interactive Dashboard**
  - Real-time stock statistics (Total Products, In Stock, Low Stock, Total Value).
  - Dynamic category breakdown visualizer.
  - Recent activity feed and low-stock alerts warning list.

- **📦 Product & Inventory Management**
  - **Grid & List Views**: Toggle layouts for easy browsing.
  - **Smart Filtering & Sorting**: Filter by Category or Stock Status (In-stock, Low-stock, Out-of-stock). Sort by Name, Price, Quantity, or Date added.
  - **Quick Stock Adjustments**: Fast increment/decrement options directly from product cards (+/-1, +/-10, etc.).
  - **Bulk Actions**: Select multiple items to bulk delete or bulk export.

- **📷 Built-in Barcode Scanner**
  - Scan product barcodes in real-time using your device camera (powered by `html5-qrcode`).
  - Search or add products instantly by scanning.

- **📥 Data Export**
  - **Excel Export (.xlsx)**: Instantly generate detailed spreadsheet reports (powered by SheetJS).
  - **PDF Export (.pdf)**: Generate clean, print-ready PDF reports with formatted tables (powered by jsPDF).

- **🔐 Secure Firebase Integration**
  - Real-time cloud sync with Firebase Firestore.
  - User authentication with Google Sign-In.
  - Auto-saved product images linked to Firebase Storage.

- **📱 Offline-First (PWA)**
  - Fully installable on iOS, Android, and Desktop.
  - Works offline using service workers. Changes automatically sync to the cloud when internet connection is restored.
  - Visual status indicator when offline.

---

## 🛠️ Technology Stack

- **Frontend**: HTML5 (Semantic Structure), CSS3 (Modern Flexbox/Grid, Custom Variables, Transitions, Light/Dark themes)
- **Programming Language**: Vanilla JavaScript (ES6+)
- **Database & Sync**: Firebase Firestore (NoSQL cloud database)
- **Authentication**: Firebase Auth (Google Sign-In)
- **Asset Storage**: Firebase Storage (for product images)
- **Third-Party Libraries**:
  - [SheetJS (XLSX)](https://sheetjs.com/) — Excel exports
  - [jsPDF & AutoTable](https://github.com/parallax/jsPDF) — PDF report generation
  - [html5-qrcode](https://github.com/mebjas/html5-qrcode) — Device camera barcode scanner

---
## 📸 Screenshots
<img width="1920" height="984" alt="Screenshot 2026-07-16 070420" src="https://github.com/user-attachments/assets/6bc1f0d6-75c9-4b6b-8d65-c0b1bffef11b" />
<img width="1920" height="975" alt="Screenshot 2026-07-16 070654" src="https://github.com/user-attachments/assets/d714807d-12a9-414a-8720-d90057ca033c" />
<img width="1920" height="1020" alt="Screenshot 2026-07-16 070543" src="https://github.com/user-attachments/assets/477156ce-32e2-444c-8efc-ceda8be10fc5" />
<img width="1920" height="974" alt="Screenshot 2026-07-16 070905" src="https://github.com/user-attachments/assets/eabae532-7a19-4877-88ad-829450c6db07" />
<img width="1920" height="978" alt="Screenshot 2026-07-16 070836" src="https://github.com/user-attachments/assets/1ca3ec33-bb77-42a8-b838-7c5625e51a9b" />
<img width="1920" height="977" alt="Screenshot 2026-07-16 070733" src="https://github.com/user-attachments/assets/b98da8e0-fd40-49ef-92c5-8ba0d5f1e7a6" />






## 📦 Setup & Installation

To run this project locally:

1. **Clone the repository:**
   ```bash
   git clone https://github.com/itz-jainul/grocery-inventory-.git
   cd grocery-inventory-
   ```

2. **Firebase Configuration Setup:**
   Ensure you have a Firebase project set up. In `app.js`, configure your Firebase settings:
   ```javascript
   const firebaseConfig = {
       apiKey: "YOUR_API_KEY",
       authDomain: "YOUR_AUTH_DOMAIN",
       projectId: "YOUR_PROJECT_ID",
       storageBucket: "YOUR_STORAGE_BUCKET",
       messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
       appId: "YOUR_APP_ID"
   };
   ```

3. **Run Locally:**
   Since it utilizes Firebase and PWA service workers, serve the project using a local web server:
   - If using VS Code, use the **Live Server** extension.
   - Alternatively, use Python:
     ```bash
     python -m http.server 8000
     ```
     Then open `http://localhost:8000` in your browser.

---

## 📄 License
This project is licensed under the **MIT License**. Feel free to use, modify, and distribute it.
