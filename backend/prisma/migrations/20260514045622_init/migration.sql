-- CreateEnum
CREATE TYPE "Tone" AS ENUM ('HUMOR', 'SERIOUS', 'EMOTIONAL', 'INFORMATIVE');

-- CreateEnum
CREATE TYPE "VideoStatus" AS ENUM ('DRAFT', 'SCENARIOS_READY', 'SECTIONS_READY', 'TRIMMING', 'AWAITING_ASSETS', 'RENDERING', 'DONE', 'FAILED');

-- CreateEnum
CREATE TYPE "ScenarioAngle" AS ENUM ('PROBLEM_SOLUTION', 'DEMO', 'BEFORE_AFTER', 'TESTIMONIAL', 'CURIOSITY_HOOK');

-- CreateEnum
CREATE TYPE "LLMProvider" AS ENUM ('GEMINI_PRO', 'GEMINI_FLASH', 'CLAUDE_SONNET', 'MANUAL_EDIT');

-- CreateEnum
CREATE TYPE "TrimField" AS ENUM ('SCRIPT_TEXT', 'VIDEO_PROMPT');

-- CreateEnum
CREATE TYPE "RenderJobStatus" AS ENUM ('QUEUED', 'PROCESSING', 'SUCCEEDED', 'FAILED');

-- CreateTable
CREATE TABLE "projects" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "app_name" TEXT NOT NULL,
    "target_user" TEXT NOT NULL,
    "value_proposition" TEXT NOT NULL,
    "store_url" TEXT,
    "tone" "Tone" NOT NULL,
    "default_duration_s" INTEGER NOT NULL DEFAULT 18,
    "subtitle_style" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "videos" (
    "id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "duration_seconds" INTEGER NOT NULL,
    "status" "VideoStatus" NOT NULL DEFAULT 'DRAFT',
    "selected_scenario_id" UUID,
    "subtitle_style_override" JSONB,
    "thumbnail_path" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "videos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scenarios" (
    "id" UUID NOT NULL,
    "video_id" UUID NOT NULL,
    "angle" "ScenarioAngle" NOT NULL,
    "content" TEXT NOT NULL,
    "hook_line" TEXT NOT NULL,
    "generated_by" "LLMProvider" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scenarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sections" (
    "id" UUID NOT NULL,
    "video_id" UUID NOT NULL,
    "order_index" INTEGER NOT NULL,
    "duration_seconds" INTEGER NOT NULL,
    "video_prompt" TEXT NOT NULL,
    "script_text" TEXT NOT NULL,
    "source_video_path" TEXT,
    "source_audio_path" TEXT,
    "processed_video_path" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trim_history" (
    "id" UUID NOT NULL,
    "section_id" UUID NOT NULL,
    "field" "TrimField" NOT NULL,
    "before_text" TEXT NOT NULL,
    "after_text" TEXT NOT NULL,
    "user_instruction" TEXT,
    "llm_used" "LLMProvider" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trim_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "render_jobs" (
    "id" UUID NOT NULL,
    "video_id" UUID NOT NULL,
    "pg_boss_job_id" TEXT NOT NULL,
    "status" "RenderJobStatus" NOT NULL DEFAULT 'QUEUED',
    "progress_pct" INTEGER NOT NULL DEFAULT 0,
    "current_step" TEXT,
    "error_message" TEXT,
    "started_at" TIMESTAMP(3),
    "finished_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "render_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "render_artifacts" (
    "id" UUID NOT NULL,
    "video_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "file_path" TEXT NOT NULL,
    "file_size_bytes" BIGINT NOT NULL,
    "duration_actual_seconds" DOUBLE PRECISION NOT NULL,
    "render_job_id" UUID NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "render_artifacts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "videos_project_id_idx" ON "videos"("project_id");

-- CreateIndex
CREATE INDEX "videos_status_idx" ON "videos"("status");

-- CreateIndex
CREATE INDEX "scenarios_video_id_idx" ON "scenarios"("video_id");

-- CreateIndex
CREATE UNIQUE INDEX "sections_video_id_order_index_key" ON "sections"("video_id", "order_index");

-- CreateIndex
CREATE INDEX "trim_history_section_id_idx" ON "trim_history"("section_id");

-- CreateIndex
CREATE INDEX "render_jobs_video_id_idx" ON "render_jobs"("video_id");

-- CreateIndex
CREATE INDEX "render_jobs_status_idx" ON "render_jobs"("status");

-- CreateIndex
CREATE INDEX "render_artifacts_video_id_idx" ON "render_artifacts"("video_id");

-- CreateIndex
CREATE UNIQUE INDEX "render_artifacts_video_id_version_key" ON "render_artifacts"("video_id", "version");

-- AddForeignKey
ALTER TABLE "videos" ADD CONSTRAINT "videos_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "videos" ADD CONSTRAINT "videos_selected_scenario_id_fkey" FOREIGN KEY ("selected_scenario_id") REFERENCES "scenarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scenarios" ADD CONSTRAINT "scenarios_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sections" ADD CONSTRAINT "sections_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trim_history" ADD CONSTRAINT "trim_history_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "sections"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "render_jobs" ADD CONSTRAINT "render_jobs_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "render_artifacts" ADD CONSTRAINT "render_artifacts_video_id_fkey" FOREIGN KEY ("video_id") REFERENCES "videos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "render_artifacts" ADD CONSTRAINT "render_artifacts_render_job_id_fkey" FOREIGN KEY ("render_job_id") REFERENCES "render_jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
