# syntax=docker/dockerfile:1
#
# Imagen de producción del backend (D3 de despliegue-continuo-ec2). Se construye desde la raíz
# del repo, porque es un monorepo de npm workspaces con un único package-lock.json:
#
#   docker build -f backend/Dockerfile -t reservas-backend .
#
# La imagen es pública (GHCR) y no lleva secretos: ningún ARG ni ENV tiene valores sensibles, y
# .dockerignore deja afuera los .env. Los secretos (JWT_SECRET, DATABASE_URL, credenciales del
# admin) llegan solo en runtime, desde el .env que genera deploy/desplegar.sh (D6).
#
# Imagen base fijada por versión de parche y por digest (tarea 1.2). Node 20 es la versión que
# fijan engines y CI; ver docs/despliegue.md sobre su fin de soporte.
ARG NODE_IMAGE=node:20.20.2-alpine3.23@sha256:fb4cd12c85ee03686f6af5362a0b0d56d50c58a04632e6c0fb8363f609372293

# ---------------------------------------------------------------------------------------------
# Etapa de build: dependencias completas, Prisma Client, Nest y el seed de producción.
# ---------------------------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS build
WORKDIR /app

# El lockfile lo escribe npm 11 y la imagen trae npm 10: misma razón que en ci.yml.
RUN npm install -g npm@11.6.1

# Primero solo los manifiestos y el schema (lo usa el postinstall `prisma generate`), para
# aprovechar la caché de capas cuando cambia solo el código. El package.json del frontend hace
# falta para que npm reconozca el workspace del lockfile; no se instala nada de él.
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
COPY backend/prisma/schema.prisma backend/prisma/
RUN npm ci --workspace backend --include-workspace-root=false

COPY backend/ backend/
RUN npm run build --workspace backend \
 && npx --workspace backend tsc -p tsconfig.seed.json \
 && npm prune --omit=dev --workspace backend --include-workspace-root=false

# ---------------------------------------------------------------------------------------------
# Etapa final: solo lo necesario para correr, como usuario sin privilegios.
# ---------------------------------------------------------------------------------------------
FROM ${NODE_IMAGE} AS runtime
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=3001 \
    PRISMA_HIDE_UPDATE_MESSAGE=1 \
    PATH=/app/node_modules/.bin:$PATH
WORKDIR /app/backend

COPY --from=build --chown=root:root /app/node_modules /app/node_modules
COPY --from=build --chown=root:root /app/package.json /app/package.json
COPY --from=build --chown=root:root /app/backend/package.json ./package.json
# Dependencias que npm no puede elevar a la raíz (por ejemplo, @nestjs/config, que pide otra
# versión de dotenv que la del resto del monorepo) quedan en backend/node_modules. Sin esta
# copia la app no arranca: "Cannot find module '@nestjs/config'".
COPY --from=build --chown=root:root /app/backend/node_modules ./node_modules
COPY --from=build --chown=root:root /app/backend/dist ./dist
COPY --from=build --chown=root:root /app/backend/dist-seed ./dist-seed
COPY --from=build --chown=root:root /app/backend/prisma ./prisma

# Los archivos quedan de root y de solo lectura para el proceso: `node` no puede modificar el
# código ni las dependencias aunque el contenedor no sea read_only.
USER node

# Prueba de humo: cargar el módulo raíz de la app y el seed de producción resuelve todas sus
# dependencias sin conectarse a nada. Si falta un paquete en la imagen, el build falla acá y no
# en el despliegue (pasó con backend/node_modules; ver la copia de arriba).
RUN node -e "require('./dist/src/app.module.js'); require('./dist-seed/seed-produccion.js')"

EXPOSE 3001

# `nest build` deja la entrada en dist/src/main.js (compila también prisma/, así que la raíz
# de salida es backend/). Migraciones y seed los corre deploy/desplegar.sh con
# `docker compose run`, no este comando.
CMD ["node", "dist/src/main.js"]
