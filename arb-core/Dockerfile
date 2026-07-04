# Образ вотчера arb-core. Зависимостей нет — образ крошечный.
FROM node:20-slim

WORKDIR /app
COPY package.json ./
# npm-зависимостей нет; строка на будущее и для кэша слоёв.
RUN npm install --omit=dev || true
COPY . .

# Лог прогнозов — на volume, чтобы переживал рестарты (для грейдинга/дедупа).
ENV ARB_LOG_FILE=/data/predictions.jsonl
VOLUME ["/data"]

# Ключи и параметры передаются переменными окружения (см. DEPLOY.md).
CMD ["node", "src/watch.js"]
