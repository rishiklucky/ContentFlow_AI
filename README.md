# ContentFlow AI

> **AI-Powered Multi-Modal Content Transformation Platform** with Factual Source Grounding & Integrity Auditing.

ContentFlow AI ingests complex source documents (PDFs, Word documents, research papers, earnings reports, web articles) and transforms them into customized multi-modal communication dossiers (Executive Briefings, LinkedIn Thought Leadership, Twitter/X Threads, Institutional Advisories, Slide Decks with Speaker Notes, Infographic Blueprints, and Video Storyboards) while enforcing verifiable factual consistency.

---

## 1. Key Platform Features

- **Multi-Modal Document Ingestion**: Ingests pasted text, public web URLs (with SSRF protection), and file uploads (.pdf, .docx, .txt, .png, .jpg) with automated text extraction and OCR.
- **Structured Source Understanding**: Extracts key entities, chronological events, quantitative metrics, and claims before generation begins.
- **7 Specialized Communication Formats**:
  1. *Executive Summary*: Dense, high-impact C-Suite briefing.
  2. *LinkedIn Thought Leadership*: Professional narrative dispatch with actionable insights.
  3. *Twitter / X Thread Wire*: Numbered tweet sequence enforcing strict 280-character constraints.
  4. *Institutional Advisory*: Board-level directive memo with risks and strategic recommendations.
  5. *Presentation Deck*: Slide-by-slide structure with visual layout directives and verbatim speaker notes.
  6. *Infographic Blueprint*: Section directives, visual metaphors, and focal statistics.
  7. *Video Storyboard*: Production grid with scene timecodes, camera directions, and voiceover script.
- **Two-Tiered Fact Grounding & Verification**:
  - *Deterministic Layer*: Flags altered numerical figures, dates, and currency values.
  - *Semantic Verification*: Google Gemini audits every claim into `supported`, `partially_supported`, `unsupported`, or `contradicts_source`.
- **Project & Generation History**: Organize transformations into workspaces, search, rename, duplicate, and delete with ownership protection.
- **Multi-Format Export Engine**: One-click Clipboard Copy, Markdown (`.md`), Plain Text (`.txt`), Word (`.docx`), JSON Data (`.json`), and Batch (`.zip`) archives.
- **Single-Service Render Deployment**: Unified React SPA and FastAPI backend served on a single URL with Render free-tier cold-start handling.

---

## 2. Technology Stack

- **Frontend**: React.js 18, Vite, Bootstrap 5, Custom CSS ("Kinetic Ledger" Stitch design system), React Router, Axios, Lucide React.
- **Backend**: Python 3.10+, FastAPI, Uvicorn, Pydantic v2, PyMuPDF, python-docx, Tesseract OCR, Pillow.
- **Database**: Neon Serverless PostgreSQL with SQLAlchemy 2.0 ORM and Alembic migrations.
- **AI Models**: Google Gemini API with priority capacity fallback chain (`gemini-3.8-flash` down to `gemini-3.5-flash-lite`).
- **Deployment**: Render Web Service (Single-Service unified architecture).

---

## 3. Single-Service Deployment on Render

ContentFlow AI runs as **one unified Render Web Service**, serving both the production React SPA and the FastAPI API from a single public domain.

### Render Setup:
1. Connect your GitHub repository to [Render](https://render.com).
2. Create a new **Web Service** or use the included [`render.yaml`](render.yaml) blueprint:
   - **Environment**: `Python`
   - **Build Command**: `chmod +x build.sh && ./build.sh`
   - **Start Command**: `cd backend && uvicorn app.main:app --host 0.0.0.0 --port $PORT`
3. Configure the following environment variables in Render Dashboard:
   - `DATABASE_URL`: Your Neon PostgreSQL connection string (`postgresql://neondb_owner:...@...neon.tech/neondb?sslmode=require`).
   - `GEMINI_API_KEY`: Your Google AI Studio API key.
   - `SECRET_KEY`: A secure 32-byte secret string for JWT authentication.
   - `ENVIRONMENT`: `production`
   - `DEBUG`: `False`

### Automated Build Pipeline (`build.sh`):
1. Installs frontend dependencies and runs `npm run build` (outputs to `frontend/dist`).
2. Installs backend Python dependencies from `requirements.txt`.
3. Runs database migrations via `alembic upgrade head`.

---

## 4. Free-Tier Cold-Start Handling

Render free-tier instances sleep after 15 minutes of inactivity. When a user arrives at a sleeping instance:
1. The frontend checks the lightweight `/api/health` endpoint (which returns in under 15ms and does not invoke expensive AI models).
2. If the backend is spinning up, the user sees a transparent status screen: **"Waking up ContentFlow AI"** with an elapsed timer and automated backoff retries.
3. Once the server responds, the application transitions smoothly into the workspace without requiring full page refreshes.

---

## 5. Local Development Setup

### Backend:
```bash
cd backend
python -m venv venv
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt
cp .env.example .env
# Fill in your DATABASE_URL and GEMINI_API_KEY in .env

# Apply database migrations
alembic upgrade head

# Start development server
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

### Frontend:
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## 6. Testing

### Run All Backend Automated Tests:
```bash
cd backend
python -m pytest tests/ -v
```

### Run Frontend Production Build Check:
```bash
cd frontend
npm run build
```

---

## 7. Documentation Index

- [Architecture & Deployment Guide](docs/architecture.md)
- [REST API Reference](docs/api.md)
- [Testing & Verification Guide](docs/testing.md)
- [Technical Presentation Outline (5 Slides)](docs/presentation_outline.md)
- [Two-Minute Demo Script](docs/demo_plan.md)
- [Future Export Enhancements Roadmap](Future_Enhancements/EXPORT_ENHANCEMENTS.md)

---

## 8. Known Limitations & Roadmap

- **External Object Storage**: File uploads currently process in-memory or temporary storage for text extraction. Permanent file persistence across cold restarts requires configuring AWS S3 or Cloudflare R2 object storage.
- **Native PDF & PPTX Generation**: Markdown, TXT, DOCX, and ZIP exports are fully functional. Direct vector PDF generation (via WeasyPrint) and PowerPoint deck downloads (`.pptx`) are documented in the [Future Export Enhancements Roadmap](Future_Enhancements/EXPORT_ENHANCEMENTS.md).
- **Retrieval-Augmented Generation (RAG)**: ChromaDB vector retrieval for massive multi-document corpora is planned as a future scaling feature.
