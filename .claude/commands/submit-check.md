---
name: submit-check
description: Validate the project is ready for hackathon submission
disable-model-invocation: true
---

Run the HackMoney 2026 submission checklist:

1. **Build check**: Run `npm run build` from root — must pass with zero errors
2. **Test check**: Run `npm run test` from root — all tests must pass
3. **Lint check**: Run `npm run lint` from root — no errors
4. **README check**: Verify `README.md` exists and contains:
   - Project description
   - Architecture diagram (or link to one)
   - Setup instructions
   - Demo video link placeholder
   - Team info
   - Prize tracks listed
5. **Environment check**: Verify `.env.example` has all required vars documented
6. **GitHub check**: Verify `.gitignore` excludes node_modules, .env, build artifacts
7. **Sponsor integrations check**: For each sponsor (Yellow, LI.FI, Uniswap, Arc, ENS):
   - Verify SDK is imported and used in code
   - Verify at least one test covers the integration
   - List the files where integration code lives
8. **Demo readiness**: Check frontend builds and runs
9. **Video**: Remind to record 3-min demo video

Print a summary table with ✅/❌ for each check.
