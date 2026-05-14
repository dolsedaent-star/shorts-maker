/**
 * 한국 쇼츠/릴스 마케팅에서 자주 쓰이는 무료 폰트 프리셋.
 * 시스템에 설치되어 있어야 ASS 자막 burn-in이 동작함.
 * 다운로드 링크 포함.
 */

export type FontPreset = {
  /** ASS Style의 Fontname 필드에 들어갈 정확한 폰트 이름 */
  family: string;
  /** UI 표시용 한글/영문 라벨 */
  label: string;
  /** 카테고리 — 어떤 용도에 맞는지 */
  vibe: '강렬' | '깔끔' | '친근' | '감성' | '재미';
  /** 폰트 다운로드 URL (사용자가 직접 설치) */
  downloadUrl: string;
  /** 짧은 설명 */
  hint: string;
};

export const FONT_PRESETS: FontPreset[] = [
  {
    family: 'Pretendard ExtraBold',
    label: 'Pretendard ExtraBold',
    vibe: '깔끔',
    downloadUrl: 'https://github.com/orioncactus/pretendard/releases',
    hint: '기본값. 모던하고 가독성 최고. 모든 용도에 OK',
  },
  {
    family: 'BlackHanSans',
    label: '검은고딕 (Black Han Sans)',
    vibe: '강렬',
    downloadUrl: 'https://fonts.google.com/specimen/Black+Han+Sans',
    hint: '극단적 굵기. 후킹/충격/긴급 메시지에 최적',
  },
  {
    family: 'Jua',
    label: '주아체 (Jua)',
    vibe: '친근',
    downloadUrl: 'https://fonts.google.com/specimen/Jua',
    hint: '둥글고 친근. 라이프스타일/생활 앱',
  },
  {
    family: 'Gmarket Sans TTF Bold',
    label: '지마켓 산스 Bold',
    vibe: '깔끔',
    downloadUrl: 'https://corp.gmarket.com/fonts/',
    hint: '커머스 친화적, 깔끔하고 신뢰감',
  },
  {
    family: 'Cafe24 Ohsquare',
    label: '카페24 아네모네',
    vibe: '강렬',
    downloadUrl: 'https://fonts.cafe24.com/',
    hint: '굵은 네모 스타일. 임팩트 컷',
  },
  {
    family: 'TmoneyRoundWindExtraBold',
    label: 'T머니 라운드윈드',
    vibe: '친근',
    downloadUrl: 'https://www.tmoney.co.kr/ko/ais/etc/tmoneyFont.dev',
    hint: '둥글둥글, 따뜻한 분위기',
  },
  {
    family: 'Single Day',
    label: '싱글데이 (Single Day)',
    vibe: '감성',
    downloadUrl: 'https://fonts.google.com/specimen/Single+Day',
    hint: '손글씨 느낌. 감성/일상 앱',
  },
  {
    family: 'Cafe24Ssurround',
    label: '카페24 써라운드',
    vibe: '재미',
    downloadUrl: 'https://fonts.cafe24.com/',
    hint: '손글씨 굵기. 통통 튀는 분위기',
  },
  {
    family: 'Diphylleia',
    label: 'Diphylleia',
    vibe: '감성',
    downloadUrl: 'https://fonts.google.com/specimen/Diphylleia',
    hint: '세리프 우아함. 뷰티/패션 카테고리',
  },
];

export function findPreset(family: string): FontPreset | undefined {
  return FONT_PRESETS.find((f) => f.family === family);
}
