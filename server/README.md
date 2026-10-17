# AI 판단 Worker

현재 운영 서버는 Sites 플러그인이 제공하는 Cloudflare Workers 런타임에 배포되어 있습니다. 여기에는 공개 가능한 원본만 포함합니다. 런타임 비밀값·호스팅 식별값은 제외했습니다.

개인 Cloudflare 계정에 별도로 배포하려면 Wrangler로 다음 순서대로 실행하세요. 비밀값은 CLI 프롬프트에 입력하고 소스에 적지 마세요.

```powershell
cd server
npx wrangler login
npx wrangler secret put OPENROUTER_API_KEY
npx wrangler secret put DEMO_ACCESS_TOKEN
npx wrangler deploy
```

`wrangler.jsonc`의 `WEB_ORIGIN`을 웹앱 출처로 설정하세요. 배포된 주소로 `extension/config.js`와 `docs/config.js`의 서버 주소도 수정합니다. 확장 ZIP 갱신 후 GitHub에 푸시합니다. 모델은 OpenRouter의 `openai/gpt-4o-mini`입니다.

`scripts/build.mjs`는 Sites 배포 폴더 구조를 만드는 개발용 도구이며, Sites가 생성한 `.openai/hosting.json`이 있는 체크아웃에서만 사용합니다. 직접 Wrangler 배포에는 필요하지 않습니다.
