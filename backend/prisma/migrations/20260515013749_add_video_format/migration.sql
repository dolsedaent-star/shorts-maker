-- CreateEnum
CREATE TYPE "VideoFormat" AS ENUM ('FULLSCREEN_OVERLAY', 'TOP_TEXT_BAND', 'SPLIT_TOP_BOTTOM');

-- AlterTable
ALTER TABLE "videos" ADD COLUMN     "format" "VideoFormat" NOT NULL DEFAULT 'TOP_TEXT_BAND',
ADD COLUMN     "top_text_line_1" TEXT,
ADD COLUMN     "top_text_line_2" TEXT,
ADD COLUMN     "top_text_style" JSONB;
