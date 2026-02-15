-- Добавить отсутствующие колонки в Media, если миграции не были применены.
-- Выполнить: psql $DATABASE_URL -f prisma/add-missing-media-columns.sql

-- thumbnailKey (миграция 20260216000000)
ALTER TABLE "Media" ADD COLUMN IF NOT EXISTS "thumbnailKey" TEXT;

-- hlsPlaylistKey (миграция 20260217000000)
ALTER TABLE "Media" ADD COLUMN IF NOT EXISTS "hlsPlaylistKey" TEXT;
