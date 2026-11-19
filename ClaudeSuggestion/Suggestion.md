Overall this is a clean, consistent light enterprise style: grouped white cards on a gray-blue background, a left sidebar with a pill-shaped active state, and line icons. It already reads as Mac-like. Here is what I'd change to get closer to Mac and iPhone conventions, in priority order.

## High priority

1. **Table typography is inverted.** Header rows are larger (~14px) than body cells (~11px), and within one row the sizes differ ("GL-001" is small, "82%" is larger). Use one body size of 13-14px, and make headers smaller, medium weight and secondary gray. Apple's minimum readable size is about 11pt, so the tiny text in the sidebar footer, status labels and page footer should go up too.
2. **Settings toggles should be switches.** The black circular checkmarks in 系统设置 are not an Apple pattern. Use iOS-style switches (green when on) for 自动刷新监控数据 and 显示事件时间.
3. **Status should use badges, not plain text.** In 设备管理, 事件中心 and 样本审核, "在线 / 离线 / 模拟" and "待审核 / 已审核 / 识别错误" are bare text. Use a dot or capsule with semantic colors:
   - green `#34C759` for online or approved
   - orange `#FF9500` for pending
   - red `#FF3B30` for error
   - gray for offline
4. **Clickable things don't look clickable.**
   - "详情" should be a blue text link or have a chevron.
   - The rows in 数据与隐私 and 系统维护 look like plain text but are navigation entries, so use iOS-style list rows with a trailing `›`.
   - Table rows need a hover highlight.
   - The cards in 设备管理内容 need a chevron or arrow.
5. **Orphaned stat cards.** 设备管理 and AI 运行分析 each have 4 cards in a 3-column grid, leaving a lone card on the second row. Use a 4-column grid, or `repeat(auto-fit, minmax(...))`.
6. **Data inconsistencies in 管理员中心.**
   - 活跃管理员 shows 2, but the table has 3 accounts enabled.
   - 角色类型 shows 3, but the table lists 4 roles.
   - The permission matrix has no 数据审核员 column.
   - Role names differ between sections ("AI 分析师" vs "分析师", "只读观察员" vs "观察员").
   
   Clients notice this quickly.

## Medium priority

- **Sidebar grouping.** Ten flat items is a lot. Mac sidebars (like Finder) use small gray section headers, for example 监控 / 数据 / 管理. Keep 系统设置 pinned at the bottom.
- **Focus ring.** On 模型监控 the sidebar item has a blue outline box. Show it only for keyboard focus (`:focus-visible`), not on click.
- **Segmented controls.**
  - The 正确 / 错误 / 待审核 buttons in 样本审核 should be a real segmented control with a clear selected state (green for correct, red for error).
  - The filter chips in 事件中心 ("设备：全部") should have a dropdown chevron.
  - Add a time-range control (今天 / 7天 / 30天) to the charts.
- **Charts.** Axis labels are larger than the table text, so reduce them. Add a soft gradient area under the line and smooth the curve. Chart colors can follow the same accent.
- **Permission matrix.** Use green ✓, gray "—", and an orange badge for "需授权" instead of plain text.
- **Event center.**
  - Add a timestamp column (your settings page already has "显示事件时间").
  - "事件详情抽屉的信息结构" looks like a spec note, not UI. In the real product, make it a right-side inspector panel or drawer opened by clicking a row.
- **Sample review.**
  - Put labels above values ("AI 原始识别" over "花瓶") instead of inline.
  - Add a primary button such as 保存并下一条.
  - Add keyboard shortcuts, since Mac users expect them.
- **Settings values.** "系统环境: 比赛演示原型" is bold but the other values are regular. Make them consistent.
- **Search field.** Add a magnifier icon and a clear (×) button. Consider ⌘K for global search.

## Apple-specific styling

- **Fonts:** `-apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", "Helvetica Neue", sans-serif`. Line-height about 1.5-1.6 for Chinese, no extra letter-spacing, and tabular numerals (`font-variant-numeric: tabular-nums`) for stats and tables.
- **Accent color:** your blue is slightly indigo. System blue `#007AFF` (light mode) will feel more native.
- **Dark mode:** Mac and iPhone users expect `prefers-color-scheme` support. Define your colors as tokens now so it's easy later.
- **Sidebar:** consider a slightly translucent background (`backdrop-filter: blur`) and a filled icon variant for the active item, as in SF Symbols.
- **Corner radii:** you're already close. Keep it consistent, about 16px for cards, 10px for controls, and pills only for search and chips.
- **Offline battery:** show "—" plus a small battery bar for online devices, and add a "最后通信时间" column.

