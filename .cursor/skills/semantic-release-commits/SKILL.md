---
name: semantic-release-commits
description: Generate git commit messages following the Conventional Commits spec that trigger Semantic Release correctly. Use when writing commit messages, asking about commit format, what type to use, how to trigger a major/minor/patch release, or when committing with git.
---

# Semantic Release Commit Messages

Commits must follow [Conventional Commits](https://www.conventionalcommits.org/) to drive automated versioning via Semantic Release.

## Format

```
type(scope): short description

[optional body]

[optional footer(s)]
```

- **subject line**: lowercase, imperative mood, no period, max ~72 chars
- **scope**: optional, lowercase noun describing the section of the codebase (e.g. `auth`, `api`, `ui`)

## Types and Their Release Impact

| Type | Release | When to use |
|------|---------|-------------|
| `feat` | **minor** (1.x.0) | New feature visible to users |
| `fix` | **patch** (1.0.x) | Bug fix |
| `perf` | **patch** | Performance improvement |
| `revert` | **patch** | Reverts a previous commit |
| `docs` | none | Documentation only |
| `style` | none | Formatting, whitespace, no logic change |
| `refactor` | none | Code restructure with no behavior change |
| `test` | none | Adding or fixing tests |
| `chore` | none | Build process, tooling, dependencies |
| `ci` | none | CI/CD config changes |
| `build` | none | Build system changes |

## Breaking Changes → Major Release (x.0.0)

Add `BREAKING CHANGE:` in the footer **or** append `!` after the type:

```
feat!: remove support for Node 18

BREAKING CHANGE: Node.js 18 is no longer supported. Upgrade to Node 20+.
```

Both `feat!` and the footer are needed if you want to include a description of the break.

## Examples

**Patch** – bug fix:
```
fix(auth): prevent token refresh loop on 401 response
```

**Minor** – new feature:
```
feat(players): add weight profile selector to player list

Allows users to switch between Scout, Coach, and Custom weight profiles
without leaving the list view.
```

**Major** – breaking change:
```
feat(api)!: replace REST endpoints with tRPC

BREAKING CHANGE: All /api/* REST routes have been removed.
Clients must migrate to the tRPC client.
```

**No release** – chore:
```
chore(deps): update next.js to 15.3.0
```

**No release** – CI change:
```
ci: add semantic-release workflow on push to main
```

## Quick Rules

- Use `feat` for anything a user would notice as new capability
- Use `fix` for anything a user would notice as broken behavior being corrected
- Use `chore` for dependency bumps, config tweaks, tooling
- Never use vague subjects like `fix bug` or `update stuff`
- One logical change per commit: don't mix feat + fix in one commit
- If unsure whether something is a `feat` or `refactor`, ask: does it change observable behavior for the end user? If yes → `feat` or `fix`
