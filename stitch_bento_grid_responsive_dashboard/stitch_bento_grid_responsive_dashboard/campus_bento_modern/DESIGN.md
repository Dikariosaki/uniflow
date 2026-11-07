---
name: Campus Bento Modern
colors:
  surface: '#faf8ff'
  surface-dim: '#d2d9f4'
  surface-bright: '#faf8ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f3ff'
  surface-container: '#eaedff'
  surface-container-high: '#e2e7ff'
  surface-container-highest: '#dae2fd'
  on-surface: '#131b2e'
  on-surface-variant: '#464554'
  inverse-surface: '#283044'
  inverse-on-surface: '#eef0ff'
  outline: '#777586'
  outline-variant: '#c7c4d7'
  surface-tint: '#5148d7'
  primary: '#2a14b4'
  on-primary: '#ffffff'
  primary-container: '#4338ca'
  on-primary-container: '#c1beff'
  inverse-primary: '#c3c0ff'
  secondary: '#4648d4'
  on-secondary: '#ffffff'
  secondary-container: '#6063ee'
  on-secondary-container: '#fffbff'
  tertiary: '#00442d'
  on-tertiary: '#ffffff'
  tertiary-container: '#005e3f'
  on-tertiary-container: '#4ddda2'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e3dfff'
  primary-fixed-dim: '#c3c0ff'
  on-primary-fixed: '#100069'
  on-primary-fixed-variant: '#372abf'
  secondary-fixed: '#e1e0ff'
  secondary-fixed-dim: '#c0c1ff'
  on-secondary-fixed: '#07006c'
  on-secondary-fixed-variant: '#2f2ebe'
  tertiary-fixed: '#6ffbbe'
  tertiary-fixed-dim: '#4edea3'
  on-tertiary-fixed: '#002113'
  on-tertiary-fixed-variant: '#005236'
  background: '#faf8ff'
  on-background: '#131b2e'
  surface-variant: '#dae2fd'
  surface-bg: '#F8FAFC'
  surface-card: '#FFFFFF'
  border-subtle: '#E2E8F0'
  border-brand: '#E0E7FF'
  state-ready-bg: '#ECFDF5'
  state-ready-border: '#A7F3D0'
  state-ready-text: '#065F46'
  state-pending-bg: '#FEF3C7'
  state-pending-text: '#92400E'
  state-progress-bg: '#EEF2FF'
  state-progress-text: '#3730A3'
  state-alert-bg: '#FEF2F2'
  state-alert-text: '#991B1B'
typography:
  headline-xl:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '800'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-xl-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 26px
    fontWeight: '800'
    lineHeight: 34px
    letterSpacing: -0.015em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '700'
    lineHeight: 28px
  title-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '500'
    lineHeight: 24px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.02em
  caption:
    fontFamily: Plus Jakarta Sans
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.02em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  gutter-desktop: 1.5rem
  margin: 1rem
  margin-desktop: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.25rem
  space-xl: 1.5rem
  space-2xl: 2rem
---

## Brand & Style

This design system is crafted for high-turnover university dining environments where clarity, speed, and trust are paramount under intense peak-hour rush. It balances collegiate warmth with operational precision.

### Design Movement & Aesthetic
- **Minimal Bento Grid:** Content is structured into clearly delineated modular cards with soft borders, micro-elevations, and generous internal padding.
- **Ultra-Clean Utility:** High-contrast text, direct functional labeling, and tactile, thumb-friendly tap targets optimized for one-handed mobile PWA interactions starting at 360 px viewports.
- **Multi-Modal Accessibility:** Strictly adheres to WCAG 2.2 AA. State transitions, order status alerts, and kitchen countdowns never rely exclusively on color; each semantic state incorporates paired icons, badges, and contextual text.

## Colors

The palette pairs deep academic indigo (`#4338CA`) with luminous emerald (`#10B981`) to deliver rapid visual hierarchy for students tracking lunch pickup and kitchen staff managing orders.

### Palette Hierarchy & Intent
- **Primary (`#4338CA`)**: Anchors primary buttons, top navigation headers, active navigation tabs, and system brand marks. Fulfills a minimum 7:1 contrast ratio against light backgrounds.
- **Secondary (`#6366F1`)**: Utilized for secondary action outlines, active category filters, and focus indicators.
- **Tertiary / Ready State (`#10B981`)**: Dedicated exclusively to order completion, ready-to-pickup badges, and positive system events. It provides immediate recognition in noisy dining spaces.
- **Neutral (`#0F172A`)**: Slate-derived deep neutral used for high-legibility typographic hierarchies (`#0F172A` headline, `#475569` secondary body, `#94A3B8` disabled).
- **Surface System**: Pure `#FFFFFF` Bento cards sit over a soft ambient canvas `#F8FAFC`, bordered by hairline `#E2E8F0` and `#E0E7FF` strokes.

## Typography

Plus Jakarta Sans brings a clean geometric rhythm, generous x-height, and contemporary aesthetic that remains razor-sharp on mobile touchscreens and desktop kitchen station monitors alike.