## If it must work on iPad or iPhone

- Below ~900px, collapse the sidebar to an icon rail or a bottom tab bar, with the rest under "更多".
- Tables should become stacked cards on narrow screens.
- Make touch targets at least 44×44px, and respect `env(safe-area-inset-*)`.
- Replace hover-only affordances (like the chart export button) with always-visible or tap-based ones.

If you share the CSS or component code, I can turn this into a concrete set of design tokens (colors, type scale, radii, spacing) and point to the exact lines to change.



Here are further suggestions beyond visual styling, grouped so you can hand them to Codex in phases. I haven't seen the 实时监控 or 数据集管理 pages, so none of this covers them.

## 1. Fix data and logic consistency first

Clients and competition judges check numbers. A few don't add up:

- **Average response time:** 平均响应时间 shows 1.26s, but the per-function table works out to about 1.0s when weighted by call volume (the simple average is 0.98s). The other totals do reconcile: the six call counts sum to 1,284, and the failure count of 35 matches the success rates.
- **Sound service conflict:** 模型监控 shows Sound Service as abnormal at 2.4s, while 环境声音识别 in 运行分析 shows a healthy 0.6s and 96.8%. Either the service should affect that row or the numbers should be explained.
- **Functions don't map to services:** There are six AI functions but only four model services. 导航定位 and OCR have no visible service. Add a function → service mapping.
- **Inconsistent names:** "语音转写" in the event center vs "语音转文字" in the analysis page, and "声音识别" vs "环境声音识别". Pick one name per concept.
- **Status vocabulary:** Events use 待审核 / 已审核 / 识别错误, and samples use 待审核 / 已修正. Define one state machine (e.g. 待审核 → 已确认正确 / 已修正 / 已丢弃) and reuse it everywhere.
- **Sample S-00128:** It shows a human correction ("水杯") already filled in while the status is still 待审核, and the admin log says analyst01 already reviewed it. Make the data tell one coherent story.
- **Device status:** 模拟 is treated as a status, but it's really a data source. Split into two fields: connection status (在线/离线) and data source (真实设备/演示设备/模拟数据).

**Instruction for Codex:** put all demo data in one typed mock-data module, and compute every stat card, table total and chart from it. No hardcoded numbers in components.

## 2. Make the pages work as one closed loop

The product's value is "find a problem → review → add to dataset → improve the model." Right now the pages are separate screens.

- Make everything cross-link: a failed-request count opens 事件中心 with filters applied, an event row opens its detail drawer, "加入候选样本" creates a row in 样本审核, and the 问题诊断入口 chips open pre-filtered lists.
- Give each page its own URL (hash or router) so back/forward and refresh work, and filters persist in the URL.
- Add a small pipeline strip on the home page: 事件 → 待审核 → 已入库 → 模型反馈, with counts.
- Add a global top bar with breadcrumbs, a date-range filter, ⌘K search, and working popovers for the bell and avatar (notifications, profile, logout).

## 3. Add the missing UI states

- Loading skeletons, empty states ("暂无待审核样本" with a hint), and error states with a retry button.
- Toasts for actions, confirmation dialogs for destructive ones, and undo where possible.
- Tables need pagination (there are 246 samples), sortable columns, a clear filter reset, and multi-select with bulk actions in 样本审核.
- 实时监控 should show "最后更新 HH:mm:ss", a pause button, and an offline-reconnect state, which matters in LAN mode.
- The "服务端状态: 尚未接入" setting suggests a future backend. Put an API adapter layer between UI and data (`getDevices()`, `getEvents()`, and so on) so switching from mock to real is one change.

## 4. Privacy and security

Smart glasses capture images and audio of other people, so this is a selling point if shown well.

- Add a face/plate blur toggle in the evidence preview, a watermark with viewer and time on evidence and exports, and a required "访问理由" before opening raw evidence.
- Show evidence access in the audit log.
- Make the entries in 数据与隐私 real: retention period, authorization records, export approval flow (the 分析师 "需授权" state needs an approval step).
- The admin log should include full date, target object, result, and IP or device, be filterable, and be read-only.
- In 管理员中心, enforce role-based route guards in code, not just hide menu items. Consider showing session timeout and MFA as settings.

## 5. Engineering structure (for Codex)

