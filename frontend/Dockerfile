FROM node:20-alpine

WORKDIR /app

COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install --production=false

COPY frontend .
RUN npm run build --webpack

ENV PORT=8080 NODE_ENV=production
EXPOSE 8080
CMD ["node", "node_modules/next/dist/bin/next", "start", "-p", "8080", "--hostname", "0.0.0.0"]
