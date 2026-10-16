# Nirmana — Build with clarity

A transparent construction-management web app for the Sri Lankan residential and commercial markets. It connects the **client**, the **architect** and the **contractor** in one workspace, so every plan, rupee and day of progress can be seen and checked. The module structure follows Buildertrend.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # type-check + production build
```

## Two sides of the app

| | Residential (`/residential/*`, teal) | Commercial (`/commercial/*`, cobalt) |
|---|---|---|
| Projects | Houses, villas, heritage renovation, pre-construction | Grade-A office tower, retail plaza, logistics warehouse |
| Estimator types | House, luxury villa, low-rise apartment | Office, retail, warehouse, boutique hotel |
| Payments | 8 milestones + 5% retention | 9 milestones + 5% retention |

Switch sides from the sidebar. Each role (**Client / Architect / Contractor**) sees different actions, and the role comes from the account you log in with.

## Accounts

The workspace needs a login. On `/signup` you choose to register as a client, architect or contractor; on `/login` you choose the same role and sign in with email and password (an account can only log in under its own role). The signed-in user appears as that party on every project, and their name is used on logs, comments, approvals and the audit trail. Log out from the account menu in the top bar.

For now, accounts are stored in the browser's `localStorage` (`nirmana.v1.users`, with salted SHA-256 password hashes) and the session in `nirmana.v1.session`. This is a stand-in, not real security: `src/store/auth.tsx` is the single place to swap in a backend API.

## Features

- **Live market prices.** About 30 materials and labour rates with a live quote feed, 24-month cost curves, regional prices for 13 districts, an indexed comparison chart, price alerts, and the *Nirmana Construction Cost Index* (NCCI).
- **Cost curves.** A project S-curve (planned vs earned vs actual, plus a forecast), the cost of a typical building over time, and a size vs Rs/sq ft curve.
- **Cost estimator.** A quantity take-off priced at live rates, with finish grade, district, contingency and VAT. Includes price sensitivity and a grade comparison.
- **Material calculators.** Concrete mixes, brick and block walls, plaster, tiles, paint and rebar (d²/162), all priced live.
- **Architect plans.** Versioned drawing sheets with zoom, pinned comments, revision history, client approve / request changes, and architect re-issue.
- **Real-time site progress.** Contractor daily logs with weather, crew, photos and materials used. The client acknowledges each log and the architect verifies it.
- **Materials & BOQ.** Planned → delivered → used quantities, contract rate vs live rate, escalation exposure and buy-timing hints.
- **Open-book ledger.** Every purchase is compared with that month's district market rate. Items more than 5% above market are flagged, and client query → contractor response → verify is tracked. Exports to CSV.
- **Change orders and payments.** Itemised COs with cost and schedule impact. Payment flow: invoice → architect certifies → client releases, with a paid-vs-earned check.
- **Earned value in plain language.** CPI, SPI, EAC, VAC and TCPI, each explained for non-experts.
- **Transparency score.** Combines receipts, verification, rate compliance, log frequency and pending decisions.
- **Approvals inbox and audit trail.** Every action is time-stamped and visible to all three parties.

## Data

All data is demo data, seeded deterministically, and the price feed is **simulated**. Cement reflects the March 2026 rise of about Rs 150–175 per bag; other prices are calibrated so a standard house estimates at about Rs 13k/sq ft. In production, `src/store/store.tsx` (`PriceProvider`) is the integration point for supplier quotes, CIDA indices or CBSL housing-cost data. Demo state persists in `localStorage`; use **Reset demo data** in the sidebar to restore it.

## Stack

React 19, TypeScript, Vite 8, Tailwind CSS 4, Recharts 3, React Router 7, lucide-react.