- Define design tokens first (colors, type scale, radii, spacing, shadows) as CSS variables, with a dark-mode set.
- Extract reusable components: `PageHeader`, `StatCard`, `DataTable`, `StatusBadge`, `ListRow`, `Switch`, `SegmentedControl`, `Drawer`, `EmptyState`, `Toast`. The pages share many repeated patterns, and fixing a component once fixes every page.
- Use a chart library with tooltips, lazy-loaded, with the same theme tokens. Don't hand-draw SVG for each chart.
- Add `aria-label`s to icon buttons, `aria-current="page"` on the active nav item, and real `<table>` semantics.
- Style scrollbars thin and overlay-like (macOS style) instead of the default Windows bar visible in your screenshots.
- Make the page header sticky with a blurred background so the title stays visible while scrolling, as iOS does.

## 6. Accessibility

- Contrast: the light-gray secondary text on the gray-blue background (subtitles, footer, card descriptions) is likely below WCAG AA (4.5:1). Darken it.
- Never rely on color alone for status. Pair color with an icon or text.
- Respect `prefers-reduced-motion` and add keyboard navigation for the sidebar, tables and drawers.

## 7. Demo presentation (it's labeled a competition prototype)

- The "截图模式" toggle is visible at the top of some screenshots and partly cut off. Either style it properly as a presenter control or hide it in production.
- The app frame sits inside a bordered, rounded container with margins. Fine for screenshots, but for live demos let the layout fill the viewport.
- Prepare one scripted story using realistic seed data: a device goes abnormal → an event appears → a reviewer corrects it → it enters the dataset → model monitoring shows improvement. Optionally add a "演示引导" mode that walks through it.
- Keep the "页面内容与数值均为演示示意" disclaimer, but make it consistent in placement.

## Suggested order for Codex

1. Data layer and consistency fixes (section 1)
2. Design tokens and shared components
3. Apply the earlier UI/Apple-style changes using those components
4. Routing, cross-links, drawers and states
5. Privacy and audit features
6. Accessibility pass and screenshot-based regression checks (e.g. Playwright)

If you send the 实时监控 and 数据集管理 screenshots, I'll review them too, and I can also write the first step as a ready-to-paste Codex prompt with exact acceptance criteria.



The "bubble that moves up and down" feels cheap because it is probably a fixed-duration, linear or `ease` tween. Apple's motion feels alive for three reasons:

- It is driven by springs, not durations.
- It is interruptible: you can change direction mid-animation and it continues smoothly.
- Everything responds to touch immediately, with small, physical feedback.

Here is a brief you can pass to Codex.

## 1. Principles

1. **Use springs, not timed easing.** Use a spring library for anything position or size based. Recommended: the `motion` package (Framer Motion) in React, or the Web Animations API with spring-derived `linear()` easing in plain CSS.
2. **Interruptible and velocity-aware.** Clicking item A, then C, then B quickly must never queue or jump. The element retargets from its current position.
3. **Animate only `transform` and `opacity`.** No animating `top`, `height` or `box-shadow` directly, to stay at 60fps.
4. **Fast and subtle.** Most UI motion should finish in 150-350ms. Use almost no overshoot in a data-heavy admin tool.
5. **Motion explains something.** Use it to show where something came from, where it went, or that it was pressed. Never animate purely for decoration.
6. **Exit faster than enter.** Roughly 60-70% of the enter duration.

## 2. Motion tokens

Define these once and use them everywhere.

```ts
export const spring = {
  snappy: { type: "spring", stiffness: 520, damping: 38, mass: 1 },   // pills, switches, segmented controls
  smooth: { type: "spring", stiffness: 300, damping: 30, mass: 1 },   // cards, drawers, layout changes
  gentle: { type: "spring", stiffness: 180, damping: 26, mass: 1 },   // large surfaces, page-level
  bouncy: { type: "spring", stiffness: 420, damping: 22, mass: 1 },   // rare: success confirmations only
};
```

CSS fallback curves:

```css
:root {
  --ease-out-ios: cubic-bezier(0.32, 0.72, 0, 1);   /* drawers, sheets, popovers */
  --ease-standard: cubic-bezier(0.25, 0.1, 0.25, 1);
  --dur-fast: 120ms;   /* hover, press */
  --dur-base: 220ms;   /* state changes */
  --dur-slow: 360ms;   /* sheets, page transitions */
}
```

## 3. The sidebar selection pill (the main problem)

Currently: a pill that slides vertically. Make it feel native:

