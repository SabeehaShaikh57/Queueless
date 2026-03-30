FROM node:20-alpine

WORKDIR /app

# Install backend dependencies
COPY queueless-backend/package*.json ./queueless-backend/
RUN cd queueless-backend && npm ci --omit=dev

# Copy full project so backend can serve frontend static files
COPY queueless-backend ./queueless-backend
COPY queueless-frontend ./queueless-frontend

WORKDIR /app/queueless-backend

EXPOSE 5000

CMD ["npm", "start"]
