# RizqFlow — Engineering & Quota Guardrails

1. `src/types/index.ts` is the locked contract. No agent may alter exported interfaces without `cto-architect` sign-off.
2. Strict directory ownership:
   - `engine-data`: `src/lib/**`, `src/data/**`
   - `ui-craft`: `src/app/**`, `src/components/**`
   - `senior-qa`: `tests/**`
   - `guardian-sec`: read-only across repo; writes audit findings only to the swarm board.
3. Next.js 16 + Tailwind CSS v4: keep `@import "tailwindcss";` in `src/app/globals.css`. Do NOT install npm packages.
4. Privacy-First: 100% client-side execution. Zero analytics trackers, zero external API calls leaking user salaries/savings, zero `dangerouslySetInnerHTML`, strict schema validation when decoding shared URL state.
5. Token Cap: Execute in 2 clean phases (Build -> QA + Guardian Audit) with at most 1 targeted remediation cycle.
