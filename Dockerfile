FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM pierrezemb/gostatic:latest
COPY --from=build /app/dist/ /srv/http/
CMD ["-port", "8080", "-enable-logging"]
