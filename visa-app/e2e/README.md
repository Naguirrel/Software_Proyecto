# E2E (Playwright)

Suite end-to-end del recorrido completo del cliente. La guía completa, con los pasos que cubre y los hallazgos,
está en [`../docs/e2e.md`](../docs/e2e.md).

```bash
npm install
npx playwright install chromium
npm run db:up      # PostgreSQL aislado en el puerto 5434
npm test
npm run db:down
```
