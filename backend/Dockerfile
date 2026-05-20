FROM node:20-alpine

WORKDIR /app

COPY backend/package.json backend/package-lock.json* ./
RUN npm install --production

COPY backend .

ENV NODE_ENV=production PORT=5000
EXPOSE 5000
CMD ["npm", "start"]