- **One shared indicator element** (`layoutId` in Framer Motion, or a single absolutely positioned div moved with `transform: translateY()`), animated with `spring.snappy`. Do not fade one pill out and another in.
- **Slight stretch while travelling.** Scale the pill's height by about 1.0 to 1.08 based on travel distance, then settle. For long jumps this reads as liquid, but keep it very subtle.
- **Separate hover highlight.** A lighter gray pill follows the pointer (macOS Finder and Notes feel), with a 120ms fade and a position spring. It disappears when the pointer leaves the sidebar.
- **Press feedback.** On `pointerdown`, the item scales to 0.97 over 80ms, and releases with `spring.snappy`.
- **Icon and label change.** Crossfade the outline icon to a filled one (SF Symbols style). Animate text color and weight over 150ms. Fix the label width so a weight change doesn't shift layout.
- **Keyboard navigation.** Up and down arrows move the focus ring with the same spring. Show `:focus-visible` only for keyboard use.

## 4. Page transitions

- On route change, the outgoing content fades out (100ms) and the incoming content fades in and rises 8px (`opacity 0→1`, `translateY(8px→0)`, 280ms, `--ease-out-ios`).
- **Stagger the cards.** Each top-level card enters 35-45ms after the previous one, capped at about 6 items so it never feels slow.
- Keep the sidebar and top bar static.
- Optionally use the View Transitions API (`document.startViewTransition`) for the crossfade, with a fallback.
- Scroll position should reset on navigation, and restore on back.

## 5. Component-level motion

**Cards and list rows**
- Hover: background goes to a faint tint over 120ms. Avoid big lifts and shadows in an admin UI; a 1-2px lift at most for clickable cards.
- Press: scale 0.985.
- Table rows: hover tint, and when data is inserted or removed, animate height and opacity with `layout` so other rows slide into place.

**iOS-style switch**
- The thumb slides with `spring.snappy`. On press the thumb widens by about 20% (the signature iOS stretch) and the track color transitions to green over 200ms.

**Segmented control** (正确 / 错误 / 待审核, time ranges)
- A single white thumb slides under the selected segment with `spring.snappy`. Labels change color over 150ms.

**Status badges**
- When a status changes (待审核 → 已审核), crossfade color and text and add a tiny scale pulse (1 → 1.06 → 1) over 250ms.

**Numbers in stat cards**
- Count up from the previous value over about 600ms with an ease-out. Use `font-variant-numeric: tabular-nums` so digits don't jitter.
- Optionally animate digits rolling vertically, like iOS timers.

**Charts**
- On first render, draw the line left to right (`stroke-dashoffset`, about 700ms, ease-out), then fade in the points with a small stagger.
- Fade a soft gradient area in underneath.
- The hover crosshair and tooltip follow the pointer with a light spring (no 1:1 snapping), and the active point scales up.
- When data updates, morph the path instead of redrawing it.

**Search field**
- On focus, a soft blue ring grows from 0 to 3px over 150ms. Clearing animates the × in and out.

## 6. Surfaces that overlay

- **Drawer (event detail):** slides in from the right with `--ease-out-ios` over about 360ms (or `spring.smooth`). The backdrop fades to a 20-30% dim with a light blur. Drag-to-dismiss with velocity: if the user flicks it, it keeps going; if dragged less than 30% and released, it springs back. Add rubber-band resistance past the edge.
- **Popovers (bell, avatar):** scale from 0.96 to 1 and fade, anchored from the trigger (`transform-origin` at the button), 180ms. Close faster than open.
- **Dialogs:** scale 0.97 to 1 with fade, backdrop blur.
- **Toasts:** slide down from the top with a small spring, auto-dismiss, swipe up to dismiss. Stack with `layout` animation.
- **Context menus and dropdowns:** items fade in quickly with no stagger, and highlight with a pill that follows the hovered item.

## 7. Scroll behavior

- **Sticky header with blur.** The page title area gets `backdrop-filter: blur(20px) saturate(180%)` and a bottom hairline that fades in only after scrolling begins (iOS navigation bar).
- **Large title collapsing** into a small inline title is optional, but gives the strongest "Apple" feel.
- Thin, overlay-style scrollbars that fade out when idle.
- Use `scroll-behavior: smooth` only for anchor jumps, not for wheel scrolling.

## 8. Loading and feedback

- **Skeleton shimmer:** a soft gradient sweeping at about 1.4s per cycle. Fade skeletons out and real content in; do not swap instantly.
- **Success:** a checkmark that draws itself (stroke animation, 300ms).
- **Errors:** a short horizontal shake (about 3 oscillations, 4px, 300ms) on the failed field. Don't use red flashing.
- **Real-time monitoring updates:** new values briefly highlight (a soft blue tint fading over 800ms), so the user sees what changed without a jarring pop.

