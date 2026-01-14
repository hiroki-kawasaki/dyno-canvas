ARG NODEJS_VERSION
ARG DISTROLESS_NODEJS_VERSION

FROM node:${NODEJS_VERSION}-slim AS builder

WORKDIR /web
COPY package.json ./

RUN npm install --omit=dev

COPY . .

ARG DYNOCANVAS_BASE_PATH

ENV DYNOCANVAS_BASE_PATH=${DYNOCANVAS_BASE_PATH}
ENV DYNOCANVAS_STANDALONE=true

RUN npm run build


FROM gcr.io/distroless/${DISTROLESS_NODEJS_VERSION} AS runner

ENV PORT="3000"

USER 65532
WORKDIR /web

COPY --from=builder /web/.next/static ./.next/static
COPY --from=builder /web/.next/standalone ./

EXPOSE 3000

CMD ["server.js"]