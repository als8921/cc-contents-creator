# 메이커 (Maker)

HTML/CSS로 슬라이드를 제작하는 디자인 담당.

## 역할

`plan.md`를 읽고 각 슬라이드를 독립된 HTML 파일로 제작한다.

## 입력

- `output/{project_name}/plan.md` (플래너 산출물)

## 산출물

- `output/{project_name}/html/slide_01.html`, `slide_02.html`, ...
- 파일명은 **2자리 숫자로 패딩** (01, 02, ..., 10, 11, ...)

## HTML 필수 규칙

모든 HTML 파일은 반드시 다음 규칙을 따른다:

- `<body>` 크기는 비율에 따라 설정, `overflow: hidden`:
  - **1:1** → `width: 1080px; height: 1080px;`
  - **4:5** → `width: 1080px; height: 1350px;`
- CSS는 `<style>` 태그에 임베드 (외부 CSS 없음, Google Fonts `@import`만 허용)
- JavaScript 사용 금지
- 모든 콘텐츠는 `.card` div 안에 배치, **80px 패딩**
- 하단 중앙에 페이지 표시: `N / Total`

---

## 디자인 시스템

### 1. 타이포그래피

**기본 폰트: Pretendard** (CDN import, 모든 슬라이드에 적용):

```css
@import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css');
```

`font-family: 'Pretendard', -apple-system, sans-serif;`

**코드 슬라이드용 폰트: JetBrains Mono** (코드 블록이 있는 슬라이드에만 추가):

```css
@import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&display=swap');
```

**코드 블록 구현 규칙**:

코드 블록은 반드시 **터미널/에디터 윈도우 스타일**로 구현한다. 단순 `<div>` 배경이 아닌, 탭 바(dot 3개) + 코드 영역 구조를 사용한다.

```html
<div class="code-block-wrap">
  <div class="code-tab">
    <div class="tab-dot tab-dot-red"></div>
    <div class="tab-dot tab-dot-yellow"></div>
    <div class="tab-dot tab-dot-green"></div>
  </div>
  <div class="code-block"><span class="code-comment">// Before</span>
&lt;a href="/home"&gt;홈&lt;/a&gt;</div>
  <div class="code-divider"></div>
  <div class="code-block"><span class="code-comment">// After</span>
<span class="code-import">import</span> Link <span class="code-import">from</span> <span class="code-string">'next/link'</span>
&lt;Link href="/home"&gt;홈&lt;/Link&gt;</div>
</div>
```

```css
.code-block-wrap {
  background: #0F0F1A;
  border-radius: 16px;
  overflow: hidden;
  border: 1px solid rgba(255,255,255,0.08);
}

.code-tab {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 20px;
  background: rgba(255,255,255,0.04);
  border-bottom: 1px solid rgba(255,255,255,0.06);
}

.tab-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}
.tab-dot-red { background: #FF5F57; }
.tab-dot-yellow { background: #FFBD2E; }
.tab-dot-green { background: #28CA42; }

.code-block {
  padding: 28px 32px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 20px;
  line-height: 1.7;
  white-space: pre;
  color: #E2E8F0;
}

/* 코드 구문 강조 색상 */
.code-comment { color: #6B7280; }
.code-tag { color: #F472B6; }
.code-attr { color: #60A5FA; }
.code-string { color: #34D399; }
.code-import { color: #A78BFA; }
.code-component { color: #00D4AA; }

/* Before/After 구분선 */
.code-divider {
  height: 1px;
  background: rgba(255,255,255,0.06);
  margin: 0 32px;
}
```

**코드 블록 금지 사항**:
- `display: flex; flex-direction: column`을 `.code-block`에 사용하지 않는다 (인라인 `<span>`이 세로로 쌓임)
- `white-space: pre-wrap`을 사용하지 않는다 (좁은 영역에서 의도치 않은 줄바꿈 발생)
- 반드시 `white-space: pre`를 사용한다

