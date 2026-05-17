# FOSOGO Closet Ecommerce Platform

A full-stack ecommerce platform for selling clothes and boutique items.

## Tech Stack

- **Frontend**: Next.js with TypeScript and Tailwind CSS
- **Backend**: Node.js with Express.js
- **Database**: Local JSON store (`backend/data.json`) for current development setup
- **Payments**: Mobile money (Ghana cedis)
- **Mobile**: React Native (planned)

## Setup

### Backend

1. Navigate to `backend` directory
2. Install dependencies: `npm install`
3. Create `.env` file with your JWT secret
4. Run development server: `npm run dev`

### Frontend

1. Navigate to `frontend` directory
2. Install dependencies: `npm install`
3. Create `.env.local` with `NEXT_PUBLIC_API_URL=http://localhost:5000`
4. Run development server: `npm run dev`

## Features

- User authentication
- Product catalog
- Shopping cart
- Checkout with mobile money
- Order management
- Admin dashboard

## Development

NP

- Backend API runs on http://localhost:5000
- Frontend runs on http://localhost:3000
