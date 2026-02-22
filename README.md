# Card News Maker

주제만 입력하면 카드뉴스를 자동 생성하는 Claude Code 에이전트 시스템.

리서치 → 기획 → HTML 제작 → PNG 변환까지 전 과정을 멀티에이전트가 처리한다.

## 구조

```
cardnews-maker/
├── CLAUDE.md              # 디렉터 에이전트 (전체 흐름 관리)
├── skills/
│   ├── researcher.md      # 리서처 — 웹 검색으로 팩트 수집
│   ├── planner.md         # 플래너 — 슬라이드 구조/카피 기획
│   └── maker.md           # 메이커 — HTML/CSS 슬라이드 제작
├── convert.py             # HTML → PNG 변환 스크립트
├── requirements.txt
└── output/
    └── {project_name}/
        ├── research.md    # 리서치 결과
        ├── plan.md        # 슬라이드 기획
        ├── html/          # 슬라이드 HTML 파일
        └── images/        # 변환된 PNG 파일
```

## 설치

```bash
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
playwright install chromium
```

## 사용법

### 1. 카드뉴스 생성

Claude Code에서 주제를 입력하면 자동으로 4단계를 실행한다:

1. **리서치** — 웹 검색으로 팩트/데이터 수집 → `research.md`
2. **기획** — 슬라이드 구조와 카피 작성 → `plan.md`
3. **제작** — HTML/CSS 슬라이드 생성 → `html/slide_*.html`
4. **변환** — PNG 이미지로 변환 → `images/slide_*.png`

### 2. PNG 변환

```bash
source venv/bin/activate

# 기본 변환
python convert.py {project_name} --ratio {1:1|4:5}

# 고해상도 (2x)
python convert.py {project_name} --ratio {1:1|4:5} --scale 2
```

### 지원 비율

| 비율 | 해상도 | 용도 |
|------|--------|------|
| `1:1` | 1080 x 1080 | 인스타그램 피드 (정사각형) |
| `4:5` | 1080 x 1350 | 인스타그램 피드 (세로형) |
