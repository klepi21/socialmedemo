# 🚀 SocialMe AI: Autonomous Sales Consultant Agent (Tech Demo)

> **⚠️ DISCLOSURE:** This is an **AI Technology Demonstration**. It showcases the potential of autonomous sales agents. For production environments, we highly recommend integrating **Premium AI Models** (like OpenAI o1/GPT-4o or specialized Anthropic models) for enhanced reasoning, accuracy, and handling complex business logic.

SocialMe AI is a cutting-edge, white-label platform designed for digital agencies to deploy autonomous AI sales consultants for their clients. It crawls any business website, "learns" its services, pricing, and contact information, and transforms into a high-converting chatbot that generates professional business proposals automatically.

![Status: Tech Demo](https://img.shields.io/badge/Status-Tech--Demo-blue?style=for-the-badge)
![Architecture: Hybrid](https://img.shields.io/badge/Architecture-Vercel--+--VPS-orange?style=for-the-badge)

---

## 🏗️ System Architecture

The project is split into two main components to balance high-speed UI delivery and heavy AI processing:

### 🎨 Frontend (Next.js - Vercel)
The user-facing application handles the dashboard, real-time chat interface, and lead management.
- **Next.js 15+ (App Router)**: Fast, serverless-ready frontend.
- **Tailwind CSS 4**: Premium glassmorphism design.
- **Voice Synthesis**: Integrated with **ElevenLabs** for zero-latency Greek speech.
- **Leads Center**: A dedicated dashboard for business owners to view captured leads and export proposals.
- **Proposal Engine**: Client-side PDF generation using `jsPDF` and `html2canvas`.

### ⚙️ Dedicated AI Backend (Node.js - VPS)
The "Heavy Lifting" engine designed to run persistantly on a dedicated server to handle resource-intensive tasks.
- **Custom Crawler**: Distributed crawler with Proxy support and browser-spoofing to bypass scraping blocks.
- **Vectorization Engine**: Local RAG system using `@xenova/transformers`.
- **Job Manager**: Handles long-running crawling and training tasks with PM2 process management.
- **IPv4 Logic**: Specialized network handling to resolve connectivity issues between VPS and legacy servers.

---

## 💻 Backend Server Requirements (Best Specs)

To run the local embedding models and high-speed crawling smoothly, the following specs are recommended for your VPS:

| Feature | Minimum (Demo) | Recommended (Pro) |
| :--- | :--- | :--- |
| **CPU** | 1 vCore | 2-4 vCores |
| **RAM** | 1GB (Requires OpenAI Fallback) | **4GB+** (To run Transformers.js locally) |
| **OS** | Ubuntu 22.04 LTS | Ubuntu 22.04 LTS |
| **Storage** | 10GB SSD | 20GB+ NVMe SSD |
| **Network** | Shared IPv4 | **Dedicated IPv4** (Critical for scraping) |

> **Note:** On 1GB RAM instances, the local vectorization model might experience high latency. In such cases, the system should be configured to use external embedding APIs (like OpenAI `text-embedding-3-small`).

---

## ✨ Key Features

- **🌐 Browser-Identity Scraper**: A specialized crawler that bypasses bot-detection to "read" any business website.
- **🧠 Hybrid RAG**: Flexible knowledge base that can run locally or via Cloud APIs.
- **🎙️ Voice-First Engagement**: Full speech-to-speech interaction for mobile-first users.
- **📊 Automatic Lead Proposing**: No more manual follow-ups. The AI extracts a lead's needs and creates a PDF proposal ready for the business owner.
- **⚖️ Legal/Contact Awareness**: Unlike generic bots, this agent focuses on exact contact data and verified service pricing.

---

## 🚀 Getting Started

### 1. Requirements
- Node.js 20+
- Turso Database (LibSQL)
- Groq API Key (Fast reasoning)
- ElevenLabs API Key (Premium Greek Voice)
- OpenAI API Key (For embedding fallback on low-end servers)

### 2. Environment Setup (VPS)
```env
BACKEND_PORT=3001
TURSO_DATABASE_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=your_token
OPENAI_API_KEY=sk-...
```

---

## 📄 License
MIT License. Created by the community, for the Digital Agency industry.
