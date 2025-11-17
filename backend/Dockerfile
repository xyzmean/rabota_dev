# Multi-stage build для минимизации размера образа
FROM node:20-alpine AS builder

WORKDIR /app

# Копируем package.json и package-lock.json
COPY package*.json ./

# Устанавливаем все зависимости (включая dev для сборки)
RUN npm ci && npm cache clean --force

# Копируем исходники
COPY . .

# Компилируем TypeScript
RUN npm run build

# Копируем SQL файлы в dist (TypeScript не копирует их)
RUN cp -r src/db/*.sql dist/db/ 2>/dev/null || true
RUN cp -r src/db/migrations dist/db/ 2>/dev/null || true

# Устанавливаем только production зависимости
RUN npm ci --only=production && npm cache clean --force

# Production stage
FROM node:20-alpine

WORKDIR /app

# Копируем только необходимые файлы из builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./

# Создаем непривилегированного пользователя
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
USER nodejs

# Открываем порт
EXPOSE 3001

# Запускаем приложение
CMD ["node", "dist/server.js"]
