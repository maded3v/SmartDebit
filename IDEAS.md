# SmartDebit Frontend Ideas

Use this file as a shared backlog of UI/UX and frontend improvements.

## How to use

- Add one idea per block.
- Keep each idea short and concrete.
- When you want implementation, say: "Start from IDEAS.md".

## Idea Template

### [ID-001] Short title
- Context:
- Goal:
- Proposed changes:
- Screens/route:
- Priority: high | medium | low
- Notes:

---

## Ideas

<!-- Add new idea blocks below -->

### [ID-001] Use T-Bank favicon
- Context: Current favicon is generic and not aligned with fake-bank reference direction.
- Goal: Make browser tab icon feel like real bank UI.
- Proposed changes: Take favicon from `https://www.tbank.ru/` and set it as project favicon.
- Screens/route: global (`frontend/index.html`, `frontend/public/*`).
- Priority: high
- Notes: Keep file optimized and compatible with Vite static assets.

### [ID-002] Rename site title to SmartDebit
- Context: Browser tab title is not product-branded.
- Goal: Show consistent product naming in tab/title metadata.
- Proposed changes: Change HTML `<title>` to `SmartDebit`.
- Screens/route: global (`frontend/index.html`).
- Priority: high
- Notes: If there are OG/meta tags later, keep naming consistent there too.

### [ID-003] Header/nav style like reference
- Context: Current top navigation style differs from reference screenshot.
- Goal: Match reference feel for brand mark and active navigation state.
- Proposed changes:
  - Use logo style close to T-Bank reference in top-left brand area.
  - Active tab underline should be bottom-aligned and yellow.
  - Remove visible border outlines from blocks/panels to get cleaner reference look.
  - Keep overall layout "flat and placed" like reference top section.
- Screens/route: header/global navigation + reusable cards/panels styles.
- Priority: high
- Notes: Preserve functionality and mobile responsiveness while restyling.

### [ID-004] Bring icons closer to reference
- Context: Product/account icons on home screen do not match the desired bank style.
- Goal: Make visual language more consistent with reference cards and service items.
- Proposed changes: Replace current icons with a unified icon set closer to the reference style across home account cards and related action tiles.
- Screens/route: `/` (Home), shared icon classes/components if needed.
- Priority: high
- Notes: Keep icon sizes visually balanced and consistent.

### [ID-005] Reduce money amount font sizes
- Context: Amount typography appears oversized compared to reference.
- Goal: Improve visual balance and hierarchy in cards.
- Proposed changes: Decrease font size for key money values (main balance and account amounts) to be closer to reference scale.
- Screens/route: `/` (Home), potentially `/operations` and `/payments` if same amount styles are reused.
- Priority: medium
- Notes: Keep readability strong on desktop and mobile.

### [ID-006] Savings growth badge like cashback style
- Context: Savings card growth indicator should look like the green cashback/growth pill from reference.
- Goal: Make positive delta on savings feel more product-like and recognizable.
- Proposed changes: Add matching icon + green background badge style for growth value on the savings account card.
- Screens/route: `/` (Home), savings card UI.
- Priority: high
- Notes: Reuse style token for all positive micro-metrics.

### [ID-007] Move "Top up from another bank" action
- Context: CTA placement between "Пополните из другого банка" and bottom actions should match desired flow.
- Goal: Use "Пополнить с другого банка" as the secondary bottom action instead of "Оплатить".
- Proposed changes: Move/replace bottom right action so the pair is `Перевод` + `Пополнить с другого банка`.
- Screens/route: `/` (Home), left column action row.
- Priority: high
- Notes: Keep quick-action routing behavior coherent after swapping.

### [ID-008] Stronger bank-card visual background
- Context: Card area should immediately feel like a real bank card block.
- Goal: Increase realism and premium feel of card widget.
- Proposed changes: Improve card background with a clearer card-like visual treatment (deeper gradient, subtle texture, brand accents, optional chip element).
- Screens/route: `/` (Home), wallet card preview block.
- Priority: high
- Notes: Keep contrast accessible for card number and labels.
