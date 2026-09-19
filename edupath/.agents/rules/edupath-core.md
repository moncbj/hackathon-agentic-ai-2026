Before writing code, read /docs/PRODUCT.md, /docs/specs/README.md and the assigned spec.
Implement only what the spec includes. Do not add technologies or infrastructure that are not listed.
domain/ is pure: no I/O, no AI, no data access.
Agents do not write to the database or modify the user's state.
Every LLM output is validated with Zod; if invalid, retry once and use the fallback.
An endpoint makes at most one LLM call.
Never invent resource URLs: only use the verified catalog.
When finished, verify each acceptance criterion (in the browser if applicable) and report what you could not verify.
