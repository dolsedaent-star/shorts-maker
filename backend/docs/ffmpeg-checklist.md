# FFmpeg 코덱 오류 방지 체크리스트

Vibe Video 파이프라인에서 실제로 발생하는 코덱/concat/자막 오류를 카테고리별로 정리. 각 항목은 **증상 → 원인 → 우리 코드의 대응**.

---

## 1. Pre-flight (FFmpeg 실행 전)

- [ ] **FFmpeg 바이너리 존재 확인**
  - 증상: `Cannot find ffmpeg`, `spawn ENOENT`
  - 원인: PATH에 ffmpeg 없거나 Windows 설치 후 PATH 갱신 안 됨
  - 대응: `.env`의 `FFMPEG_PATH=C:/ffmpeg/bin/ffmpeg.exe` 절대경로 지정 (env.ts 참고)
- [ ] **ffprobe도 같은 위치**
  - `FFPROBE_PATH` 별도 지정. fluent-ffmpeg는 둘 다 필요
- [ ] **libx264 / libfdk_aac 또는 native AAC 활성화 빌드인지 확인**
  - 증상: `Unknown encoder 'libx264'`
  - 원인: 일부 LGPL 빌드는 x264 제외됨 (Windows gyan.dev 빌드 권장)
  - 검증: `ffmpeg -encoders | findstr "x264 aac"`
- [ ] **자막 burn-in용 libass 포함 빌드**
  - 증상: `No such filter: 'subtitles'`
  - 검증: `ffmpeg -filters | findstr subtitles`
- [ ] **한글 폰트 시스템에 설치**
  - 증상: ASS 자막에 한글이 □□로 표시
  - 원인: libass가 시스템 폰트에서 찾는데 Pretendard 미설치
  - 대응: Pretendard ExtraBold를 `C:/Windows/Fonts/` 에 설치 (또는 fontconfig 경로 설정)

---

## 2. 섹션 정규화 (normalize.ts)

- [ ] **scale 필터에 `force_original_aspect_ratio` 명시**
  - 빠뜨리면: 비율이 강제로 늘어남 → 사람 얼굴이 가로로 늘어진 영상
  - 우리 코드: `force_original_aspect_ratio=decrease` (main) / `increase` (블러 bg) 두 번 명시
- [ ] **pix_fmt를 명시적으로 `yuv420p`로**
  - 빠뜨리면: yuv444p 같은 포맷이 출력되어 모바일/SNS 플레이어에서 재생 불가
  - 우리 코드: 필터 끝에 `format=yuv420p`, 출력 옵션에도 `-pix_fmt yuv420p` 이중 안전
- [ ] **fps 통일 (30fps)**
  - 빠뜨리면: 입력이 24fps/60fps 혼재 시 concat 후 PTS 점프
  - 우리 코드: 필터 끝에 `fps=30`
- [ ] **SAR(Sample Aspect Ratio) = 1**
  - 빠뜨리면: 일부 입력의 비정방형 픽셀 때문에 출력이 비뚤어짐
  - 우리 코드: `setsar=1`
- [ ] **profile/level 고정 (`high` / `4.0`)**
  - 빠뜨리면: 일부 구형 모바일에서 디코딩 실패
  - 우리 코드: `-profile:v high -level 4.0`
- [ ] **`-movflags +faststart`**
  - 빠뜨리면: 웹 스트리밍 시 메타데이터가 끝에 있어 첫 재생 지연
- [ ] **오디오 트랙 제거 (`-an`)**
  - 정규화 단계에서는 영상만. 음성은 별도 concat 후 mux
- [ ] **`-t {duration}`으로 정확히 자르기**
  - 사용자가 업로드한 영상이 섹션 길이보다 길 수 있음 → 강제 컷

---

## 3. Concat demuxer (영상 합치기)

> **모든 입력이 동일한 codec / resolution / fps / pix_fmt / SAR / time_base이어야 함**. 우리는 2단계에서 이미 통일했으므로 `-c copy` 가능.

- [ ] **concat 파일 형식**
  - 각 줄: `file 'path/to/file.mp4'`
  - 경로는 **항상 작은따옴표로 감쌈**. 작은따옴표 자체는 `\'`로 escape
  - Windows 백슬래시 → 슬래시로 변환 (`C:\foo` → `C:/foo`)
  - 우리 코드: `toConcatPath()` 헬퍼