## 9. Performance and accessibility (must-have)

- `@media (prefers-reduced-motion: reduce)`: replace movement with simple opacity fades, and disable stretch, parallax, count-up and shimmer.
- Never block interaction during an animation.
- Use `will-change: transform` only on actively moving elements, and remove it afterwards.
- Test on a throttled CPU (4x slowdown in DevTools). If it drops below 60fps, simplify.
- Avoid animating `backdrop-filter` blur radius itself, since it is expensive. Fade the layer's opacity instead.

## 10. What to avoid

- Overshoot or bounce on everything. It looks playful and unprofessional for a monitoring product.
- Durations over 400ms for routine interactions.
- Linear easing, or the default CSS `ease`, for movement.
- Animating several unrelated things at once. One clear focal motion at a time.
- Different timing for similar interactions. Use only the tokens above.

## 11. Acceptance criteria for Codex

1. Rapidly clicking sidebar items in any order never causes jumps or queued animations.
2. The pill, switch and segmented thumb all use the same spring token family.
3. All animations run at 60fps with no layout shift, and use only transform and opacity.
4. Reduced-motion mode is fully usable.
5. A single `motion.ts` (or `motion.css`) file holds every duration, curve and spring.
6. Record a short screen capture of each interaction for review. Compare against Finder's sidebar, iOS Settings toggles, and the iOS bottom sheet as references.

If you tell me the stack (React, Vue, or plain HTML/CSS/JS), I can write the exact code for the sidebar indicator and the switch, so Codex has a working reference to extend rather than interpreting the description.



New
Here is the full review as plain text you can copy.

# AI Glasses: Prototype Design Review

## Scope and limits

This review covers Codex's five-page PDF: Live Monitor in Light and Dark, three dark-mode drag crops, the AI-1046 event drawer and the S-003 review workspace. The evidence is static images, so anything about motion feel, timing, hover, focus or real contrast ratios is an assumption and is marked as one.

Each priority follows the requested format: issue and severity, visible evidence, smallest change, and a testable acceptance check.

## 1. First five seconds

Demote the metric row, not the video: the four large numerals compete with an empty "no signal" panel, most strongly in Dark.

**Issue and severity:** High in Dark, medium in Light.

**Evidence:**
- Light (page 1): the dark video well is the highest-contrast object, so it probably gets the first glance, but it shows an absence.
- Dark (page 2): the well is almost the same tone as the cards around it. The bright title and the large numerals (3, 1, 1,284, 1) probably pull the eye first.
- The most meaningful content, "识别到桌子和水杯", is small and sits on the right.

**Smallest change:** use smaller numerals (about 20-22px) and muted icon tiles, keeping the same four cards. The video and AI Snapshot then become the only high-contrast zone in both themes.

**Acceptance check:**
- Show each theme to 5 people who haven't seen it and ask what they looked at first. At least 4 of 5 name the video or AI result before the numbers.
- The computed font-size of the metric numerals is below the page title's.

**Observation vs assumption:** the attention order is a prediction from size, contrast and position, not measured.

## 2. State clarity

Keep a quiet anchor on the committed route during a drag, so the dragged capsule reads as a candidate rather than a replacement.

**Issue and severity:** Medium. Mid-drag, the only sidebar highlight is the capsule under the pointer. The sidebar says 设备管理 while the title and breadcrumb still say 实时监控.

**Evidence (page 3):** the held capsule in crop 02 is glossier and slightly oversized compared with the resting capsule in crops 01 and 03, so the preview is distinguishable if you compare frames. In crop 02 alone, however, 实时监控 looks unselected because the capsule has left it.

**Smallest cue:** show the committed item with the capsule at about 35% opacity, or an accent label with a filled icon, during the drag. If the user releases outside any item, the capsule returns to the anchor, which also communicates "cancelled".

**To judge hover and keyboard focus I would need:**
- A hover capture on a non-active item, without pressing, in both themes.
- Focus captures after Tab and after Arrow: ring on the active item, on a non-active item, and on an item that is both.
- The same drag crops in Light mode.
- 8 or more frames at about 50ms of a retarget and of a release-outside cancel.
- Focus-ring contrast against the sidebar (target 3:1 or better).

Arrow moves focus and Enter confirms, so focus and selection are separate states. The design should keep the focus ring and the active marker visually apart.

