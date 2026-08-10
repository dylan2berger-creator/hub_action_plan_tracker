# hub_action_plan_tracker

An **Action Plans** tab for *The Hub* — a self-contained, interactive Kanban board
for tracking action items from the daily huddle through to done. Built to match The
Hub's existing design system (navigation bar, colors, typography, chips, avatars) so
it reads as a native part of the app.

![Action Plans board](assets/preview.png)

## Run it

No build step, no dependencies. Just open the page:

```bash
# from the repo root
open index.html          # macOS
xdg-open index.html      # Linux
# or drag index.html into any browser
```

The board seeds with sample action items on first load and saves every change to
your browser's `localStorage` (key `hub.actionPlans.v1`), so your edits persist
between visits on the same browser.

## Features

- **Four status columns** — To Do, In Progress, Blocked, Done — each with a live count.
- **Add / edit / delete** actions via a modal (title, details, owner, priority,
  status, due date, tag).
- **Drag & drop** cards between columns, or use the ◀ ▶ buttons (keyboard-accessible).
- **Filter** by owner or priority, **search** across title/details/owner/tag, and
  **sort** by due date, priority, or newest.
- **Priority accents & chips** — Urgent / High / Medium / Low, color-coded to The Hub palette.
- **Due-date awareness** — "Due today", "Due tomorrow", and red **Overdue** flags.
- **Summary pills** — total actions, blocked, and overdue at a glance.
- **Board options** menu — reset to sample data or clear the board.

## Files

| File | Purpose |
|------|---------|
| `index.html` | Page shell built on The Hub's real `ClientLayout` / `thehub` markup, plus the toolbar, board mount point, and add/edit modal. |
| `assets/hub-shell.css` | The Hub's actual shipped layout/navigation CSS, imported verbatim (header/nav wrappers, logo button, page-content centering). |
| `assets/styles.css` | The Hub design tokens + all Action-Plans component styles. |
| `assets/app.js` | Board state, rendering, drag & drop, filtering/sorting, and persistence. |

> **Logo note:** the shipped CSS loads the wordmark from `/thehub.svg`, which isn't
> included here, so `index.html` uses a hand-built recreation of the "THE HUB"
> wordmark (inline SVG). Drop the real `thehub.svg` into the repo and point the
> `.thehub…logo` span at it to make the logo pixel-exact.

## How this maps onto the real Hub

The Hub is a Next.js app whose menu items live in a navigation-menu component and
route to pages. To promote this prototype into the app:

1. **Nav entry** — add an `Action Plans` `MenuElement` beside `KPI's`, pointing at a
   new route (e.g. `/action-plans`), reusing the same selected/icon treatment.
2. **Page/route** — port `index.html`'s content region into a Hub page component.
3. **State** — swap the `localStorage` layer in `assets/app.js` for the app's data
   layer / API; the render and interaction logic can move into a React component
   largely as-is.

The visual layer already uses the app's tokens (`--color-*`, spacing, corners,
Oswald/Fustat), so it should drop in without restyling.
