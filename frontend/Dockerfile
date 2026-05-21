FROM node:20-alpine

WORKDIR /app

COPY frontend/package.json frontend/package-lock.json* ./
RUN npm install --production=false

COPY frontend .

ENV NODE_ENV=production PORT=8080
EXPOSE 8080
RUN npm run build

CMD ["npm", "run", "start"]
