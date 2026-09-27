ADDITIONAL IMPORTANT REQUIREMENTS:

DESIGN CONSISTENCY RULES:

* DO NOT create a new design system.
* DO NOT create new color schemes unless absolutely necessary.
* DO NOT replace the existing UI styling.
* Reuse the current CSS, design tokens, variables, theme system, components, cards, buttons, form controls, typography, spacing, shadows, and layout patterns already present in the project.
* The new Business Registration Wizard must visually match the existing BizBrain ERP interface.
* Dark Mode and Light Mode must automatically use the existing theme implementation.
* Use existing CSS classes wherever possible.
* Use existing reusable UI components before creating new ones.

ONLY create new CSS classes when:

1. The required component does not already exist.
2. The current design system has no equivalent component.
3. A completely new UI element is required for the wizard.

Before creating any new:
- HTML Component
- CSS Class
- JavaScript Function
- PHP Function
- API Method

Search the existing codebase first.

If a similar component/function already exists:
- Reuse it.
- Extend it if necessary.
- Do not create duplicate functionality.

Priority:
1. Reuse Existing Code
2. Extend Existing Code
3. Create New Code (Last Option)

Before generating new styles:

* Search the project for existing CSS classes.
* Search for reusable form components.
* Search for existing card layouts.
* Search for existing button styles.
* Search for existing modal/dialog styles.
* Search for existing theme variables.

If an existing component can be reused, use it instead of creating new CSS.

The final Registration Wizard must feel like a native part of BizBrain ERP and not like a separate module added later.

CODE ARCHITECTURE RULES:

* Separate Frontend and Backend.
* Frontend pages should use API calls through fetch().
* Backend should return JSON responses.
* Follow the existing project folder structure.
* Do not duplicate existing utilities or helper functions.
* Reuse existing validation systems where available.
* Reuse existing API helpers where available.
* Reuse existing authentication architecture where available.

Before creating files:

* Analyze the existing project structure.
* Reuse existing files and components when possible.
* Create new files only when necessary.
