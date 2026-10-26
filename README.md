# ContentFlow AI

> **AI-Powered Multi-Modal Content Transformation Platform** with Uncompromising Source Grounding & Fact Verification.

---

## 1. Overview & Architecture

ContentFlow AI ingests complex source documents (PDFs, reports, earnings transcripts, whitepapers) and transforms them into customized multi-modal communication dossiers (Executive Briefings, LinkedIn Dispatches, Analyst Threads, Advisory Memos, Board Decks) while enforcing strict factual consistency and verifiable source grounding.

- **Frontend**: React.js, Vite, Bootstrap 5, Custom CSS (Stitch "Kinetic Ledger" inspired design system), React Router, Axios, Lucide React.
- **Backend**: Python 3.10+, FastAPI, Uvicorn, Pydantic v2, Pydantic-Settings.
- **Database & Migrations**: Neon PostgreSQL, SQLAlchemy 2.x, Alembic (Configured for Phase 2).
- **AI Engine**: Google Gemini API with supported SDK (Configured for Phase 3).

---

## 2. Local Setup & Installation

### Prerequisites
- Node.js (v18+ or v24+) & `npm`
- Python 3.10+ & `pip`

---

### Backend Setup

1. **Navigate to the backend directory:**
   ```bash
   cd backend
   ```

2. **(Optional) Create and activate a virtual environment:**
   ```bash
   python -m venv venv
   # On Windows:
   venv\Scripts\activate
   # On macOS/Linux:
   source venv/bin/activate
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure environment:**
   ```bash
   cp .env.example .env
   ```

5. **Run the backend development server:**
   ```bash
   python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
   ```

6. **Verify backend endpoints:**
   - Health Check: `http://127.0.0.1:8000/api/v1/health`
   - Interactive Docs: `http://127.0.0.1:8000/api/v1/docs`

---

### Frontend Setup

1. **Navigate to the frontend directory:**
   ```bash
   cd frontend
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment:**
   ```bash
   cp .env.example .env
   ```

4. **Run the frontend development server:**
   ```bash
   npm run dev
   ```
   Open `http://127.0.0.1:5173` in your browser.

5. **Build for production:**
   ```bash
   npm run build
   ```

---

## 3. Testing & Verification

### Run Backend Health Tests
```bash
python backend/tests/test_health.py
```

### Run Frontend Production Build Check
```bash
cd frontend && npm run build
```

---

## 4. Repository Structure

```
ContentFlow_AI/
├── .gitignore
├── README.md
├── project_rules.md
├── common_instructions.txt
├── backend/
│   ├── .env.example
│   ├── requirements.txt
│   ├── app/
│   │   ├── main.py
│   │   ├── core/
│   │   │   └── config.py
│   │   ├── schemas/
│   │   │   ├── health.py
│   │   │   ├── transformation.py
│   │   │   └── project.py
│   │   └── api/
│   │       └── v1/
│   │           ├── router.py
│   │           └── endpoints/
│   │               ├── health.py
│   │               ├── transformations.py
│   │               └── projects.py
│   └── tests/
│       └── test_health.py
└── frontend/
    ├── .env.example
    ├── package.json
    ├── vite.config.js
    ├── index.html
    └── src/
        ├── App.jsx
        ├── main.jsx
        ├── services/
        │   └── api.js
        ├── styles/
        │   ├── variables.css
        │   ├── design-system.css
        │   └── main.css
        ├── components/
        │   ├── common/
        │   │   ├── Button.jsx
        │   │   ├── Badge.jsx
        │   │   ├── StatBox.jsx
        │   │   ├── EmptyState.jsx
        │   │   └── Pane.jsx
        │   └── layout/
        │       ├── AppShell.jsx
        │       ├── Header.jsx
        │       ├── Sidebar.jsx
        │       ├── MobileSidebar.jsx
        │       ├── TelemetryRuler.jsx
        │       └── Footer.jsx
        └── pages/
            ├── LandingPage.jsx
            ├── DashboardPage.jsx
            ├── NewTransformationPage.jsx
            ├── ProjectsPage.jsx
            ├── HistoryPage.jsx
            ├── SettingsPage.jsx
            └── NotFoundPage.jsx
```
