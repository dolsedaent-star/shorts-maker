/**
 * 자막 스타일 — 한국 쇼츠 잘 먹히는 기본값.
 * Project.subtitle_style 및 Video.subtitle_style_override 컬럼의 구조.
 */
export type SubtitleStyle = {
  font: string;
  size_ratio: number;
  color: string;
  highlight_color: string;
  outline: { color: string; width: number };
  shadow: { color: string; offset: number };
  position_y_ratio: number;
  max_chars_per_line: number;
  entry_animation: 'word_fade_slide_up' | 'fade_in' | 'none';
  entry_duration_ms: number;
};

export const DEFAULT_SUBTITLE_STYLE: SubtitleStyle = {
  font: 'Pretendard ExtraBold',
  size_ratio: 0.07,
  color: '#FFFFFF',
  highlight_color: '#FFE600',
  outline: { color: '#000000', width: 6 },
  shadow: { color: '#000000', offset: 4 },
  position_y_ratio: 0.70,
  max_chars_per_line: 15,
  entry_animation: 'word_fade_slide_up',
  entry_duration_ms: 300,
};

/**
 * Video → Project 순으로 fallback해서 최종 적용할 스타일 산출.
 */
export function resolveSubtitleStyle(
  videoOverride: unknown,
  projectStyle: unknown
): SubtitleStyle {
  if (videoOverride && typeof videoOverride === 'object') {
    return { ...DEFAULT_SUBTITLE_STYLE, ...(videoOverride as Partial<SubtitleStyle>) };
  }
  if (projectStyle && typeof projectStyle === 'object') {
    return { ...DEFAULT_SUBTITLE_STYLE, ...(projectStyle as Partial<SubtitleStyle>) };
  }
  return DEFAULT_SUBTITLE_STYLE;
}
