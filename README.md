# Rented Thikana (किराये का ठिकाना)

A student-focused room, PG, and roommate marketplace for students and aspirants in Prayagraj and across India.

## Features

- **Proximity-Dominant Search**: PostGIS-powered geospatial distance sorting with anti-leapfrogging algorithms.
- **Privacy & Safety First**: Neighborhood coordinate fuzzing (150-250m safe jitter) and phone privacy protection until requests are accepted.
- **Roommate Matching**: Lifestyle compatibility matching algorithm for students.
- **Supabase Backend**: Real-time PostgreSQL database with PostGIS extensions and granular Row-Level Security (RLS) policies.

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, Lucide Icons, Leaflet
- **Backend & Database**: Supabase, PostgreSQL 17, PostGIS 3.3
- **Hosting & CI/CD**: Vercel

## Environment Configuration

To run locally, copy `.env.example` to `.env` and fill in your Supabase credentials:

```env
VITE_SUPABASE_URL=https://kjamjylsntwuundttcio.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key-here
```

## Getting Started

```bash
npm install
npm run dev
```
