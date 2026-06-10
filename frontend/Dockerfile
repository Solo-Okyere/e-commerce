FROM node:20-alpine

WORKDIR /app

# Install backend dependencies
COPY backend/package*.json ./backend/
RUN cd backend && npm install --production

# Copy backend code
COPY backend ./backend

# Install frontend dependencies (no production to include build tools)
COPY frontend/package*.json ./frontend/
RUN cd frontend && npm install --production=false

# Copy frontend code
COPY frontend ./frontend

# Copy server.js
COPY server.js ./

ENV INTERNAL_API_PORT=5001
ENV INTERNAL_API_ORIGIN=http://127.0.0.1:5001
ENV NEXT_PUBLIC_API_URL=

# Build frontend
RUN cd frontend && npm run build

EXPOSE 8080
ENV PORT=8080 NODE_ENV=production INTERNAL_API_PORT=5001 INTERNAL_API_ORIGIN=http://127.0.0.1:5001

CMD ["node", "server.js"]
