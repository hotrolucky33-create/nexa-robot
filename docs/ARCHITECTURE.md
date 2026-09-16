# Architecture

The MVP is a modular Node service with a static web client, SQLite persistence, and pure verification functions. The `packages/verification` module is independent of HTTP so it can later run in a worker or Python service.

Production evolution: PostgreSQL for durable data, Redis for resumable jobs, S3-compatible object storage for immutable artifacts, and real CAD/simulation providers behind interfaces.
