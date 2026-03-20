# Contributing

## Validation Workflow

Use the lightest validation that still matches the risk of the change.

### Fast iteration

Use while you are still changing code:

```bash
npm test
```

Or keep a focused file in watch mode:

```bash
npm run test:watch -- src/engine/dag.test.ts
```

### Quick validation

Use before handing off a behavior change that does not affect build output:

```bash
npm run check:quick
```

### Full validation

Use before merging, shipping, or after touching app wiring/build-sensitive areas:

```bash
npm run check
```

### Coverage review

Use when refactoring or when you want to see where the next tests should go:

```bash
npm run test:coverage
```

`npm run lint` sigue disponible como validacion separada. No forma parte de `npm run check` mientras exista deuda previa de lint en el repo.

## Red/Green TDD

Use red/green TDD for behavior changes in `src/engine`, `src/lib`, and `src/app/api`.

1. Write or update a focused automated test first.
2. Run the targeted test and confirm it fails for the expected reason.
3. Make the smallest production change needed to pass the test.
4. Re-run the targeted test until it is green.
5. Run `npm run check` before finishing.
6. If your change touches files with active lint debt, run `npm run lint` for the relevant area when practical.

If a change is not practical to automate, call that out explicitly in the PR or handoff notes.

## Picking The Right Level

- Pure logic, data transforms, API behavior: prefer TDD.
- UI interaction and visual layout: use TDD when the behavior is easy to assert; otherwise add integration coverage or document manual checks.
- Small copy or style-only changes: keep validation lighter, but still run the appropriate checks before merge.
