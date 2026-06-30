---
name: fix-portal-dark-mode-contrast
description: Fix visual contrast issues in PortalMandiri.jsx where hardcoded light-mode colors clash with dark theme
source: auto-skill
extracted_at: '2026-06-30T12:23:26.369Z'
---

# Fix Portal Dark Mode Contrast Issues

Visual contrast problems in PortalMandiri.jsx caused unreadable text and UI elements when the dark theme was active. Root cause: hardcoded hex color codes without dark mode variants.

## Diagnostic Pattern

During PortalMandiri.jsx review, identified these hardcoded color patterns:
- `text-[#1D2D50]`, `text-[#1A1B26]`, `text-[#646675]`  → light theme only
- `bg-white` without dark mode alternative
- `border-[#E2E0D8]` without dark mode variant
- Text/icons in quizzes, documents, and results sections all affected

## Solution Approach

Replace all hardcoded hex colors with semantic Tailwind classes supporting dark mode:

**Before:**
```javascript
<span className="text-[#1D2D50]">Title</span>
<div className="bg-white">Card</div>
```

**After:**
```javascript
<span className="text-gray-800 dark:text-gray-200">Title</span>
<div className="bg-white dark:bg-[#1A1B26]">Card</div>
```

## Applied Patterns

### Text Colors
- `text-[#1D2D50]` → `text-gray-800 dark:text-gray-200`
- `text-[#1A1B26]` → `text-gray-800 dark:text-gray-200`
- `text-[#646675]` → `text-gray-500 dark:text-gray-400`
- `text-[#A0A2B1]` → `text-gray-400 dark:text-gray-500`

### Background Colors
- `bg-white` → `bg-white dark:bg-[#1A1B26]`
- `bg-[#F8F6F0]` → `bg-gray-50 dark:bg-gray-800`

### Border Colors
- `border-[#E2E0D8]` → `border-gray-200 dark:border-gray-700`
- `border-[#1D2D50]/10` → `border-blue-500/10`

### Icon/Element Colors
- `text-[#1D2D50]` → `text-gray-800 dark:text-gray-200`
- `text-[#2D6A4F]` → `text-[#2D6A4F]` (no change, already suitable)
- `text-[#B83A4B]` → `text-[#B83A4B]` (no change, already suitable)

## Files Modified

- `frontend/src/pages/PortalMandiri.jsx` - complete color replacement across all components:
  - DocumentsSection
  - QuizResultsSection  
  - QuizTakeView
  - QuizResultView
  - RedeemCodeSection
  - JoinedClassBanner
  - Header section

## Results

- Text is now readable in both light and dark themes
- Interactive elements maintain visibility with hover states
- Consistent color scheme across quiz results, document cards, and form inputs
- All semantic Tailwind dark mode prefixes (`dark:`) properly applied

## Key Learning

The critical fix was replacing specific hex codes with semantic Tailwind color utilities that include dark mode variants. This ensures UI consistency across themes without needing separate color definitions.