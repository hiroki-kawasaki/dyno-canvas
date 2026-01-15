---
description: Development Workflow
---

1. Understand the development that should not be pursued as instructed.
2. If you are on the main branch, run `git pull` before creating a new branch and switching to it. :`git switch -c <new branch name>`
3. Develop the functionality.
4. Once development is complete, run the lint check: `npm run lint`.
5. Make corrections based on the lint check results.
6. After passing the lint check, run the tests: `npm run test`.
7. Make necessary corrections based on the test results (ignore pre-existing errors unrelated to the current task).
8. Create test code for newly added or modified features.
9. Run the newly created tests.
10. Ensure the lint check, tests, and build (`npm run build`) complete without errors.