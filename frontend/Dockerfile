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

# Build frontend
RUN cd frontend && npm run build

EXPOSE 8080
ENV PORT=8080 NODE_ENV=production

CMD ["node", "server.js"]
