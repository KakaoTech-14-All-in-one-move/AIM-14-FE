# 1. 빌드 환경
FROM node:18 AS builder
# 작업 디렉토리 설정
WORKDIR /app
# package.json과 package-lock.json 복사
COPY package.json package-lock.json ./
# .env 복사
COPY .env.production .env
# 소스 코드 및 환경 변수 파일 복사
COPY . .
# npm 의존성 설치
RUN npm ci
# 빌드 실행
RUN npm run build

# 2. 실행 환경
FROM nginx:alpine
# Nginx 설정 파일 복사
COPY nginx.conf /etc/nginx/nginx.conf
# 빌드된 정적 파일 복사
COPY --from=builder /app/dist /usr/share/nginx/html
# Nginx 실행
CMD ["nginx", "-g", "daemon off;"]
# 컨테이너가 80번과 443번 포트로 통신하도록 설정
EXPOSE 80 443