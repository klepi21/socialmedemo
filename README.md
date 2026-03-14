# 🚀 SocialMe AI: Autonomous Sales Consultant Agent

SocialMe AI is a cutting-edge, white-label platform designed for digital agencies to deploy autonomous AI sales consultants for their clients. It crawls any business website, "learns" its services, pricing, and contact information, and transforms into a high-converting chatbot that can generate professional business proposals in PDF format.

![Status: Production Ready](https://img.shields.io/badge/Status-Production--Ready-green?style=for-the-badge)
![Next.js](https://img.shields.io/badge/Next.js-15%2B-black?style=for-the-badge&logo=next.js)
![Turso](https://img.shields.io/badge/Database-Turso%20(SQLite)-000?style=for-the-badge&logo=sqlite)

---

## ✨ Key Features

- **🌐 Instant Web Knowledge**: Provide a URL, and our custom crawler (Axios/Cheerio) will deep-scan the site, extracting text, contact info (Ld+JSON), and quick actions.
- **🧠 Local Server Embeddings**: Uses `@xenova/transformers` (MiniLM-L6-v2) to generate vector embeddings locally on the server—no high-cost third-party embedding APIs needed.
- **💬 AI Sales Consultant**: A premium, voice-enabled chat interface that uses **Groq (Qwen-3)** for ultra-low latency, human-like sales conversations.
- **📊 Lead Analysis & PDF Proposing**: The AI automatically detects when a lead is "hot," extracts contact details, and compiles a professional Greek-language business proposal (PDF) using `jsPDF`.
- **🎙️ Reassuring Voice (TTS)**: Integrated with **ElevenLabs** for zero-latency, mature, and professional Greek speech synthesis.
- **🛡️ Secure Training Dashboard**: A sleek, dark-mode agency dashboard to manage multiple clients, sync knowledge bases, and monitor training progress.

---

## 🛠️ The Tech Stack

### Frontend & Core
- **Next.js 15+**: App Router for server-side rendering and API routes.
- **React 19**: Utilizing Concurrent Mode and Server Components.
- **Tailwind CSS 4**: Modern, premium styling with glassmorphism effects.
- **Lucide React**: High-quality iconography.

### Database & Storage
- **Turso (LibSQL)**: Distributed SQLite for edge-ready performance and near-zero latency.
- **Vector Search**: Manual Cosine Similarity implementation for RAG (Retrieval-Augmented Generation).

### AI & Machine Learning
- **Groq API**: Powering the chat logic with the latest `qwen/qwen3-32b` model for blazing fast responses.
- **Transformers.js**: Running ONNX models on the server for local vectorization.
- **ElevenLabs API**: Premium Text-to-Speech for the AI Consultant's voice.

### Scraping & RAG
- **Custom Crawler**: Built with `Axios` and `Cheerio` to bypass heavy JS requirements and extract meaningful data from any domain.
- **jsPDF / html2canvas**: For client-side generation of beautiful business proposals.

---

## 🚀 Getting Started

### 1. Requirements
- Node.js 20+
- A Turso Database (get a free one at [turso.tech](https://turso.tech))
- Groq API Key
- ElevenLabs API Key

### 2. Installation
```bash
git clone https://github.com/klepi21/socialmedemo.git
cd socialme
npm install
```

### 3. Environment Variables
Create a `.env.local` file:
```env
# Database
TURSO_DATABASE_URL=libsql://your-db-name.turso.io
TURSO_AUTH_TOKEN=your_token

# AI APIs
GROQ_API_KEY=your_groq_key
ELEVENLABS_API_KEY=your_elevenlabs_key
ELEVENLABS_VOICE_ID=EXAVITQu4vr4xnSDxMaL

# App Settings
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 4. Run Locally
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) to see your Agency Dashboard.

---

## 📖 How to Use

1. **Create a Project**: Add your client's name and a brief description.
2. **Add Knowledge**: Paste the client's website URL (e.g., `https://example.com`).
3. **Sync Knowledge**: Click the **Sync** button. The crawler will visit the site, and the AI will vectorize the content for its "brain."
4. **Launch AI**: Once training is complete, the "Launch AI Consultant" button will activate.
5. **Chat & Generate**: Chat with the agent. Once it collects the client's name and email, it will offer a "Complete & Generate PDF" option to close the lead.

---

## 📄 License
MIT License. Created with ❤️ for the Digital Agency community.
