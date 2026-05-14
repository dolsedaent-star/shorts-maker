export type Tone = 'HUMOR' | 'SERIOUS' | 'EMOTIONAL' | 'INFORMATIVE';
export type VideoStatus =
  | 'DRAFT'
  | 'SCENARIOS_READY'
  | 'SECTIONS_READY'
  | 'TRIMMING'
  | 'AWAITING_ASSETS'
  | 'RENDERING'
  | 'DONE'
  | 'FAILED';
export type ScenarioAngle =
  | 'PROBLEM_SOLUTION'
  | 'DEMO'
  | 'BEFORE_AFTER'
  | 'TESTIMONIAL'
  | 'CURIOSITY_HOOK';
export type LLMProvider = 'GEMINI_PRO' | 'GEMINI_FLASH' | 'CLAUDE_SONNET' | 'MANUAL_EDIT';
export type TrimField = 'SCRIPT_TEXT' | 'VIDEO_PROMPT';
export type RenderJobStatus = 'QUEUED' | 'PROCESSING' | 'SUCCEEDED' | 'FAILED';

export type Project = {
  id: string;
  name: string;
  description: string;
  appName: string;
  targetUser: string;
  valueProposition: string;
  storeUrl: string | null;
  tone: Tone;
  defaultDurationS: number;
  subtitleStyle: unknown;
  createdAt: string;
  updatedAt: string;
  videos?: Video[];
  _count?: { videos: number };
};

export type Video = {
  id: string;
  projectId: string;
  title: string;
  durationSeconds: number;
  status: VideoStatus;
  selectedScenarioId: string | null;
  subtitleStyleOverride: unknown;
  thumbnailPath: string | null;
  bgmPath: string | null;
  createdAt: string;
  updatedAt: string;
  project?: Project;
  scenarios?: Scenario[];
  sections?: Section[];
  renderArtifacts?: RenderArtifact[];
  renderJobs?: RenderJob[];
};

export type Scenario = {
  id: string;
  videoId: string;
  angle: ScenarioAngle;
  content: string;
  hookLine: string;
  generatedBy: LLMProvider;
  createdAt: string;
};

export type Section = {
  id: string;
  videoId: string;
  orderIndex: number;
  durationSeconds: number;
  imagePrompt: string | null;
  sourceImagePath: string | null;
  videoPrompt: string;
  scriptText: string;
  sourceVideoPath: string | null;
  sourceAudioPath: string | null;
  processedVideoPath: string | null;
  trimHistory?: TrimHistory[];
};

export type TrimHistory = {
  id: string;
  sectionId: string;
  field: TrimField;
  beforeText: string;
  afterText: string;
  userInstruction: string | null;
  llmUsed: LLMProvider;
  createdAt: string;
};

export type RenderJob = {
  id: string;
  videoId: string;
  pgBossJobId: string;
  status: RenderJobStatus;
  progressPct: number;
  currentStep: string | null;
  errorMessage: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
};

export type RenderArtifact = {
  id: string;
  videoId: string;
  version: number;
  filePath: string;
  fileSizeBytes: string;
  durationActualSeconds: number;
  renderJobId: string;
  createdAt: string;
};

export const VIDEO_STATUS_LABEL: Record<VideoStatus, string> = {
  DRAFT: '시나리오 대기',
  SCENARIOS_READY: '시나리오 선택 필요',
  SECTIONS_READY: '섹션 편집',
  TRIMMING: '편집 중',
  AWAITING_ASSETS: '자산 업로드 대기',
  RENDERING: '렌더링 중',
  DONE: '완료',
  FAILED: '실패',
};

export const ANGLE_LABEL: Record<ScenarioAngle, string> = {
  PROBLEM_SOLUTION: '문제-솔루션',
  DEMO: '데모',
  BEFORE_AFTER: 'Before / After',
  TESTIMONIAL: '사용자 후기',
  CURIOSITY_HOOK: '호기심 유발',
};

export const TONE_LABEL: Record<Tone, string> = {
  HUMOR: '유머',
  SERIOUS: '진지함',
  EMOTIONAL: '감성',
  INFORMATIVE: '정보',
};
