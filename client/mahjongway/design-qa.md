# HTML history QA — 2026-10-30

Scope: in-game History menu, HTML overlay confined to game viewport, filtered bet history and static per-round details. Reference: user-supplied eleven history screenshots from 2026-10-30.

Implemented reference structure: dark list/header/tabs, alternating transaction rows, winning elimination count, filtered totals footer, custom inclusive date range up to seven days, static normal/free detail with multiplier, five-column active board, prior/next navigation, expandable payout calculation. Localized labels are Chinese; existing card artwork is exported locally. No animated replay.

## Verified

- 46 client tests pass, including history money precision, date boundaries, viewport fitting, and preservation of spin nonce across history reads.
- TypeScript typecheck passes.
- Go tests with PostgreSQL pass; go vet and build pass.
- Live read-only API check against existing test account: filtered summary includes all 1494 matching records while page limit is 1; detail rounds/payout totals valid; state and wallet identical before/after history reads.
- History endpoints exclude future/unsettled boards and mutable spin request tokens.

## Visual verification blocked

CUA reports the Mac is locked and the browser connection is unavailable. No new screenshot or successful browser interaction is claimed. Requested unlock through the task UI. Pending: compare list, date picker, first/last round detail against references; verify menu-to-history click, scrolling, expanded formulas, overlay positioning and close behavior in the running browser.

## Intentional differences

- Chinese labels; values use the game's actual currency scale and line count rather than the reference's fixed bet-level factor.
- Static per-round details only; animation playback is outside this request.
- History currently uses the existing test user's records and login, without resetting its balance.

## Follow-up: built-money crash fixed

Native Chrome exposed a reproducible BigInt-to-Math.pow failure after Cocos downlevel compilation. Added an ES2015 transpilation regression test; it failed before the fix and passes afterward. Replaced BigInt exponentiation with exact decimal string construction. All 46 client tests and TypeScript checks pass. Cocos web build completed; built money/fraction code inspected to confirm no Math.pow remains. Final visual recheck was interrupted by repeated browser-control timeouts.

## Preview/backend version mismatch

Verified live API schemas: 8080 returns the old items/nextCursor schema without profitAmount or round counts; 8081 returns the updated summary/amountScale schema. Creator preview defaults to 8080, whereas the build verification URL overrides api to 8081. Added network-boundary validation for list and static-detail responses, with a restart-service message rather than rendering incomplete data. All 47 client tests and TypeScript checks pass. The user's IDE process on 8080 was preserved; it must be rerun to load the current Go code.

## History artwork verification

2026-10-30: restored native scatter_bg behind Hu, extracted actual dark/lit multiplier sprites (1/2/3/4/5/6/10) and main_top_c wood strip from the game's TexturePacker atlases. Verified after a full Creator preview reload: four multiplier images render, original wooden background is visible, and a settled history board displays Hu with its native glow. Proof: history-art-check.png. TypeScript check, 50 client tests and web-mobile build pass.

## Floating history navigation

Replaced the circular source image used for round navigation with directional chevrons. Navigation buttons are absolutely positioned siblings of the detail scroll container, centered on the detail viewport; they do not occupy document flow and remain visible while scrolling payout details.

## Overlay scrollbar

Native scrollbar space is disabled in history list and detail. A separate absolutely positioned thumb overlays the right edge, supports pointer dragging, and uses ResizeObserver to follow content expansion and viewport size. Observers are disconnected whenever the history screen is replaced or closed.

## Free-mode inactive x2 color

Matched the native multipliers prefab gray_1 sprList[1] to atlas frame x2_b (UUID suffix 5f64a). Exported this red free-mode variant separately; history selects it only for inactive x2 in free mode. Normal-mode inactive x2 and the gold active x2 retain their original frames. TypeScript check passes.

## Scatter glow black background

The source scatter_bg PNG is fully opaque, including black corners. History now exports the glow separately and draws it with screen blending behind the transparent Hu foreground. Verified in Creator preview on a settled round containing Hu: computed mix-blend-mode is screen, foreground remains transparent and the black rectangle is absent. Proof: history-scatter-blend-check.png.

## Load-more reading position

Replaced full-screen reconstruction during pagination with in-place row append. Existing scroll container, rows and table header remain mounted; requests only disable the current load-more button. Responses preserve the scroll position at arrival time, and the first appended row receives a thin inset boundary line. Errors retain existing records for retry. Saved list position is restored only after the floating-scroll wrapper is mounted.

Verified in Creator preview: row count 20 -> 40, scrollTop 496 -> 496, previous last-row y 581.234375 -> 581.234375, single header retained. Proof: history-pagination-position-check.png. All 54 client tests and TypeScript check pass; web-mobile build completed.

## Chinese HTML rules — 2026-10-30

- Regulations / Rule opens a DOM overlay inside the game area using the history theme and floating scrollbar. Corrected the swapped Rule/Paytable scene node names to match their visible labels.
- Translated the supplied reference, preserving the explicitly requested 3 Hu → 12 free spins, +2 per additional Hu wording. Server awards were not changed.
- Browser verified the visible Regulations button, Chinese content, scrolling (scrollTop 1080), free-spin wording, return/close and reopening. Scroll clientWidth and offsetWidth both 386; closing removes the overlay and restores canvas pointer events.
- Verification: 54 client tests and TypeScript passed; final scene button change also passed the 4 panel tests. Cocos web-mobile build finished successfully.
- Evidence: `rules-page-check.png`, `rules-free-text-check.png`.

## Chinese HTML paytable — 2026-10-30

- Payment Table button opens a game-area DOM overlay sharing the history/rules theme, lifecycle and floating scrollbar.
- Includes the supplied eight symbol payout rows, Wild/Scatter, gold-to-Wild illustration, base/free multipliers, original 12-spin wording and 1,024 Ways calculation example. Uses existing game art, including the ingot base under Wild.
- Browser verified 8 payout cards, all images loaded, scroll content and close restoring canvas input. Scroll widths both 386 px; no reserved scrollbar gutter.
- Validation: TypeScript and 54 client tests passed; regenerated art passed all 6 history tests. Final web-mobile build completed successfully.
- Evidence: `paytable-page-check.png`.