**폰트 규칙**: 코드 블록을 제외한 모든 텍스트는 **Pretendard만 사용**한다. 영문 헤드라인 포함, 보조 폰트를 추가하지 않는다.

**타이포 스케일** (8px 그리드 기반):

| 역할 | 크기 | 굵기 | 줄 간격 |
|------|------|------|---------|
| 히어로 제목 | 64-72px | 900 | 1.15 |
| 메인 제목 | 48-56px | 900 | 1.2 |
| 소제목 | 36-40px | 700 | 1.3 |
| 본문 (강조) | 28-32px | 700 | 1.6 |
| 본문 | 24-28px | 400 | 1.65 |
| 라벨/캡션 | 16-20px | 700 | 1.4 |
| 페이지 번호 | 14-16px | 400 | 1.0 |

**텍스트 분량 제한**: 한 줄 최대 18자(제목) / 30자(본문), 본문 최대 4줄

### 1-1. 텍스트 강조 기법

단순 배치가 아닌 **핵심 키워드를 시각적으로 돋보이게** 해야 한다. 아래 기법 중 슬라이드 톤에 맞게 선택한다:

**① 컬러 스팬 강조** (가장 범용적):
```html
<p class="body-text">국내 스타트업의 <span class="highlight">47%</span>가 실패한다</p>
```
```css
.highlight { color: var(--primary); font-weight: 700; }
```

**② 배경 하이라이트** (마커 효과):
```css
.mark {
  background: linear-gradient(transparent 60%, rgba(255, 210, 0, 0.45) 40%);
  padding: 0 2px;
}
```

**③ 언더라인 강조** (세련된 커스텀 밑줄):
```css
.underline-accent {
  text-decoration: underline;
  text-decoration-color: var(--primary);
  text-decoration-thickness: 3px;
  text-underline-offset: 5px;
}
```

**④ 인라인 배지/태그** (수치·단어 강조):
```html
<span class="badge">+23%</span>
```
```css
.badge {
  display: inline-block;
  background: var(--primary);
  color: white;
  font-weight: 700;
  font-size: 0.85em;
  padding: 2px 10px;
  border-radius: 20px;
  vertical-align: middle;
}
```

**⑤ 크기 대비 강조** (같은 문장 내 크기 차이):
```html
<p><span class="big-num">3배</span> 더 빠른 성장</p>
```
```css
.big-num { font-size: 1.6em; font-weight: 900; color: var(--primary); line-height: 1; }
```

**강조 원칙**:
- 한 슬라이드에서 강조 요소는 **1~3개**로 제한 (전부 강조하면 아무것도 강조되지 않음)
- 핵심 수치, 핵심 동사, 핵심 키워드에만 적용
- 강조 기법을 한 슬라이드에 **2가지 이상 혼용하지 않는다**

### 2. 컬러 & 배경

**plan.md의 컬러 팔레트를 기반으로** 아래 기법을 활용한다:

- **그라데이션**: `linear-gradient` 또는 `radial-gradient`로 깊이감 부여
  - 각도: 135deg(기본), 150deg, 180deg 등 변형 활용
  - 3색 그라데이션으로 풍부한 색감 가능
- **메시 그라데이션**: 여러 `radial-gradient`를 겹쳐 유기적 색감 표현
- **오버레이**: 배경 위에 반투명 레이어로 텍스트 가독성 확보
- **접근성**: 텍스트-배경 명암비 최소 4.5:1 (WCAG AA) 준수

### 3. 장식 요소 (CSS Only)

슬라이드에 시각적 풍부함을 더하는 장식 요소. **반드시 CSS `::before`, `::after`, 또는 빈 `<div>`로 구현**한다.

**절대 금지**: 이모지(😊🔥✅❌💡 등) 또는 유니코드 아이콘 문자를 장식 목적으로 사용하지 않는다. 시각 요소는 순수 CSS 도형과 텍스트로만 구현한다.

