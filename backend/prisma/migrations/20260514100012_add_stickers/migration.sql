-- CreateEnum
CREATE TYPE "StickerPosition" AS ENUM ('TOP_LEFT', 'TOP_CENTER', 'TOP_RIGHT', 'MIDDLE_LEFT', 'CENTER', 'MIDDLE_RIGHT', 'BOTTOM_LEFT', 'BOTTOM_CENTER', 'BOTTOM_RIGHT');

-- CreateEnum
CREATE TYPE "StickerScale" AS ENUM ('SMALL', 'MEDIUM', 'LARGE');

-- CreateTable
CREATE TABLE "stickers" (
    "id" UUID NOT NULL,
    "video_id" UUID NOT NULL,
    "image_path" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "position" "StickerPosition" NOT NULL DEFAULT 'BOTTOM_CENTER',
    "scale" "StickerScale" NOT NULL DEFAULT 'MEDIUM',
    "start_sec" DOUBLE PRECISION NOT NULL,
    "end_sec" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stickers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "stickers_video_id_idx" ON "stickers"("video_id");

-- AddForeignKey
ALTER TABLE "stickers" ADD CONSTRAINT "stickers_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;