**Acceptance check:**
- In a mid-drag screenshot in both themes, 5 of 5 viewers can name both the open page and the pointer target.
- The committed item keeps `aria-current="page"` and a visible marker during the drag.
- A plain click with no movement still commits on release without waiting for an animation.

## 3. Operational wording

Paused, no signal and unknown are three different conditions, but today they share one visual language and "unknown" has no representation at all.

**Issue and severity:** Medium.

**Evidence (pages 1-2):**
- Paused: the only signal is the gray chip 自动刷新已关闭 ("auto-refresh off"). It names a mechanism, not whether what I see is frozen, and it has no "as of" time.
- No signal: the "无信号" chip and 暂无视频信号 read as a fault. They sit next to a green 模拟在线 chip, while the center text says the stream is intentionally not attached.
- Undetermined: not shown anywhere in the supplied pages. It may exist elsewhere.

Paused and no-signal are distinguishable only by reading, not at a glance.

**Proposed labels:**

| Condition | Label | Treatment |
|---|---|---|
| Simulation paused | 模拟已暂停 · 数据停在 14:32, plus a 继续 button | Pause glyph, neutral |
| No camera signal | 无视频信号 | Camera-slash glyph, amber, only for a connected device |
| Connection unknown | 连接状态未知 | Hollow dashed dot, gray, values shown as "—" |

**Least clear label:** 自动刷新已关闭 should become 模拟已暂停 · 数据停在 14:32. If the simulation was never started (it is off by default), use 模拟未启动 instead. Also make 模拟在线 an outlined chip so "simulated online" doesn't look like real green online.

**Acceptance check:**
- Show 6 viewers the three states as unlabeled crops. At least 5 of 6 match each to its meaning.
- No two states share both icon and color.
- 无视频信号 never renders beside a solid green online chip.

## 4. Review decisions

The green 处理状态: 成功 badge directly above a red 识别错误 verdict makes the product look self-contradictory; rename it and take it out of green.

**Issue and severity:** High. A non-technical judge reads "success" as "correct" and concludes the product contradicts itself.

**Evidence (page 4):**
- Figure 4: the badge sits at the top of 基础信息, and the verdict control comes later.
- Figure 5: the same verdict appears as a segmented control, while the drawer uses a select. This is a smaller issue, but it can look like two separate fields.

**Smallest change:** rename the field to 请求状态 with the value 请求已完成, in a neutral chip instead of green. Green is then reserved for "识别正确" and online, and "request done" and "result wrong" read as two different axes.

**Second ambiguity (optional):** 可收录 has no reason attached. A one-line caption under 收录资格 would help, but the actual eligibility rule is not in the PDF, so the caption must state the real rule.

**Acceptance check:**
- Show 5 non-team viewers only Figure 4 and ask "Did the request succeed? Was the answer right?" At least 4 of 5 answer yes and no without prompting.
- No green badge appears adjacent to a red verdict.

## 5. Next demo improvement

The biggest gain for the next walkthrough is giving the first screen something to look at, then fixing the success-versus-wrong wording and the three-state labels.

**Top three, ranked:**

1. **Give the first screen something to look at.** Replace the empty well with a clearly labeled simulated frame: an original illustrated desk scene with no people, "桌子" and "水杯" label overlays, and the caption 模拟画面 · 非真实视频. Keep the no-signal state for the offline device.
   - Trade-off: this loosens the "no real media" stance. Event evidence says text-only, so use the same "模拟画面" wording in both places. If you'd rather not add imagery, the fallback is the emphasis change from section 1 alone.
   - Check: at least 4 of 5 viewers say it shows what the glasses see, and at least 4 of 5 say it is not live footage.
2. **Fix 成功 vs 识别错误** (section 4). This is the climax of the demo path. Same acceptance check as section 4.
3. **Three-state wording** (section 3). Same acceptance check as section 3.

The section 2 anchor cue is cheap but only matters for about a second per drag, so it sits outside the top three.

**Leave alone:** the motion system. Page 3 shows the hard parts exist: retargeting, cancel on outside release, and reduced motion. The 4x CPU check already found longer frames, so adding animation adds risk. If frames need fixing, subtract (for example, stop animating blurred layers).

**Not reviewed:** the dataset page (the last step of the demo path), devices, analytics and admin updates, and any live hover or focus behavior.

---

One open question from the doc: should the video panel get a labeled simulated frame, or stay text-only? That decides whether item 1 under section 5 applies or you use only the section 1 fallback.


