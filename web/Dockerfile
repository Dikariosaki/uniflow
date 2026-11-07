FROM node:26-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . ./
RUN npm run build

FROM nginx:1.29-alpine AS runtime
COPY nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist/uniflow-web/browser/ /usr/share/nginx/html/
COPY config.template.js /usr/share/nginx/html/config.template.js
COPY docker-entrypoint.sh /docker-entrypoint.d/40-uniflow-config.sh
RUN chmod +x /docker-entrypoint.d/40-uniflow-config.sh
EXPOSE 80
