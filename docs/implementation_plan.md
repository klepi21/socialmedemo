# Implementation Plan

A phased approach to building the SalesAI Agent.

## Phase 1: Knowledge Ingestion (The "Brain")
1. **Crawler Setup**: Implement a service using Firecrawl to scrape a URL and all subpages.
2. **Data Processing**: Clean the scraped text (removing headers/footers/nav) and convert to Markdown.
3. **Vectorization**: Store the agency's data into a Supabase Vector database.
4. **Knowledge Validation**: A simple dashboard view to see what the AI "knows."

## Phase 2: The Chat Interface
1. **Next.js UI**: Create the floating chatbox component.
2. **Text Interaction**: Connect the UI to an OpenAI stream (GPT-4o) with a System Prompt focused on sales.
3. **Context Injection**: Use RAG to fetch only relevant agency info for each user question.
4. **Speech Toggle**: Implement the "Speech vs Text" selection screen.
   - Text: Standard input.
   - Speech: Microphone prompt + STT/TTS loop.

## Phase 3: Sales Logic & Lead Capture
1. **Session Management**: Track what info has been gathered (Contact, Project Type, Budget, Timeline).
2. **Extraction Engine**: An asynchronous process that runs during the chat to "flag" important details.
3. **The 5-Minute Limit**: Gracefully end the conversation once enough data is gathered or the time limit is reached.

## Phase 4: Admin Dashboard & Automation
1. **Dashboard UI**: List of recent leads with status (New/Contacted).
2. **Log Viewer**: Playback/Read the full conversation transcript.
3. **PDF Engine**: Convert the "Extraction Engine" results into a professional PDF summary.
4. **Re-training Tool**: Button to trigger a fresh crawl or add manual text data.

## Phase 5: Polish & Deployment
1. **Branding**: Dynamic coloring/logos based on the agency's brand.
2. **Deployment**: Host on Vercel + Supabase.
3. **Client Handover**: Documentation on how to use the dashboard.
