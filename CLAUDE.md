# Card News Maker

카드뉴스를 자동 생성하는 에이전트 시스템. 주제만 바꿔도 일관된 품질의 카드뉴스가 나온다.

## 에이전트 구조

| 역할 | 파일 | 담당 |
|------|------|------|
| 디렉터 | `CLAUDE.md` (이 파일) | 전체 흐름 관리 |
| 리서처 | `skills/researcher.md` | 웹 검색으로 팩트 수집 |
| 플래너 | `skills/planner.md` | 슬라이드 구조/카피 기획 |
| 메이커 | `skills/maker.md` | HTML/CSS 슬라이드 제작 |

## 워크플로우

사용자가 카드뉴스 생성을 요청하면, **반드시 아래 4단계를 순서대로** 실행한다.

### STEP 0. 사전 확인

사용자에게 다음을 확인한다 (지정하지 않은 경우):

- **비율**: `1:1` (1080×1080) 또는 `4:5` (1080×1350)
- **프로젝트명**: snake_case로 `output/{project_name}/` 디렉토리 생성

### STEP 1. 리서치

`skills/researcher.md`의 규칙을 따른다.

- 웹 검색으로 주제 관련 팩트/데이터 수집
- 사용자가 자료를 직접 제공한 경우, 해당 자료를 정리
- **산출물**: `output/{project_name}/research.md` 저장

### STEP 2. 기획

`skills/planner.md`의 규칙을 따른다.

- `research.md`를 읽고 슬라이드 구조와 카피를 기획
- **산출물**: `output/{project_name}/plan.md` 저장
- 사용자에게 plan.md 내용을 보여주고 확인받는다

### STEP 3. 제작

`skills/maker.md`의 규칙을 따른다.

- `plan.md`를 읽고 각 슬라이드를 HTML 파일로 제작
- **산출물**: `output/{project_name}/html/slide_01.html`, `slide_02.html`, ...

### STEP 4. 변환

HTML 생성 완료 후, 사용자에게 변환 명령어를 안내한다:

```bash
# venv 활성화
source venv/bin/activate

# PNG 변환
python convert.py {project_name} --ratio {비율}

# 고해상도가 필요한 경우
python convert.py {project_name} --ratio {비율} --scale 2
```

## 핵심 원칙

- **각 단계의 산출물을 반드시 파일로 저장**한다 (research.md → plan.md → slide_*.html)
- 단계를 건너뛰지 않는다
- plan.md 확인 후 사용자가 수정을 요청하면 plan.md를 수정하고 STEP 3를 다시 실행한다
- 각 스킬 파일의 규칙을 엄격히 따른다
