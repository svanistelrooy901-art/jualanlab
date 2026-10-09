# JualanLab

Counter POS and online store for Malaysian home and small food businesses. Sister app to UntungLab.

**Status:** Phase 1 of 10 (link format). App development starts after UntungLab goes live.

| Path | What |
| --- | --- |
| `JUALANLABDEV-NOTES.md` | Background notes and the decisions locked on 9 Oct 2026 |
| `DECISIONS.md` | Decisions log |
| `spec/LINK-FORMAT.md` | UntungLab ⇄ JualanLab hand-off format, v1 |
| `spec/fixtures/` | Contract fixtures both apps must pass |
| `src/link/` | Reference encoder, decoder and validator |
| `source/context/` | Project breakdown PDF |

```
npm install
npm test          # link format contract tests
npm run typecheck
npx tsx scripts/gen-fixtures.ts   # regenerate derived fixtures
```
