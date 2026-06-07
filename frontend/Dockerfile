FROM node:20-alpine AS build
WORKDIR /app
ARG VITE_API_BASE_URL=http://localhost:18080
ARG VITE_AMAP_JS_KEY=
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_AMAP_JS_KEY=$VITE_AMAP_JS_KEY
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
