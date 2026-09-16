# Verified Engineering Marketplace

An auditable marketplace for engineering packages. The MVP turns a structured product specification into deterministic engineering evidence and only publishes versions whose required checks all pass.

## Run

```powershell
npm install
npm run self-test
npm start
```

Open `http://localhost:8787`.

## Important safety boundary

This is an engineering workflow MVP, not a certification authority. A verified package is not a guarantee that a design is safe for industrial use. Real CAD kernels, domain solvers, material certificates, and qualified human review are required before deployment.
