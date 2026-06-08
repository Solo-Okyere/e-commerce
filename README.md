# FOSOGO Closet Ecommerce Platform

A full-stack ecommerce platform for selling clothes and boutique items.

## Tech Stack

- **Frontend**: Next.js with TypeScript and Tailwind CSS
- **Backend**: Node.js with Express.js
- **Database**: Neon/PostgreSQL via `DATABASE_URL`
- **Payments**: Mobile money (Ghana cedis)
- **Mobile**: React Native (planned)

## Setup

### Backend

1. Navigate to `backend` directory
2. Install dependencies: `npm install`
3. Create `.env` file with `DATABASE_URL`, `JWT_SECRET`, and payment/email secrets
4. Run development server: `npm run dev`

### Frontend

1. Navigate to `frontend` directory
2. Install dependencies: `npm install`
3. Create `.env.local` with `NEXT_PUBLIC_API_URL=http://localhost:5000`
4. Run development server: `npm run dev`

## Deployment

### Render

The app is configured to deploy as a single service on Render using `frontend/Dockerfile`.

Render service settings:

- Root Directory: leave blank, or use `.`
- Docker Context Directory: `.`
- Dockerfile Path: `frontend/Dockerfile`

Required environment variables in Render:

- `DATABASE_URL`
- `JWT_SECRET`
- `PAYSTACK_SECRET_KEY`, `PAYSTACK_LIVE_SECRET_KEY`, or `PAYSTACK_TEST_SECRET_KEY`
- `PAYSTACK_CALLBACK_URL`
- `PAYSTACK_WEBHOOK_URL`
- `FRONTEND_URL`
- `BACKEND_URL=http://localhost:5000`

This service starts both the backend and the frontend together in the same container.

## Features

- User authentication
- Product catalog
- Shopping cart
- Checkout with mobile money
- Order management
- Admin dashboard

## Development

- Backend API runs on http://localhost:5000
- Frontend runs on http://localhost:3000
