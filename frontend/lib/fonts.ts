/**
 * 한국 쇼츠/릴스 마케팅에서 자주 쓰이는 무료 폰트 프리셋.
 * 시스템에 설치되어 있어야 ASS 자막 burn-in이 동작함.
 * 다운로드 링크 포함.
 */

export type FontPreset = {
  /** ASS Style의 Fontname 필드에 들어갈 정확한 폰트 이름 (Windows에 설치된 폰트명) */
  family: string;
  /** UI 표시용 한글/영문 라벨 */
  label: string;
  /** 카테고리 — 어떤 용도에 맞는지 */
  vibe: '강렬' | '깔끔' | '친근' | '감성' | '재미';
  /** 폰트 다운로드 URL (사용자가 직접 설치) */
  downloadUrl: string;
  /** 짧은 설명 */
  hint: string;
  /**
   * UI 미리보기용 CSS font-family (CDN으로 로드되는 웹폰트명).
   * 실제 영상 렌더링은 family를 ASS로 보내고 Windows 설치 폰트 사용.
   * 생략하면 family 그대로 사용.
   */
  previewFamily?: string;
};

export const FONT_PRESETS: FontPreset[] = [
  {
    family: 'BM Dohyeon',
    label: '배민 도현체',
    vibe: '강렬',
    downloadUrl: 'https://www.woowahan.com/fonts',
    hint: '한국 쇼츠 상단 타이틀 최강자. 굵고 임팩트.',
    previewFamily: 'Do Hyeon',
  },
  {
    family: 'Pretendard ExtraBold',
    label: 'Pretendard ExtraBold',
    vibe: '깔끔',
    downloadUrl: 'https://github.com/orioncactus/pretendard/releases',
    hint: '기본값. 모던하고 가독성 최고. 모든 용도에 OK',
    previewFamily: 'PreviewPretendardExtraBold',
  },
  {
    family: 'BlackHanSans',
    label: '검은고딕 (Black Han Sans)',
    vibe: '강렬',
    downloadUrl: 'https://fonts.google.com/specimen/Black+Han+Sans',
    hint: '극단적 굵기. 후킹/충격/긴급 메시지에 최적',
    previewFamily: 'Black Han Sans',
  },
  {
    family: 'Jalnan',
    label: '잘난체 (Jalnan)',
    vibe: '강렬',
    downloadUrl: 'https://campaign.naver.com/clovaaifont/',
    hint: '거친 손맛 + 굵기. 호기심 자극 / 충격 후킹',
    previewFamily: 'PreviewJalnan',
  },
  {
    family: 'Jua',
    label: '주아체 (Jua)',
    vibe: '친근',
    downloadUrl: 'https://fonts.google.com/specimen/Jua',
    hint: '둥글고 친근. 라이프스타일/생활 앱',
    previewFamily: 'Jua',
  },
  {
    family: 'Gmarket Sans TTF Bold',
    label: '지마켓 산스 Bold',
    vibe: '깔끔',
    downloadUrl: 'https://corp.gmarket.com/fonts/',
    hint: '커머스 친화적, 깔끔하고 신뢰감',
    previewFamily: 'PreviewGmarketBold',
  },
  {
    family: 'Cafe24 Ohsquare',
    label: '카페24 아네모네',
    vibe: '강렬',
    downloadUrl: 'https://fonts.cafe24.com/',
    hint: '굵은 네모 스타일. 임팩트 컷',
    previewFamily: 'PreviewCafe24Ohsquare',
  },
  {
    family: 'TmoneyRoundWindExtraBold',
    label: 'T머니 라운드윈드',
    vibe: '친근',
    downloadUrl: 'https://www.tmoney.co.kr/ko/ais/etc/tmoneyFont.dev',
    hint: '둥글둥글, 따뜻한 분위기',
    previewFamily: 'PreviewTmoneyRoundWind',
  },
  {
    family: 'Single Day',
    label: '싱글데이 (Single Day)',
    vibe: '감성',
    downloadUrl: 'https://fonts.google.com/specimen/Single+Day',
    hint: '손글씨 느낌. 감성/일상 앱',
    previewFamily: 'Single Day',
  },
  {
    family: 'Cafe24Ssurround',
    label: '카페24 써라운드',
    vibe: '재미',
    downloadUrl: 'https://fonts.cafe24.com/',
    hint: '손글씨 굵기. 통통 튀는 분위기',
    previewFamily: 'PreviewCafe24Ssurround',
  },
  {
    family: 'Diphylleia',
    label: 'Diphylleia',
    vibe: '감성',
    downloadUrl: 'https://fonts.google.com/specimen/Diphylleia',
    hint: '세리프 우아함. 뷰티/패션 카테고리',
    previewFamily: 'Diphylleia',
  },
];

export function findPreset(family: string): FontPreset | undefined {
  return FONT_PRESETS.find((f) => f.family === family);
}

/** 미리보기용 CSS font-family 문자열 — 폰트 없으면 시스템 sans-serif 폴백 */
export function previewFontStack(preset: FontPreset | string): string {
  const family = typeof preset === 'string' ? preset : (preset.previewFamily ?? preset.family);
  return `"${family}", "Apple SD Gothic Neo", "Malgun Gothic", sans-serif`;
}