- [ ] **`-safe 0` 옵션**
  - 절대경로/특수문자 경로 허용. 빠뜨리면 `Unsafe file name` 에러
- [ ] **`-c copy` 가능 여부 사전 검증**
  - 정규화 출력이 모두 동일한 spec이라 OK. 만약 한 섹션이라도 다르면 `Non-monotonous DTS` 에러 → 재인코딩 필요
  - 의심되면 `-c:v libx264 -c:a aac`로 fallback
- [ ] **concat demuxer vs concat protocol vs concat filter 혼동 금지**
  - 우리는 **demuxer** (`-f concat -safe 0 -i list.txt`)
  - protocol(`concat:a.mp4|b.mp4`)은 MPEG-TS만 동작
  - filter(`concat=n=2:v=1:a=1`)는 입력별 디코딩 필요해서 느림. 우리 케이스엔 불필요

---

## 4. 오디오 concat + mux

- [ ] **오디오 입력 포맷이 다양** (사용자가 다른 TTS 도구에서 만들어 옴)
  - mp3 / wav / m4a / ogg / webm 등 혼재 가능
  - `-c copy`로 합치면 컨테이너 충돌. **재인코딩 필수**
  - 우리 코드: `-c:a aac -b:a 192k -ar 44100 -ac 2`로 통일
- [ ] **샘플레이트 통일 (44100Hz)**
  - 안 하면 mux 시 lipsync drift
- [ ] **채널 수 통일 (stereo)**
  - mono 입력을 그대로 mux하면 한쪽 스피커에서만 들림
- [ ] **음성-섹션 길이 매칭 검증 (옵션 C 정책)**
  - 우리 코드: `probeAudio()`로 길이 측정 → ±0.5초 초과 시 명확한 에러
  - 자동 stretch 안 함. 사용자가 외부에서 다시 만들어 올리도록 유도
- [ ] **최종 mux 시 `-shortest`**
  - 비디오/오디오 길이 미세 차이 시 짧은 쪽 기준으로 자름

---

## 5. 자막 burn-in (libass + subtitles 필터)

- [ ] **Windows 경로 escape**
  - 증상: `Unable to open 'C:\path\file.ass'`
  - 원인: subtitles 필터는 콜론을 옵션 구분자로 해석함
  - 대응: `C:\foo\file.ass` → `'C\:/foo/file.ass'`
    - 백슬래시 → 슬래시
    - 콜론 → `\:`
    - 전체를 작은따옴표로 감쌈
  - 우리 코드: `escapeSubtitlesPath()` 헬퍼
- [ ] **ASS 파일 인코딩은 UTF-8 (BOM 없음)**
  - PowerShell의 `Out-File`은 UTF-16 LE BOM이 기본 → libass가 못 읽음
  - Node `fs.writeFile(path, content, 'utf-8')` 사용 (우리 코드 OK)
- [ ] **ASS 색상은 BGR 순서**
  - RGB로 쓰면 빨강↔파랑 뒤바뀜
  - 우리 코드: `hexToAssColor()` 헬퍼가 변환
- [ ] **MarginV는 하단 기준, Alignment 2 (bottom-center) 사용 시**
  - position_y_ratio 0.7 → MarginV = (1-0.7) * 1920 - halfTextHeight ≈ 530px
- [ ] **드라이브 외 다른 파티션(USB/네트워크)에 있는 자막**
  - OneDrive 네트워크 드라이브의 경우 동기 지연으로 파일이 아직 나타나지 않을 수 있음
  - 자막 파일은 **로컬 임시 디렉토리 또는 같은 video 작업 폴더 안에 두기** (우리는 후자)
- [ ] **WrapStyle 설정**
  - WrapStyle: 2 = 줄바꿈 안 함 (우리가 직접 \N으로 줄 나눔)
  - 0 = 자동 줄바꿈 — 한국어는 단어 단위 처리가 부적절하므로 사용 X
- [ ] **ScaledBorderAndShadow: yes**
  - 해상도 따라 외곽선/그림자 비율 유지
