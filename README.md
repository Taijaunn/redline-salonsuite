# Red-Line | Salon Suite Contract Analyzer

AI-powered lease contract analysis tool built specifically for salon suite business owners. Upload your lease, get an instant red-line report highlighting risks, missing protections, and negotiation priorities.

![The Salon Suite Model](https://img.shields.io/badge/by-The%20Salon%20Suite%20Model-9B1B1B)

## Features

- **Contract Grading** — A-F grade with instant summary
- **Red Flags** — High and medium severity issues with negotiation tips
- **Needs Clarification** — Ambiguous clauses with suggestions for your realtor to raise
- **Green Flags** — Protections that work in your favor
- **Missing Clauses** — Important protections not included
- **Financial Breakdown** — Rent, deposit, fees, escalation terms
- **Email Generator** — Draft a professional email to your realtor with your concerns

## Quick Start

```bash
# Install dependencies
npm install

# Start dev server
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## Tech Stack

- React 18
- Vite
- Tailwind CSS
- Lucide React (icons)
- Claude API (Anthropic)

## Environment

The app uses the Anthropic API. In production, you'll want to proxy API calls through your backend to protect your API key.

## License

MIT
