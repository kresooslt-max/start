# STARTAUTO — OZON CARD MANAGER

Рабочее web-приложение для магазина автозапчастей: Ozon + основной web research + опциональный RIV + OEM + применяемость + AI + Excel + batch jobs + аналитика + история.

## Главная логика

**Интернет — основной поиск. RIV — только opt-in.**

Для товара `useRiv=false` RIV не вызывается вообще. При `useRiv=true` StartAuto отправляет артикул в отдельный Playwright-worker RIV. Отсутствие товара в RIV не считается отсутствием товара.

## Архитектура

- `Next.js / React / TypeScript` — сайт и server-side API.
- `Supabase` — PostgreSQL + Auth + RLS.
- `services/riv-worker` — Python FastAPI + Playwright; отдельный серверный процесс для RIV.
- `workers/research-worker.ts` — фоновая обработка очереди из Supabase.
- `src/lib/ozon/client.ts` — Ozon Seller API.
- `src/lib/search/web.ts` — web search adapter.
- `src/lib/ai/provider.ts` — AI abstraction layer.

## Безопасность

Никогда не записывайте Ozon API Key, RIV password или AI key в исходники. Используйте `.env` / cloud secrets. Supabase browser использует publishable key; secret key используется только на сервере. Supabase рекомендует publishable keys для браузерного кода и secret keys только для backend/Edge/worker компонентов. (https://supabase.com/docs/guides/getting-started/api-keys)

## Ozon API

Коннектор ориентирован на актуальные версии: `/v3/product/list`, `/v3/product/info/list`, `/v4/product/info/attributes`, `/v4/product/info/stocks`, `/v5/product/info/prices`, `/v3/product/import`, `/v1/product/pictures/import`, `/v1/analytics/data`. Точные лимиты и доступность метрик зависят от текущего API и тарифа продавца; приложение не подменяет недоступные метрики fake-данными. `/v1/analytics/data` требует даты, метрики и dimension и имеет ограничения по запросам. (https://api-seller.ozon.ru)

## Supabase

Создайте проект Supabase, примените `supabase/migrations/001_startauto_core.sql`, создайте пользователя Auth и задайте `BOOTSTRAP_ADMIN_EMAIL`. После входа вызов bootstrap endpoint создаёт store + ADMIN membership. Next.js SSR использует `@supabase/ssr` и cookie-сессии, что соответствует актуальной рекомендации Supabase для SSR. (https://supabase.com/docs/guides/auth/server-side/creating-a-client)

## Online deployment без запуска на компьютере

Самый простой вариант для этой архитектуры — один VPS/cloud VM с Docker Compose:

1. Создать новый GitHub repository.
2. Загрузить этот проект.
3. Создать Supabase project.
4. В SQL Editor выполнить migration из `supabase/migrations/001_startauto_core.sql`.
5. Создать cloud VM с Docker.
6. На VM загрузить репозиторий и создать `.env` из `.env.example`.
7. Вставить Supabase URL + publishable key + secret key.
8. Вставить Ozon Client ID + API Key.
9. Вставить RIV URL + username + password.
10. Вставить `TAVILY_API_KEY` и `AI_API_KEY`.
11. Указать `RIV_WORKER_URL=http://riv-worker:8080`.
12. Запустить `docker compose up -d --build`.
13. Открыть IP/домен сервера.
14. Создать/включить пользователя Supabase Auth.
15. Войти в StartAuto и синхронизировать Ozon.

Для HTTPS поставьте TLS перед Nginx (например, Cloudflare Tunnel или внешний reverse proxy) или используйте managed host. Важно, чтобы RIV worker оставался долгоживущим server-side процессом, а не headful браузером на компьютере пользователя.

## Локальная разработка

Локальный запуск нужен только разработчикам. Production workflow рассчитан на cloud/VPS.

## Что не следует считать готовым без credentials

- Ozon: требует реальных API credentials.
- Web search: требует search API key.
- AI: требует AI API key.
- RIV: требует рабочий аккаунт RIV и доступ worker к `riv.kz`.
- Analytics: появляются после реального запроса/sync Ozon.

## Важное правило публикации

AI только создаёт предложение. Публикация идёт через отдельный user approval workflow. Конфликты OEM/годов/двигателя/кузова блокируют публикацию, пока пользователь не решит их.
