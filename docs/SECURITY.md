# Security

The service validates required fields, uses parameterized SQLite statements, restricts download access to an entitlement token, records audit events, and does not store secrets in source. Before production, add real authentication, authorization, rate limiting, CSRF policy, signed object-storage URLs, upload scanning, and secret management.
