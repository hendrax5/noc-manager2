# Changelog guide

This project records notable changes in [`CHANGELOG.md`](../CHANGELOG.md) using
[Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/) and
[Semantic Versioning 2.0.0](https://semver.org/spec/v2.0.0.html).
The goal is a changelog written for humans: a reader should understand the impact of a
release without reading commits or diffs.

## When to add an entry

Add a line for every user-visible change in the same commit or pull request that makes it:

- new behaviour or a new field, action or endpoint (`Added`);
- a change to existing behaviour, defaults or UI (`Changed`);
- a removal or deprecation (`Removed` / `Deprecated`);
- a bug fix users can notice (`Fixed`);
- a security fix or hardening (`Security`).

Do not add entries for formatting, dependency bumps that do not change behaviour, test-only
changes, internal refactors without user impact, or documentation typos. When in doubt, ask:
“Would an operator, admin, or API consumer notice this?” If not, leave it out.

## Format

```markdown
## [Unreleased]

## [3.2.0] - 2026-11-02

### Added

- **Short, scannable topic.** One or two sentences explaining what changed and why it matters.

### Fixed

- **Another topic.** What was broken and what happens now.
```

Rules:

1. `CHANGELOG.md` stays uppercase at the repository root and starts with `# Changelog`.
2. Keep an `## [Unreleased]` section at the top. Move its content into a version section at
   release time.
3. Release headings are `## [MAJOR.MINOR.PATCH] - YYYY-MM-DD` (ISO 8601). No `v` prefix.
4. Versions are sorted newest first. Every released version gets an entry.
5. Categories come from this fixed list, in this order when used:
   `Added`, `Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`.
6. Omit empty categories. Do not leave placeholder sections.
7. Each item is one line starting with `- `, written in the imperative mood
   (“Add…”, “Fix…”, “Remove…”), and is self-describing.
8. Lead with a bold topic, then the impact. Example:
   `- **Ticket close confirmation.** Closing now asks for confirmation and can be cancelled.`
9. Do not paste `git log`. Merge related commits into one user-facing change.
10. Link the version heading at the bottom of the file:
    `[3.2.0]: https://github.com/hendrax5/noc-manager2/releases/tag/v3.2.0`
    and keep `[Unreleased]` pointing at `compare/vX.Y.Z...HEAD`.
11. Security entries must not include exploit details or secrets; describe the impact and
    the fix.

## Versioning

| Change | Bump | Example |
|---|---|---|
| Breaking API, database or workflow change that requires operator action | MAJOR | `3.1.0 → 4.0.0` |
| New feature or notable improvement, backward compatible | MINOR | `3.0.0 → 3.1.0` |
| Bug fix only, backward compatible | PATCH | `3.1.0 → 3.1.1` |

Update `package.json` in the same release commit; the latest changelog version must match it
(the `npm run changelog:check` gate enforces this). Create the matching `vX.Y.Z` git tag after
the release is deployed.

## Release checklist

1. Move `[Unreleased]` items into a new version section with today's date and the correct bump.
2. Bump `package.json` (and `package-lock.json`) to the same version.
3. Run `npm run changelog:check` and `npm run lint`.
4. Commit with a `chore(release): X.Y.Z` or `feat: …` message.
5. Tag the commit (`git tag vX.Y.Z`) and push the branch, tag, and `main`.
6. Deploy, verify health, then leave `[Unreleased]` empty for the next cycle.

## Commit messages

Commit titles follow [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/):

```text
feat(settings): add MasterPicker combobox for master data
fix(reports): stop primary buttons losing their accent fill
docs(changelog): record 3.1.0
```

`feat` maps to a minor bump, `fix` to a patch, and `!` or a `BREAKING CHANGE:` footer to a
major bump. The changelog is still written by hand; commit types only help classify and
review changes.

## Automated check

`npm run changelog:check` validates:

- the `# Changelog` heading and the Keep a Changelog / Semantic Versioning notice;
- an `## [Unreleased]` section;
- release headings, ISO dates, descending versions and no duplicates;
- allowed category names and at least one non-empty item per released version;
- that the newest released version equals `package.json`.

The check runs in CI (`.github/workflows/lint.yml`). A release that fails it is not mergeable.
