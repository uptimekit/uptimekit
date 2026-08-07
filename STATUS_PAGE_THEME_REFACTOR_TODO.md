# Status Page Theme Refactor

This checklist tracks the phased consistency and modularity refactor for the public status page.

## Phase 1 — Shared contracts and configuration

- [x] Define one shared, typed theme catalog and capability model.
- [x] Use the catalog in the dashboard theme selector and public theme runtime.
- [x] Normalize theme IDs and design settings at the public-page boundary.
- [x] Preserve every supported setting, including `websiteUrl`, on every route.

## Phase 2 — Shared domain and UI behavior

- [x] Centralize incident/maintenance status semantics and formatting.
- [x] Replace contradictory incident-card props with explicit display modes.
- [x] Remove shared-component dependencies on a concrete theme.
- [x] Extract shared uptime calculations and formatting from theme renderers.

## Phase 3 — Theme consistency and feature parity

- [x] Give every theme consistent header links, subscriptions, active issues, maintenance, and history access.
- [x] Make every theme honor its declared layout, uptime-bar, precision, and group-collapse capabilities.
- [x] Give Spark native detail and updates compositions instead of Default aliases.
- [x] Keep visual differences in theme composition and tokens rather than duplicated behavior.

## Phase 4 — Routes and data preparation

- [x] Consolidate public design/config mapping.
- [x] Remove the unused parallel maintenance-detail implementation.
- [x] Consolidate duplicated custom-domain and slug route behavior where safe.
- [x] Ensure global incidents participate in the public overall status.

## Phase 5 — Tests and quality gates

- [x] Add theme registry, normalization, and capability tests.
- [x] Add a contract render test for every theme and page type.
- [x] Add focused tests for shared uptime/event behavior.
- [x] Run type checks, unit tests, Biome, and React Doctor regression checks.
