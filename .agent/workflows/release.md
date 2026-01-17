---
description: Release preparation workflow (branch creation, document update, version bump, and push).
---

This workflow automates and standardizes the preparation steps for a new release.

1. Switch to the `main` branch.
// turbo
2. `git switch main`
3. Determine the new version for the release (e.g., `1.1.0`).
4. Create and switch to a new release branch.
// turbo
5. `git switch -c release/v<new-version>`
6. Follow the instructions of the `create-feature-md` skill (`.agent/skills/create-feature-md/SKILL.md`) to analyze the project and update `.agent/skills/developer/features.md` to the latest state.
7. Update `README.md` to reflect the changes in the project.
8. Update the version in `package.json` and `package-lock.json` to the new version (`<new-version>`).
// turbo
9. `npm version <new-version> --no-git-tag-version` (or edit manually)
10. Once all changes are complete, trigger the `/git-push` workflow to push changes to the remote repository.
11. `/git-push`
