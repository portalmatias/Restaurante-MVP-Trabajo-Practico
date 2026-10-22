# syntax=docker/dockerfile:1
#
# Imagen de producción del frontend (D3 de despliegue-continuo-ec2). Se construye desde la raíz
# del repo (monorepo de npm workspaces con un único package-lock.json):
#
#   docker build -f frontend/Dockerfile -t reservas-frontend .
#
# La imagen es pública (GHCR) y no lleva secretos. El único valor de build es
# NEXT_PUBLIC_API_URL, el nombre interno del servicio del backend en la red de Docker: Next
# arma la reescritura de /api en el build, así que queda fijo en la imagen.
ARG NODE_IMAGE=node:20.20.2-alpine3.23@sha256:fb4cd12c85ee03686f6af5362a0b0d56d50c58a04632e6c0fb8363f609372293

# ---------------------------------------------------------------------------------------------
# Etapa de build
# ---------------------------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS build
WORKDIR /app

# El lockfile lo escribe npm 11 y la imagen trae npm 10: misma razón que en ci.yml.
RUN npm install -g npm@11.6.1

# El package.json del backend hace falta para que npm reconozca el workspace del lockfile; no
# se instala nada de él.
COPY package.json package-lock.json ./
COPY frontend/package.json frontend/
COPY backend/package.json backend/
RUN npm ci --workspace frontend --include-workspace-root=false

COPY frontend/ frontend/

# No es un secreto: es la dirección interna del backend en la red de Docker (D3).
ARG NEXT_PUBLIC_API_URL=http://backend:3001
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL} \
    NEXT_TELEMETRY_DISABLED=1
RUN npm run build --workspace frontend

# ---------------------------------------------------------------------------------------------
# Etapa final: el servidor mínimo de `output: "standalone"`, como usuario sin privilegios.
# ---------------------------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000
WORKDIR /app

# `standalone` replica la estructura del monorepo (la raíz de trazado es la del lockfile), así
# que el servidor queda en frontend/server.js. `public` y `.next/static` no vienen incluidos y
# se copian aparte (ver output.md de la documentación de Next).
COPY --from=build --chown=root:root /app/frontend/.next/standalone ./
COPY --from=build --chown=root:root /app/frontend/.next/static ./frontend/.next/static
COPY --from=build --chown=root:root /app/frontend/public ./frontend/public

USER node
EXPOSE 3000

# No se usa `npm run start` porque fija `--hostname 127.0.0.1` para desarrollo local; HOSTNAME
# de arriba hace escuchar al servidor en la interfaz de la red de Docker.
CMD ["node", "frontend/server.js"]
