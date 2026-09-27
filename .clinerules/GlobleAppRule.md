CLIENT DEVELOPMENT RULES (VERY IMPORTANT)

This project is an existing ERP system (BizBrain ERP style). Development must strictly follow reuse-first architecture and UI consistency rules.

────────────────────────────
🔁 1. FUNCTION REUSE RULE (MOST IMPORTANT)
────────────────────────────

- Before creating ANY new function (PHP / JavaScript / MySQL logic), always check existing codebase first.
- If an already existing function does the same or similar task:
  → MUST USE EXISTING FUNCTION
  → DO NOT RECREATE IT
  → DO NOT DUPLICATE LOGIC

- New functions are ONLY allowed if:
  ✔ No existing function exists
  ✔ Existing function cannot be extended or modified safely
  ✔ Feature is completely new and necessary

────────────────────────────
🧠 2. LOGIC EXTENSION RULE
────────────────────────────

- If existing function is close to requirement:
  → Extend or modify it instead of creating a new one
- Avoid redundant or duplicate APIs, handlers, or scripts

────────────────────────────
🎨 3. UI / HTML LAYOUT RULE
────────────────────────────

- Always reuse existing HTML layouts/components if available
- DO NOT create new layout structures if existing UI can be adjusted

New layout is ONLY allowed when:
✔ No existing layout fits the requirement
✔ OR explicit instruction is given to design new layout

- Maintain full consistency with current ERP design system:
  - same header style
  - same card design
  - same spacing system
  - same modal/popup system

────────────────────────────
⚙️ 4. SYSTEM CONSISTENCY RULE
────────────────────────────

- Keep all modules consistent with existing architecture
- No unnecessary redesign of working modules
- No parallel systems for same functionality

────────────────────────────
🚀 5. DEVELOPMENT APPROACH
────────────────────────────

Preferred approach:
1. Check existing function/layout
2. Try reuse
3. Extend if needed
4. Create new only if absolutely necessary

────────────────────────────
🎯 FINAL GOAL
────────────────────────────

Maintain:
- Clean codebase (no duplication)
- Faster development
- Stable ERP system
- Consistent UI/UX
- Scalable architecture