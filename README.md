# InfiniteTalk Studio AI

A local-first AI lip-sync studio powered by InfiniteTalk.

## Architecture

- Cloudflare Pages: web interface
- Supabase: authentication and generation job history
- Local Windows PC: InfiniteTalk worker and GPU inference

The browser UI does not run the AI model. The local worker runs the model and reports job status to the web app.
