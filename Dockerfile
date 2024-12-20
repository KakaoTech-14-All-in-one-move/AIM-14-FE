# 빌드 환경
FROM node:18 AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY .env.production .env
COPY . .
RUN npm ci
RUN npm run build

# 실행 환경
FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./
COPY --from=builder /app/package-lock.json ./
# vite를 포함한 의존성 설치
RUN npm install vite
# Vite preview 서버 실행
CMD ["npx", "vite", "preview", "--host", "0.0.0.0", "--port", "80"]
EXPOSE 80