- [ ] **fontconfig 캐시 누락**
  - 첫 실행 시 `Fontconfig error: Cannot load default config file` 경고는 무시 가능
  - 단, 한글 폰트를 system font로 찾을 수 있어야 함

---

## 6. 출력 호환성 (모바일/SNS 플레이어)

- [ ] **컨테이너: mp4** (mov 아님)
- [ ] **비디오 코덱: H.264 (libx264)**
- [ ] **오디오 코덱: AAC**
- [ ] **profile: high, level: 4.0** (1080p 30fps 안전)
- [ ] **pix_fmt: yuv420p**
- [ ] **CRF 18-22** (마케팅 쇼츠 권장: 20)
- [ ] **GOP 사이즈** — 기본값으로 충분. 굳이 명시할 필요 없음
- [ ] **B-frames** — libx264 기본값 안전. iOS 일부 구버전 이슈 있으면 `-bf 0` 추가
- [ ] **`-movflags +faststart`** — 웹 스트리밍 시 첫 재생 지연 제거

---

## 7. Windows 특수 사항

- [ ] **경로 백슬래시 vs 슬래시**
  - fluent-ffmpeg에 input/output으로 줄 때는 양쪽 다 OK
  - concat list 파일 안: 슬래시 권장
  - subtitles 필터 인자: 슬래시 + 콜론 escape 필수
- [ ] **공백 포함 경로** (예: `C:/Users/dolse/OneDrive - Personal/`)
  - 명령 인자로 넘길 때 자동으로 quoting 되어야 함
  - fluent-ffmpeg는 알아서 처리. shell-out 직접 할 때만 주의
- [ ] **OneDrive 동기 지연**
  - 영상 생성 직후 OneDrive가 아직 동기화 중일 수 있음
  - 다음 단계 진입 전 `fs.stat()` 으로 파일 존재 확인 권장
- [ ] **Anti-virus 스캔으로 인한 일시 lock**
  - 큰 파일 쓰기 직후 즉시 읽으면 `EBUSY` 가능 — 1회 재시도 로직 권장
- [ ] **장기 실행 시 OneDrive 클라우드 전환 (`reparse point`)**
  - 오래된 파일이 클라우드로 옮겨져 로컬에 없으면 읽기 지연 발생
  - Vibe Video 작업 폴더는 OneDrive "이 PC에 항상 유지" 설정 권장

---

## 8. 디버깅 명령어 (실패 시 사용)

```bash
# 입력 파일의 메타 전부
ffprobe -v error -show_format -show_streams input.mp4

# 비디오 스트림만 간단히
ffprobe -v error -select_streams v:0 -show_entries stream=width,height,codec_name,r_frame_rate,pix_fmt,sample_aspect_ratio input.mp4

# 오디오 스트림만 간단히
ffprobe -v error -select_streams a:0 -show_entries stream=codec_name,sample_rate,channels,duration input.m4a

# concat list 검증 (각 파일 한 줄씩 probe)
for /f "delims=" %i in (_concat-video.txt) do ffprobe -v error %i

# 필터 그래프 단독 테스트 (output 안 만들고 dry-run)
ffmpeg -i in.mp4 -vf "scale=1080:1920:force_original_aspect_ratio=decrease" -f null -

# 자막 필터 단독 테스트
ffmpeg -i in.mp4 -vf "subtitles='C\:/path/to/file.ass'" -t 3 -y test-sub.mp4
```

---

## 9. 우리 코드 구조 매핑

| 단계 | 파일 | 위 체크리스트 항목 |
|---|---|---|
| 정규화 | `services/ffmpeg/normalize.ts` | §2 전체 |
| 자막 생성 | `services/ffmpeg/subtitles.ts` | §5 전체 |
| 최종 렌더 | `services/ffmpeg/render.ts` | §3, §4, §5(burn), §6 |
| 경로 처리 | `services/ffmpeg/render.ts` (`toConcatPath`, `escapeSubtitlesPath`) | §3, §5, §7 |
| 자산 검증 | `services/ffmpeg/render.ts` (자산 검증 블록) | §4 길이 매칭 |

장애가 나면 위 표에서 어느 파일을 의심할지 바로 알 수 있도록 구성됨.
