# Recovery target

## Goal

Recover the original production source and sync/auth implementation without modifying the live Hachiware Bullet site or its data.

## Verified boundary

- The live production site remains the source of truth for current user data.
- Cross-device data visibility has been confirmed by the user.
- This branch is only a reconstructed development mirror.
- The production sync/auth backend is not present in this repository.

## Recovery rule

The original implementation must be recovered from the original local development working copy or another verified source. Do not recreate sync/auth endpoints from guesses, browser errors, or reconstructed localStorage data.

## Safety

- Do not publish journal data, account identifiers, tokens, or secrets to GitHub.
- Do not overwrite the production URL.
- Do not deploy this mirror as production until compatibility is verified against a non-production copy.
- Keep all changes on `hachiware-bullet`; do not change `master`.
