FROM node:14-alpine AS builder
WORKDIR /build

RUN apk upgrade --no-cache

COPY package.json package-lock.json tsconfig.json ./
RUN npm ci

COPY source source

CMD npm run start