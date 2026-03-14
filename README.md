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

## 🔑 Environment Variables

The project requires several keys for AI and Database services. **Groq** handles the blazingly fast reasoning using the **Qwen-3** model, while **ElevenLabs** provides the premium Greek voice.

### Frontend (.env.local - Vercel)
| Variable | Description |
| :--- | :--- |
| `TURSO_DATABASE_URL` | Your Turso DB URL (`libsql://...`) |
| `TURSO_AUTH_TOKEN` | Turso Auth Token |
| `GROQ_API_KEY` | **Groq API Key** (Used for Qwen-3 chat & analysis) |
| `ELEVENLABS_API_KEY` | **ElevenLabs API Key** (Used for TTS) |
| `ELEVENLABS_VOICE_ID` | The ID for the Greek Professional Voice |
| `NEXT_PUBLIC_BACKEND_URL` | The HTTP URL of your VPS (e.g., `http://1.2.3.4:3001`) |

### AI Backend (.env - VPS)
| Variable | Description |
| :--- | :--- |
| `BACKEND_PORT` | Port the backend listens on (Default: `3001`) |
| `TURSO_DATABASE_URL` | Same as Frontend (for job syncing) |
| `TURSO_AUTH_TOKEN` | Same as Frontend |
| `GROQ_API_KEY` | For potential server-side analysis |
| `OPENAI_API_KEY` | Used as a fallback for high-quality Embeddings |

---

## 📄 License
MIT License. Created by the community, for the Digital Agency industry.
