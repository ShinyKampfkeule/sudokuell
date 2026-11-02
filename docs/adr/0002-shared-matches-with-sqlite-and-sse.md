# Shared Matches with SQLite and SSE

Cross-device Matches use SQLite on a persistent Next.js Node.js server as their shared source of truth; player actions use HTTP and server updates use SSE. This keeps anonymous guest play account-free and lets active Matches survive server restarts, while keeping the deployment intentionally single-server because the SQLite file and SSE broadcaster are local to that process.
