import type { SubtitleStyle } from '../../lib/subtitleStyle.js';

/**
 * 섹션 타임라인 → ASS 자막 파일 문자열 생성.
 * 한 줄 max_chars_per_line 자수 초과 시 자동 줄바꿈.
 * 등장 시 fade-in 애니메이션 적용 (\fad).
 *
 * v1에서는 단어단위 하이라이트 미구현. 향후 \k 카라오케 태그로 확장 가능.
 */

const PLAY_RES_X = 1080;
const PLAY_RES_Y = 1920;

export type SubtitleSection = {
  startSec: number;
  endSec: number;
  text: string;
};

export function generateAssFile(
  sections: SubtitleSection[],
  style: SubtitleStyle,
  appName?: string
): string {
  const fontSize = Math.round(PLAY_RES_X * style.size_ratio);
  const primaryColor = hexToAssColor(style.color);
  const outlineColor = hexToAssColor(style.outline.color);
  const shadowColor = hexToAssColor(style.shadow.color);
  const ctaFontSize = Math.round(fontSize * 1.5);

  // Alignment 2 = 하단 중앙. MarginV는 하단으로부터의 픽셀 거리.
  const textCenterY = PLAY_RES_Y * style.position_y_ratio;
  const halfTextHeight = Math.round(fontSize * 0.6);
  const marginV = Math.max(20, PLAY_RES_Y - textCenterY - halfTextHeight);
  const textAlignY = PLAY_RES_Y - Math.round(marginV); // bottom-aligned text의 baseline

  const header =
    `[Script Info]\n` +
    `ScriptType: v4.00+\n` +
    `PlayResX: ${PLAY_RES_X}\n` +
    `PlayResY: ${PLAY_RES_Y}\n` +
    `WrapStyle: 2\n` +
    `ScaledBorderAndShadow: yes\n` +
    `YCbCr Matrix: TV.709\n\n` +
    `[V4+ Styles]\n` +
    `Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, ` +
    `Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, ` +
    `Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n` +
    `Style: Default,${style.font},${fontSize},${primaryColor},${primaryColor},${outlineColor},${shadowColor},` +
    `1,0,0,0,100,100,0,0,1,${style.outline.width},${style.shadow.offset},2,60,60,${Math.round(marginV)},1\n` +
    `Style: CTA,${style.font},${ctaFontSize},${primaryColor},${primaryColor},${outlineColor},${shadowColor},` +
    `1,0,0,0,100,100,0,0,1,${style.outline.width + 2},${style.shadow.offset + 2},5,0,0,0,1\n\n` +
    `[Events]\n` +
    `Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n`;

  const dialogues = sections
    .map((sec, idx) => {
      const wrapped = wrapKoreanLines(sec.text, style.max_chars_per_line)
        .map(escapeAssText)
        .join('\\N');
      const isFirst = idx === 0;
      const isLast = idx === sections.length - 1;
      const fadeMs = style.entry_duration_ms;
      let tag: string;
      if (isFirst) {
        // 첫 섹션 (후킹): 오른쪽 화면 밖에서 슬라이드 인
        tag = `{\\move(${PLAY_RES_X + 400},${textAlignY},${PLAY_RES_X / 2},${textAlignY},0,400)}`;
      } else if (isLast && !appName) {
        // 마지막 섹션 (CTA 자동 추가 안 할 때): 팝업
        tag = `{\\fscx0\\fscy0\\t(0,300,\\fscx100\\fscy100)\\fad(${fadeMs},0)}`;
      } else {
        tag = style.entry_animation === 'none' ? '' : `{\\fad(${fadeMs},0)}`;
      }
      return (
        `Dialogue: 0,${formatAssTime(sec.startSec)},${formatAssTime(sec.endSec)},Default,,0,0,0,,` +
        `${tag}${wrapped}`
      );
    })
    .join('\n');

  // CTA 자동 삽입: 마지막 섹션의 끝 1.8초 동안 화면 중앙에 큰 CTA 도장
  let ctaEvent = '';
  if (appName && sections.length > 0) {
    const last = sections[sections.length - 1];
    const ctaDur = Math.min(1.8, last.endSec - last.startSec);
    const ctaStart = last.endSec - ctaDur;
    const ctaText = `지금 ${appName} 다운받기 →`;
    ctaEvent =
      `\nDialogue: 1,${formatAssTime(ctaStart)},${formatAssTime(last.endSec)},CTA,,0,0,0,,` +
      `{\\fscx0\\fscy0\\t(0,300,\\fscx110\\fscy110)\\t(300,500,\\fscx100\\fscy100)\\fad(0,400)}${escapeAssText(ctaText)}`;
  }

  return header + dialogues + ctaEvent + '\n';
}

// ─── 헬퍼 ────────────────────────────────────────────────────────────

function formatAssTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const cs = Math.floor((seconds * 100) % 100);
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`;
}

/** #RRGGBB → ASS &HAABBGGRR (alpha=00=opaque, BGR 순서) */
function hexToAssColor(hex: string): string {
  const h = hex.replace('#', '').padEnd(6, '0');
  const r = h.slice(0, 2);
  const g = h.slice(2, 4);
  const b = h.slice(4, 6);
  return `&H00${b}${g}${r}`.toUpperCase();
}

/**
 * 한국어 텍스트 줄바꿈.
 * - 명시적 \n 우선 존중
 * - 한 줄이 maxChars 초과하면 단순 chunk 분할 (한국어는 공백 없는 경우가 많아 단어단위 분할 의미 없음)
 */
function wrapKoreanLines(text: string, maxChars: number): string[] {
  const out: string[] = [];
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;
    if (line.length <= maxChars) {
      out.push(line);
    } else {
      for (let i = 0; i < line.length; i += maxChars) {
        out.push(line.slice(i, i + maxChars));
      }
    }
  }
  return out;
}

/** ASS Dialogue Text 필드에서 깨지는 문자 escape */
function escapeAssText(s: string): string {
  return s.replace(/\{/g, '\\{').replace(/\}/g, '\\}');
}