New01
Yes, I saw it's a competition demo. I answered the three questions at the end of the file literally, which pulled the answer toward workflow and wording. Here is an aesthetics-only brief for Codex. I haven't seen the new login or admin screenshots, so anything about them is a design proposal, not a critique.

---

# Codex brief: premium aesthetics and dynamic visuals

**Direction:** quiet-luxury instrumentation, in the spirit of visionOS and macOS. Layered glass over a soft ambient background, one accent color, restrained motion, and exactly one hero moment per screen. A judge should feel polish within 3 seconds and remember 4-5 signature moments.

## 1. Material system (three layers only)

- **Canvas:** the page background.
- **Raised:** cards, almost opaque.
- **Floating:** sidebar, toolbar, drawer, popovers, toasts. These are the only glass.

Glass on everything hurts legibility, so reserve it for floating surfaces.

```css
:root{
  --glass-bg: rgba(255,255,255,.62);
  --glass-blur: blur(24px) saturate(180%);
  --glass-edge: linear-gradient(180deg, rgba(255,255,255,.9), rgba(255,255,255,.15) 40%, rgba(255,255,255,.35));
  --shadow-float: 0 1px 1px rgba(16,24,40,.04), 0 8px 24px rgba(16,24,40,.08), 0 24px 48px -12px rgba(0,122,255,.10);
}
[data-theme=dark]{
  --glass-bg: rgba(28,34,48,.55);
  --glass-edge: linear-gradient(180deg, rgba(255,255,255,.22), rgba(255,255,255,.04) 45%, rgba(255,255,255,.10));
  --shadow-float: 0 12px 32px rgba(0,0,0,.45);
}
.glass{ position:relative; background:var(--glass-bg); backdrop-filter:var(--glass-blur);
  border-radius:20px; box-shadow:var(--shadow-float); }
.glass::before{ content:""; position:absolute; inset:0; border-radius:inherit; padding:1px;
  background:var(--glass-edge); pointer-events:none;
  -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);
  -webkit-mask-composite:xor; mask-composite:exclude; }
```

- The gradient hairline gives a lit top edge, which is what separates premium glass from a plain translucent box.
- Add a 2-3% noise texture over glass to avoid banding.
- Use layered, accent-tinted shadows, never a single gray shadow.
- Dark mode: lift surfaces with 1-3% white instead of using shadows, and cap body text at about 92% white.
- Use `corner-shape: squircle` as progressive enhancement on icon tiles and cards, with a plain radius as fallback.

## 2. Ambient background

- Two or three large blurred gradient blobs (pale blue, lavender, mint in Light; deep blue and violet in Dark) behind the canvas.
- Drift them very slowly (about 60s per loop) with `transform` only. They show through the glass and create depth.
- Pause when the tab is hidden and under reduced motion. Keep saturation low, since this is a monitoring product.

## 3. Typography and numerals

- Font stack: `-apple-system, "SF Pro Text", "PingFang SC", sans-serif`.
- Page title 28/34 at weight 700. Section title 15/600. Body 13/20. Caption 11.5 in secondary gray.
- Letter-spacing: -0.02em for Latin titles only, and 0 for Chinese.
- Use `font-variant-numeric: tabular-nums` everywhere, and SF Mono for IDs like `AI-1046`.
- Small uppercase eyebrow labels with wide tracking above section titles add editorial polish.
- Stat numerals can carry a subtle top-to-bottom gradient fill, but only for the four hero numbers.

## 4. Hero: the camera panel as a viewfinder

This is the first thing judges see, so make it feel like smart-glasses optics:

- Thin corner brackets, a soft vignette, and a faint grain.
- HUD chips in glass: the device name, 模拟画面, and a pulsing amber dot (no red REC dot, since it is simulated).
- **If you keep the no-signal state:** replace the flat placeholder with a slow concentric focus ring, a faint grid, and a gentle sweep line. It should look like it is searching, not broken.
- **If you add a simulated scene:** when a result arrives, detection brackets draw themselves (250ms). The label pill springs in, and a thin confidence arc fills around it.

## 5. Signature effect: AI edge glow

When a new AI result lands, play a one-shot glowing edge that travels once around the result card, in the style of Apple Intelligence. Don't loop it.

