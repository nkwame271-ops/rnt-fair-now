# Make Search More Visible on Mobile devices + Add Super Admin Route

## Problem

The command search bar exists in the header but on mobile (430px) the label text is hidden and only a tiny icon shows, making it easy to miss. Also, the Super Admin Dashboard route isn't in the keyword registry.

## Changes

### 1. `src/components/CommandSearch.tsx`

- Show "Search..." text on mobile instead of hiding it completely (change `hidden sm:inline` to always visible with shorter text on small screens)
- Add `/regulator/super-admin` to the keyword map with relevant search terms (staff, permissions, visibility, logs, rename)

### 2. `src/components/RegulatorLayout.tsx`

- Adjust header layout so on mobile the search bar gets more space — hide the "Rent Control — Admin" title text when the search bar is present, or make the search bar take priority

## Result

Users on mobile and all devices will clearly see and tap the search bar to find any feature across the platform, including Super Admin functions.