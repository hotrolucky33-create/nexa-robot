# Artifact pipeline

`ArtifactManager` writes the package directory, creates `manifest.json` with size and SHA-256 for every file, and produces a ZIP archive. The local storage provider can issue an expiring metadata record; production must replace it with S3-compatible signed URLs.