```css
@property --a { syntax:"<angle>"; inherits:false; initial-value:0deg; }
.ai-result.is-new::after{
  content:""; position:absolute; inset:-1px; border-radius:inherit; padding:1.5px; pointer-events:none;
  background:conic-gradient(from var(--a), #0A84FF, #5E5CE6, #BF5AF2, #FF6482, #0A84FF);
  -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);
  -webkit-mask-composite:xor; mask-composite:exclude;
  animation: sweep 1.4s cubic-bezier(.32,.72,0,1) forwards, glowfade 1.4s ease-out forwards;
}
@keyframes sweep{ to{ --a:360deg } }
@keyframes glowfade{ 0%{opacity:0} 15%{opacity:1} 100%{opacity:0} }
```

Reveal the result text with a blur-in (`filter: blur(8px)` and `opacity: 0` to clear, about 450ms), not a plain fade.

## 6. Data visuals

- Charts: monotone-smoothed line, gradient area fill, line draws left to right in about 700ms, and a glowing halo that pulses once on the latest point. The hover crosshair follows with a light spring.
- Stat cards: a tiny sparkline, plus a count-up with tabular numerals.
- Success rate: an animated ring gauge instead of a plain percentage.
- Tables: glass-tint row hover, status dots with a soft glow, and a mini latency bar inside the cell. Don't use zebra stripes.

## 7. Cursor-aware lighting

A faint radial highlight follows the pointer across cards and the sidebar. It is very subtle (about 12-18% white) and gives a sense of physical material.

```css
.card{ position:relative; --mx:50%; --my:0%; }
.card::after{ content:""; position:absolute; inset:0; border-radius:inherit; pointer-events:none; opacity:0;
  background:radial-gradient(240px circle at var(--mx) var(--my), rgba(255,255,255,.35), transparent 60%);
  transition:opacity .2s; }
.card:hover::after{ opacity:1 }
```

Update `--mx` and `--my` from one throttled `pointermove` handler (requestAnimationFrame).

## 8. Choreography between screens

- **Shared-element transitions** (View Transitions API with `view-transition-name`): clicking an event row grows the drawer out of that row. The 查看候选样本 link flies into the review workspace. Provide a plain fade fallback.
- **Login to dashboard** (about 600ms): the login glass card scales down and blurs out, the sidebar slides in, and the cards stagger up (40ms apart, maximum 6).
- **Login page:** a centered glass card over the ambient background. Input focus is a soft blue glow ring, and the demo-fill chip slides in below.
- **Pending-approval screen:** a slowly breathing ring and a three-step progress strip (提交 → 审批中 → 可登录).
- **Admin permission editor:**
  - The 继承 / 允许 / 拒绝 control is a segmented control whose thumb is neutral, green or red.
  - The effective-access preview animates the diff: gained rows slide in with a green tint, lost rows fade with a red tint.
  - A cross-tab permission change plays a one-line glass toast and animates the affected page or editor state.

## 9. Icons and detail

- A consistent 1.5px stroke on a 20px grid, with a filled variant for the active state.
- Stat-card icon tiles: tinted gradient squircles with duotone glyphs.
- Active sidebar item: accent-tinted glass capsule with a soft inner glow.
- Skeleton shimmer at about 1.4s per cycle, with a crossfade into real content.

## 10. Performance guardrails (important)

Codex's 4x CPU check already found longer frames, so stay disciplined:

- At most 3-4 large `backdrop-filter` layers visible at once.
- Never animate blur radius. Fade layer opacity instead.
- `will-change: transform` only on actively moving elements.
- Animate only `transform` and `opacity`. The conic edge glow is a one-shot exception.
- Add a `perf-lite` mode: if sampled frame time runs high for 2 seconds, remove ambient drift and reduce blur automatically.
- Support `prefers-reduced-motion` with opacity-only fades.

## 11. Don't

- Neon or cyberpunk glows, particles, parallax tilt, or looping rainbow gradients.
- Glass behind long text.
- Bounce or overshoot on data components.
- More than one infinite animation on screen at a time (the ambient drift counts as that one).

## 12. Demo beats (build for these five)

1. Login to dashboard entrance.
2. Camera viewfinder plus the AI edge-glow on a new result.
3. Sidebar glass-capsule drag.
4. Event row to drawer shared-element transition.
5. Permission change in one tab, with the observer tab updating live.

## Acceptance

- Light and Dark screenshots at 1440×900 and 1366×768, with text contrast at least 4.5:1 on glass.
- A 30-second screen capture covering all five beats, with no visible jank at 4x CPU throttle (or `perf-lite` engaging cleanly).
- Every duration and curve comes from the motion tokens file, with no one-off values.

If you attach `login-light.png`, `admin-accounts-light.png` and `admin-permissions-dark.png`, I'll turn this into screen-specific notes for those three pages.