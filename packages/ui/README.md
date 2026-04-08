# @turborepo/ui

## Purpose

Shared UI components and utilities for the monorepo frontend. This package provides small, design-system-friendly building blocks (buttons, inputs, and helpers) for React-based apps using Tailwind CSS and the conventions used in the workspace.

## Primary exports

- `Button` — a stylable, accessible button with variants and sizes implemented via class-variance-authority.
- `Input` — a base text-input component with consistent styling and props.
- `cn` (utility) — helper combining `clsx` with `twMerge` for consistent class merging.
- `index.css` — Tailwind entry file used by consumers to include the shared component styles.

## How other apps use this package

- Frontend (Next) apps import components and the `index.css` file to include the shared styles and to reuse the design system components.
- Use `Button` and `Input` directly in React components to ensure consistent styling and accessibility across apps.
- Build or include the package as a workspace dependency; update the application’s Tailwind config to accept the CSS classes used by these components.

## Styling and theme notes

- This package assumes the workspace uses Tailwind CSS; `index.css` includes the expected Tailwind directives.
- Components use utility-first styles and `cva` to expose variants (e.g., `variant`, `size`) — respecting the theme and tokens configured in the repo’s Tailwind setup.
- To customize styling, prefer overriding Tailwind tokens or the consumer app’s global styles rather than changing the component internals.

## Design & conventions

- Components are intentionally small and focused on reusability; complex UI should be composed by consumers from these primitives.
- Avoid relying on private implementation details (class names). Use public props (variants, size) and the `cn` helper to add classes if required.

## Build, tests and lint

- The package builds with `tsup`; it exposes typed d.ts and ESM/CJS bundles.
- Use the workspace scripts for lint and build in CI. This package includes TypeScript, Tailwind, and linting configs consistent across the monorepo.

## Maintenance and constraints

- Keep public API stable: prefer adding new components rather than mutating existing ones.
- This package relies on React v18 and Tailwind — ensure peer dependency alignment in apps consuming it.
- For complex component customization, prefer creating a wrapper in the consuming app to avoid coupling across multiple consumers.