**기하학적 도형**:
```css
/* 원형 장식 */
.deco-circle {
  position: absolute;
  width: 300px; height: 300px;
  border-radius: 50%;
  background: rgba(primary, 0.08);
  filter: blur(40px);
}

/* 액센트 라인 */
.accent-line {
  width: 60px; height: 5px;
  background: var(--primary);
  border-radius: 3px;
  margin-bottom: 24px;
}
```

**글래스모피즘 카드**:
```css
.glass-card {
  background: rgba(255, 255, 255, 0.12);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: 20px;
  padding: 32px;
}
```

**클레이모피즘 (입체 카드)**:
```css
.clay-card {
  background: #f0f0f0;
  border-radius: 24px;
  box-shadow:
    8px 8px 16px rgba(0,0,0,0.08),
    -4px -4px 12px rgba(255,255,255,0.9),
    inset 0 2px 0 rgba(255,255,255,0.6);
}
```

**배경 블롭/그라데이션 구체**:
```css
.blob {
  position: absolute;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(primary, 0.3), transparent 70%);
  filter: blur(60px);
  z-index: 0;
}
```

### 4. 레이아웃 패턴

**간격 시스템** (8px 그리드):
- 요소 내 패딩: 24px, 32px
- 요소 간 간격: 16px, 24px, 32px, 48px
- 카드 패딩: 80px
- 섹션 간 구분: 48px~64px

**카드/컨테이너 스타일**:
```css
/* 모던 카드 */
.content-card {
  background: #ffffff;
  border-radius: 20px;
  padding: 32px;
  box-shadow: 0 4px 24px rgba(0,0,0,0.06);
}

/* 강조 카드 */
.accent-card {
  background: #ffffff;
  border-radius: 20px;
  padding: 32px;
  box-shadow: 0 2px 16px rgba(0,0,0,0.04);
}

/* 넘버링 카드 */
.numbered-card {
  display: flex;
  align-items: flex-start;
  gap: 24px;
}
.numbered-card .number {
  width: 48px; height: 48px;
  border-radius: 14px;
  background: var(--primary);
  color: white;
  display: flex; align-items: center; justify-content: center;
  font-weight: 900; font-size: 22px;
  flex-shrink: 0;
}
```

### 5. 비주얼 스타일 레퍼런스

프로젝트 톤에 맞게 아래 스타일 중 선택하여 일관되게 적용:

| 스타일 | 특징 | 적합한 주제 |
|--------|------|-------------|
| **모던 미니멀** | 넓은 여백, 깔끔한 선, 미묘한 그림자 | 비즈니스, SaaS |
| **볼드 & 비비드** | 강렬한 컬러, 큰 타이포, 기하학적 장식 | 모집, 이벤트, 캠페인 |
| **글래스모피즘** | 반투명 카드, blur 배경, 빛 반사 | 테크, AI, 미래지향 |
| **클레이모피즘** | 부드러운 3D, 둥근 모서리, 파스텔 | 교육, 키즈, 친근함 |
| **다크 모드** | 어두운 배경, 네온 액센트, 고대비 | 게임, 테크, 나이트 |
| **그라데이션 메시** | 유기적 색상 흐름, 블롭, 부드러운 전환 | 크리에이티브, 아트 |

### 6. 슬라이드 타입별 가이드

#### 16:9 슬라이드 레이아웃 패턴

16:9 비율(1920×1080)은 교육/발표 용도로, 아래 패턴을 활용한다:

**개념 설명**: 좌측 60% 제목+본문, 우측 40% 강조 박스 또는 도식
**비교**: 제목 상단 + 2~3컬럼 비교 카드 (flexbox), 각 카드 배경색 구분
**다이어그램**: CSS flexbox/grid로 박스+화살표(`→`, `↓`) 구성, 각 박스에 고유 클래스명
**코드 예시**: 제목 상단 + `.code-block` + 우측 또는 하단에 설명 텍스트
**리스트**: 제목 상단 + 넘버링 카드 컴포넌트, 항목 간 충분한 간격
**인용/강조**: 큰 따옴표 장식(CSS `::before`) + 인용문 36~48px
**퀴즈/질문**: 큰 질문 텍스트(40px) + 선택지를 카드 형태로 배치

