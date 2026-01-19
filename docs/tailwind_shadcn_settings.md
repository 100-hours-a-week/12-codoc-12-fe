# Tailwind + shadcn 설정

## Tailwind CSS

- 설정 파일: `tailwind.config.js`
- 다크 모드: class 방식 (`.dark`)
- 콘텐츠 스캔: `./index.html`, `./src/**/*.{js,jsx}`
- 테마 확장: CSS 변수 기반 색상(`hsl(var(--...))`), radius(`--radius`)
- 플러그인: `tailwindcss-animate`
- PostCSS: `postcss.config.js`에 `tailwindcss` + `autoprefixer`

## 전역 스타일/CSS 변수

- 전역 스타일: `src/index.css`
- `@tailwind base/components/utilities` 사용
- `:root`와 `.dark`에 컬러/반경 CSS 변수 정의
- 전역 적용: `* { @apply border-border; }`, `body { @apply bg-background text-foreground; }`

## shadcn/ui

- 설정 파일: `components.json`
- style: `default`
- rsc: `false`, tsx: `false` (JS/JSX 기반)
- tailwind:
  - config: `tailwind.config.js`
  - css: `src/index.css`
  - baseColor: `zinc`
  - cssVariables: `true`
  - prefix: `""` (없음)
- aliases:
  - components: `@/components`
  - ui: `@/components/ui`
  - utils: `@/lib/utils`

## 경로 별칭

- `jsconfig.json` + `vite.config.js`에서 `@/` → `src/`

## 유틸

- `src/lib/utils.js`의 `cn()`은 `clsx` + `tailwind-merge`로 클래스 병합

## 컴포넌트 추가

```bash
npx shadcn@latest add <component>
```

## 커스터마이징 포인트

- 색상/반경: `src/index.css`의 CSS 변수 수정
- Tailwind 테마: `tailwind.config.js`의 `theme.extend` 수정
