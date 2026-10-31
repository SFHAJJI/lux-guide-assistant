FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production PORT=8787
COPY package.json ./
COPY core ./core
COPY proxy ./proxy
COPY data/index ./data/index
RUN mkdir -p /app/proxy/log && chown -R node:node /app
USER node
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:8787/health || exit 1
CMD ["node", "proxy/server.mjs"]
