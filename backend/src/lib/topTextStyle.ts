/**
 * Type 2 (TOP_TEXT_BAND) 영상의 상단 텍스트 영역 스타일.
 * 기본값은 한국 쇼츠 표준 (검정 띠 + 노란 line1 + 흰 line2 + 도현체 굵은 폰트).
 * 추후 해외 스타일 등을 위해 Video.topTextStyle(jsonb)로 override 가능.
 */
export type TopTextStyle = {
  font: string;          // ASS 폰트명 (시스템 설치 필요)
  size: number;          // 폰트 픽셀 크기
  line1Color: string;    // line1 색상 (#RRGGBB)
  line2Color: string;    // line2 색상
  bandHeight: number;    // 상단 검정 띠 높이 (px)
  bandColor: string;     // 띠 배경색 (#RRGGBB)
  paddingTop: number;    // 띠 상단에서 line1까지 여백
  lineGap: number;       // line1과 line2 사이 여백
  outlineWidth: number;  // 텍스트 외곽선
  shadowOffset: number;  // 그림자
};

export const DEFAULT_TOP_TEXT_STYLE: TopTextStyle = {
  font: 'BM Dohyeon',     // 배민 도현체 (사용자 PC에 설치되어 있어야 함)
  size: 92,
  line1Color: '#FFD000',  // 골든 옐로우
  line2Color: '#FFFFFF',  // 흰색
  bandHeight: 420,        // 1080x1920 기준 ~22%
  bandColor: '#000000',
  paddingTop: 70,
  lineGap: 30,
  outlineWidth: 4,
  shadowOffset: 4,
};

export function resolveTopTextStyle(override: unknown): TopTextStyle {
  if (override && typeof override === 'object') {
    return { ...DEFAULT_TOP_TEXT_STYLE, ...(override as Partial<TopTextStyle>) };
  }
  return DEFAULT_TOP_TEXT_STYLE;
}
