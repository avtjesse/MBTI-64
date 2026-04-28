<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# MBTI-64

This project is set up for a safer Vercel deployment:

- Frontend: Vite + React
- Backend: Vercel Serverless Function at `/api/analyze`
- Secret handling: `GEMINI_API_KEY` stays on the server

## Local Development

Prerequisite: Node.js

1. Install dependencies:
   `npm install`
2. Create `.env.local` with:
   `GEMINI_API_KEY=your_gemini_api_key`
3. Start local Vercel development:
   `npx vercel dev`

If you only run `npm run dev`, the frontend will start, but the `/api/analyze` serverless endpoint will not be available.

## Deploy to Vercel

1. Push this repository to GitHub.
2. Import the repository into [Vercel](https://vercel.com/).
3. Confirm these settings:
   - Framework Preset: `Vite`
   - Build Command: `npm run build`
   - Output Directory: `dist`
4. Add this environment variable in Vercel:
   - `GEMINI_API_KEY`
5. Deploy.

After deployment, the React app will call `/api/analyze`, and Gemini requests will be executed server-side.