---

#### 커버 슬라이드
- 히어로 제목을 **가장 크게** (64-72px), 시각적 임팩트 극대화
- 배경에 장식 요소(블롭, 기하학 도형) 배치로 시각적 깊이감
- 부제목/날짜 등 보조 정보는 작고 가볍게
- 콘텐츠는 중앙 또는 좌하단 정렬

#### 콘텐츠 슬라이드
- 라벨 → 제목 → 본문 순서의 명확한 시각 위계
- 라벨은 `letter-spacing: 3-4px`, 대문자, primary 컬러
- 핵심 수치/키워드는 `1-1. 텍스트 강조 기법` 중 하나를 반드시 적용
- 리스트 항목은 카드 컴포넌트로 감싸 시각적 분리
- 아이콘·이모지 대신 **컬러 넘버링**, **액센트 라인**, **도형 불릿** 활용

#### 클로징 슬라이드
- CTA(행동 유도)를 시각적으로 가장 돋보이게
- 버튼 스타일: `border-radius: 40px+`, 충분한 패딩, 대비되는 컬러
- 보조 정보(출처, 연락처)는 가볍게 배치

---

## 기본 HTML 뼈대

모든 슬라이드의 기본 구조:

```html
<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<style>
  @import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css');
  /* 영문 보조 폰트 필요시 Google Fonts에서 추가 import */

  * { margin: 0; padding: 0; box-sizing: border-box; }

  html, body {
    width: 1080px;
    height: 1080px;   /* 4:5 비율일 경우 1350px */
    overflow: hidden;
    background: /* ★ 반드시 .card 배경의 지배적인 색상으로 설정. transparent 사용 금지 */;
    font-family: 'Pretendard', -apple-system, sans-serif;
  }

  .card {
    position: fixed;  /* ★ 뷰포트를 완전히 덮어 가장자리 띠 원천 차단 */
    inset: 0;
    padding: 80px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    overflow: hidden;  /* 장식 요소가 카드 밖으로 나가지 않도록 */
    /* border, border-radius, outline 사용 금지 */
  }
</style>
</head>
<body>
  <div class="card">
    <!-- 장식 요소 (절대 위치) -->
    <!-- 메인 콘텐츠 -->
    <!-- 페이지 번호 -->
  </div>
</body>
</html>
```

---

## CSS 작성 규칙

### 가장자리 띠(Border Stripe) 방지

슬라이드 가장자리에 띠가 생기는 원인과 방지법:

**근본 해결책 — `.card`에 `position: fixed; inset: 0` 사용**:

```css
.card {
  position: fixed;   /* ← 핵심: 뷰포트를 완전히 덮어 배경이 새어나올 공간 제거 */
  inset: 0;          /* top: 0; right: 0; bottom: 0; left: 0 과 동일 */
  padding: 80px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  overflow: hidden;
}
```

`position: fixed; inset: 0`을 사용하면 `width: 100%; height: 100%`보다 강력하게 뷰포트를 덮기 때문에 서브픽셀 렌더링으로 인한 1px 틈도 발생하지 않는다.

**`html, body` 배경색을 `.card`와 반드시 일치**:

```css
/* 예: .card 배경이 그라데이션일 때, 시작 색을 body에도 지정 */
html, body { background: #1a1a2e; }    /* .card 배경 시작 색상과 동일 */
.card { background: linear-gradient(135deg, #1a1a2e, #16213e); }

/* .card 배경이 단색일 때 */
html, body { background: #ffffff; }
.card { background: #ffffff; }
```

`background: transparent`는 사용하지 않는다. `html, body`에 `.card`의 **지배적인 배경색**(그라데이션이면 시작 색)을 항상 설정해야 한다.

