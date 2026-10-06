# The web app: built once, served by nginx, which also forwards /api to the gateway.
#   docker build -t sprout-web .
#   docker run -p 8080:80 -e SPROUT_API=http://host.docker.internal:8100 sprout-web
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npx ng build --configuration production

FROM nginx:1.27-alpine
ENV SPROUT_API=http://edge:8100
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist/sprout-web/browser /usr/share/nginx/html
HEALTHCHECK --interval=10s --timeout=3s --retries=5 CMD wget -qO- http://127.0.0.1/healthz >/dev/null || exit 1
EXPOSE 80
