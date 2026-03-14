# Technical Architecture & Tech Stack

This document outlines the proposed technology stack and the high-level architecture of the SalesAI Agent.

## 1. Frontend: The Chatbox & Dashboard
- **Framework**: [Next.js 14+ (App Router)](https://nextjs.org/)
- **Styling**: Vanilla CSS or Tailwind CSS.
- **Animations**: [Framer Motion](https://www.framer.com/motion/) for premium feel.

## 2. AI & LLM Infrastructure
- **Fastest Inference (Demo/MVP)**: [Groq](https://groq.com/) using Llama 3.1.
  - Why: Sub-second response times. Perfect for making the bot feel "instant."
  - Free Tier: Very generous free rate limits for developers.
- **Primary Logic/Reasoning**: [OpenAI GPT-4o](https://openai.com/index/gpt-4o/).
  - Why: Best for complex lead extraction and final summaries.
- **Realtime Voice**: [OpenAI Realtime API](https://platform.openai.com/docs/guides/realtime).
  - Why: Specifically designed for low-latency voice-to-voice communication.
- **RAG (Retrieval-Augmented Generation)**:
  - **Vector Database**: [Pinecone](https://www.pinecone.io/). (User Preference)
  - **Embeddings**: `text-embedding-3-small` (OpenAI).
- **Crawling/Scraping**: [Firecrawl](https://www.firecrawl.dev/) or [ScrapeGraphAI]. 

## 3. Voice & Speech Logic
- **Speech-to-Text (STT)**: [OpenAI Whisper](https://platform.openai.com/docs/guides/speech-to-text) or Browser `SpeechRecognition`.
- **Text-to-Speech (TTS)**: Browser `SpeechSynthesis` (Free/Immediate) or [OpenAI TTS](https://platform.openai.com/docs/guides/text-to-speech).
- **Audio Streaming**: To eliminate delay, we use **Audio Streaming** where the AI starts speaking *while* it's still generating the rest of the sentence.

## 4. Backend & Storage
- **Database**: [Supabase (PostgreSQL)](https://supabase.com/).
- **PDF Generation**: [React-PDF](https://react-pdf.org/) or [Puppeteer].

## 5. Free Tiers for Demo/MVP
| Service | Free Tier Usage |
|---------|-----------------|
| **Next.js** | Hosted on Vercel (Free) |
| **Pinecone** | **Free Starter Plan** (1 Project, enough for millions of agency vectors) |
| **Groq** | Free API access (Llama 3/3.1) - **Fastest response available** |
| **OpenAI** | $5 trial credit (usually enough for initial testing) |
| **Web Speech API**| 100% Free (Browser-based) |
| **Firecrawl** | 500 pages free |
## 5. Free Tiers for Demo/MVP
| Service | Free Tier Usage |
|---------|-----------------|
| **Next.js** | Hosted on Vercel (Free) |
| **Pinecone** | **Free Starter Plan** (1 Project, enough for millions of agency vectors) |
| **Groq** | Free API access (Llama 3/3.1) - **Fastest response available** |
| **OpenAI** | $5 trial credit (usually enough for initial testing) |
| **Web Speech API**| 100% Free (Browser-based) |
