# Study Companion

**Your Learning. Your Progress. Your Plan.**

Study Companion is a modern, comprehensive study management platform designed for any examination, subject, syllabus, or personal learning goal. It empowers students with dynamic workspace customization, lecture tracking, rich text study notes, an AI Notes Assistant, systematic spaced-repetition revision, and an adaptive AI Daily Study Planner with intelligent rescheduling.

---

## Key Features

- **Personalized Workspaces**: Create custom subjects and set target lecture counts for any syllabus or examination.
- **Lecture Tracker**: Monitor progress across all subjects with instant switching, real-time percentages, and lecture notes integration.
- **Rich Text Notes & AI Assistant**: In-depth note-taking with structured formatting, auto-save, and Google Gemini-powered organization, summarization, and concept clarity.
- **Revision Centre**: Spaced-repetition revision modes including Quick Revision, Active Recall, Flashcards, and Weak Area Explanations.
- **AI Syllabus Planner & Study Assistant**: Generate mathematically sound, pedagogical study roadmaps based on daily study availability, with an intelligent conversational assistant to reschedule missed work and adapt future schedules.
- **Privacy & Bring Your Own Key (BYOK)**: Secure, encrypted Google Gemini API key configuration ensuring personal control and complete data isolation.
- **Responsive Mobile Experience**: Designed mobile-first for phones, tablets, and desktops.

---

## Getting Started

1. Clone the repository and install dependencies:
   ```bash
   npm install
   ```

2. Configure environment variables in `.env.local`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   AI_ENCRYPTION_SECRET=your_32_byte_hex_secret
   ```

3. Run the development server:
   ```bash
   npm run dev
   ```

4. Build for production:
   ```bash
   npm run build
   ```
