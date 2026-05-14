# Vibe Video

마케팅 쇼츠 반자동화 도구. 인간 개입형 워크플로우로 앱 다운로드 전환용 9:16 쇼츠를 양산.

## 구조
```
backend/        Node.js + Express + Prisma + FFmpeg
frontend/       Next.js + Tailwind (추후 추가)
```

## 빠른 시작 (backend)
```bash
cd backend
cp .env.example .env   # 값 채우기
npm install
npm run prisma:migrate
npm run dev            # API 서버
npm run worker         # 별도 터미널에서 큐 워커
```

## 워크플로우
1. 프로젝트 생성 (앱 마케팅 컨텍스트 입력)
2. 영상 생성 → AI가 2-3개 시나리오 제안 (서로 다른 마케팅 앵글)
3. 시나리오 선택 → 3-4개 섹션 + 영상 프롬프트 + 자막/대사 텍스트 자동 생성
4. Trim 루프: 섹션 텍스트 편집/재생성
5. 외부 AI 영상 서비스에서 섹션 영상 + 외부 TTS로 음성 제작 후 업로드
6. 렌더링 (FFmpeg): 9:16 정규화 + 자막 burn-in + 음성 합성 → 최종 mp4

## 산출물 저장
- 모든 영상/음성/최종 mp4는 `STORAGE_BASE_PATH` (OneDrive 권장) 하위에 저장
- 재렌더 시 버전 보존 (덮어쓰지 않음)
