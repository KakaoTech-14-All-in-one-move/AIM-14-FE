# 빌드 환경
FROM node:18 AS builder
WORKDIR /app
COPY package.json package-lock.json ./
COPY .env.production .env
COPY . .
RUN npm ci
RUN npm run build

# 운영 환경
FROM nginx:alpine
# nginx 설정 파일 복사
COPY nginx.conf /etc/nginx/conf.d/default.conf
# 빌드 결과물을 nginx의 서비스 디렉토리로 복사
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]