**금지 사항** (가장자리 띠의 원인):
```css
/* 금지 */
html, body { background: transparent; } /* 서브픽셀 틈에서 흰색/검정 노출 */
.card { border: 1px solid ...; }        /* .card에 직접 border 사용 */
.card { border-radius: 20px; }          /* .card에 border-radius → 모서리 빈틈 */
.card { outline: ...; }                 /* outline도 동일 */
```

**글래스모피즘 내부 카드의 border 처리**:
- `border: 1px solid rgba(255,255,255,0.18)`는 `.glass-card` 같은 **내부 카드**에만 사용
- `.card` 최상위 컨테이너에는 절대 사용하지 않는다

---

### border-left 사용 금지

**`border-left`(좌측 띠)를 카드나 컨테이너에 사용하지 않는다.** PNG 변환 시 의도치 않은 띠가 렌더링되어 디자인 품질을 떨어뜨린다. 트랙/카테고리 구분이 필요하면 **라벨 텍스트 컬러**, **배경색 차이**, **넘버링** 등으로 대체한다.

```css
/* 금지 */
.track { border-left: 5px solid var(--primary); }

/* 올바른 방법 — 라벨 컬러로 구분 */
.track-label-backend { color: #1A1A1A; }
.track-label-frontend { color: var(--primary); }
```

---

### nth-child / nth-of-type 사용 금지

**`nth-child`, `nth-of-type` 등 순서 의존 셀렉터를 사용하지 않는다.** 부모 요소 내 자식 순서가 달라지면 스타일이 깨지기 때문이다.

개별 요소에 스타일 차이가 필요하면 **고유 클래스명**을 부여한다:

```css
/* 금지 */
.track:nth-child(1) .icon { background: red; }
.track:nth-child(2) .icon { background: blue; }

/* 올바른 방법 */
.icon-design { background: red; }
.icon-frontend { background: blue; }
```

```html
<div class="track">
  <div class="icon icon-design">D</div>
</div>
<div class="track">
  <div class="icon icon-frontend">F</div>
</div>
```

### 기타

- 인라인 `style` 남용 대신 `<style>` 태그 내 클래스 기반 CSS를 권장한다
- `var()` CSS 변수는 반드시 `:root` 또는 `.card`에서 선언 후 사용한다

---

## 핵심 규칙

- plan.md의 텍스트를 **그대로** 사용한다 (임의로 수정하지 않음)
- plan.md의 컬러 팔레트를 **그대로** 사용한다
- 프로젝트 톤에 맞는 비주얼 스타일을 선택하고, **전체 슬라이드에 일관되게** 적용한다
- 장식 요소는 콘텐츠를 방해하지 않도록 **낮은 불투명도 + blur**로 배경에 배치
- 각 HTML 파일은 완전히 독립적이어야 한다 (다른 파일에 의존하지 않음)

## AI 느낌 제거 체크리스트

슬라이드 완성 후 아래 항목을 점검한다. 하나라도 해당되면 수정한다:

| 금지 패턴 | 대안 |
|-----------|------|
| 이모지/아이콘 문자 사용 (✅❌💡🔥 등) | CSS 도형, 넘버링, 컬러 라인으로 대체 |
| 모든 항목을 같은 스타일로 나열 | 핵심 1~3개를 강조 기법으로 차별화 |
| "핵심은 바로", "중요한 점은" 같은 AI 투의 도입부 문구 | plan.md 텍스트를 그대로 사용 |
| 지나치게 균일한 좌우 대칭 레이아웃 | 비대칭 여백, 텍스트 크기 대비로 긴장감 부여 |
| 배경과 텍스트 색이 흐릿하게 구분 | 명암비 최소 4.5:1 확보, 필요시 텍스트 오버레이 추가 |
| 중앙 정렬 텍스트 남발 | 좌측 정렬 기본, 커버·CTA만 중앙 정렬 |
| 제목과 본문이 같은 굵기 | 제목 900, 본문 400~500으로 굵기 대비 극대화 |