### Typographic Principles
- **Number & Price Legibility:** Numbers and currency amounts (e.g., "$9.500 COP") leverage tabular figures with semi-bold weights (`label-lg` or `title-md`) to allow rapid mental tallying.
- **Hierarchy Scaling:** Large headers downscale dynamically on mobile viewports (`headline-xl-mobile`) to prevent awkward line breaks in narrow 360 px viewports.
- **Micro-copy & Status Labels:** Badges and operational chips use uppercase-free, high-weight compact styles (`label-md`) paired with distinct status icons.

## Layout & Spacing

The layout is built upon an 8-point base spatial system organized into modular Bento grids that conform fluidly across both student PWA views and high-density cafeteria operator panels.

### Layout Rhythm
- **Student Mobile View (360px – 640px):** Single-column Bento stack with sticky top and bottom operational bars. Outer gutter/margin sits at `1rem` (16px), maximizing card content space while preserving comfortable thumb safe areas.
- **Tablet / Split View (641px – 1024px):** 2-to-4 column responsive grid for dual menu browsing and order cart summary.
- **Operator Dashboard (> 1024px):** 12-column layout with fixed navigation rail (240px) and a multi-column Kanban board for order status stages (Pendientes, En preparación, Listos, Entregados).

## Elevation & Depth

Visual hierarchy uses subtle tonal layers and airy ambient shadows instead of heavy, opaque elevations, maintaining an ultra-clean Bento feel.

### Elevation Levels
- **Level 0 (Canvas):** Background baseline at `#F8FAFC`.
- **Level 1 (Bento Card Default):** Solid `#FFFFFF` fill with a 1px border (`#E2E8F0` or `#E0E7FF`) and a micro-diffused shadow: `0 1px 3px rgba(15, 23, 42, 0.04), 0 1px 2px rgba(15, 23, 42, 0.02)`.
- **Level 2 (Interactive Hover / Active Card):** Elevated cards on tap or hover: `0 8px 20px -4px rgba(79, 70, 229, 0.08), 0 4px 8px -2px rgba(15, 23, 42, 0.04)`.
- **Level 3 (Sticky Navbars & Drawers):** `0 12px 28px -6px rgba(15, 23, 42, 0.12)` with `backdrop-filter: blur(12px)`.
- **Level 4 (Modals & Notifications):** High-priority confirmation sheets elevated with `0 24px 48px -12px rgba(15, 23, 42, 0.18)`.

## Shapes

The design uses balanced, modern curvature that softens data density without sacrificing screen real estate.

### Shape Tokens & Distribution
- **Cards & Bento Modules:** Default to `rounded-lg` (16px) on mobile and `rounded-xl` (20px – 24px) on desktop to frame distinct pieces of information comfortably.
- **Buttons & Large CTAs:** Fully rounded or `rounded-lg` (12px – 16px) for primary touch targets, delivering an inviting, tap-friendly physical presence.
- **Pills & Status Badges:** Fully rounded (`rounded-full` / pill) to establish immediate visual differentiation from structural cards and input fields.

## Components

### Buttons
- **Primary CTA:** Indigo fill (`#4338CA`), white label (`#FFFFFF`), `rounded-xl` (12px-16px), minimum height 48px for finger touch targets. Active states shift to `#3730A3`.
- **Secondary Action:** Outlined with 1.5px `#E0E7FF`, surface white, text `#4338CA`.
- **Counter Buttons (+ / -):** 36px x 36px circular or soft-square buttons with high-contrast glyphs for quick item addition in busy menu screens.

### Bento Cards
- **Product Menu Card:** Horizontal or vertical layout with a rounded food thumbnail (64px x 64px or 80px x 80px), title, item price in bold tabular figures, and an immediate tap action button (+). Hairline border `#E2E8F0`.
- **Order Tracking Stepper:** Bento container presenting numbered and icon-backed vertical steps (`Confirmado`, `En preparación`, `Listo para recoger`, `Entregado`). Active states highlight with `#4338CA` or `#10B981` indicators.

### Status Chips & Badges
- **Format:** Pill-shaped with paired SVG icons (e.g., check circle, clock, alert triangle) and localized text.
- **Ready / Listo:** `#ECFDF5` background, `#A7F3D0` border, `#065F46` label with checkmark icon.
- **In Preparation / En Preparación:** `#EEF2FF` background, `#C7D2FE` border, `#3730A3` label with prep spinner icon.
- **Pending / Pendiente:** `#FEF3C7` background, `#FDE68A` border, `#92400E` label with clock icon.

### Form Inputs & Selection Controls
- **Inputs:** 48px minimum height, 1px border `#CBD5E1`, focus state transitions to 2px ring `#6366F1` with zero interior color bleeding.
- **Radio / Option Selectors:** Bento option tiles for pickup timing ("Lo antes posible" vs "Programar horario") using full-width selectable cards that highlight with an indigo outline when selected.

### Operator KDS (Kitchen Display) Tiles
- High-contrast order cards featuring prominent order IDs (`#128`), elapsed timer badges, aggregated item checklists, and large one-tap state transition buttons ("Iniciar", "Listo", "Entregar").