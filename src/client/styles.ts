/**
 * Overlay styles. Everything is scoped under the `tt-` prefix and consumes the
 * shell's `--dsw-*` semantic tokens, so light/dark appearance, font sizes and
 * corner treatment follow the active DSH theme automatically.
 */
export const STYLES = `
.tt-root {
  position: fixed;
  top: max(64px, calc(var(--dsh-frame-top-clearance, 0px) + 16px));
  right: clamp(12px, 2.4vw, 28px);
  display: flex;
  justify-content: flex-end;
  pointer-events: none;
  color: var(--dsw-alias-label-primary);
  font-family: var(--dsw-font-family);
  font-size: var(--dsw-font-xs-13-font-size, 13px);
  line-height: 1.35;
}

.tt-panel {
  position: relative;
  --tt-cell: clamp(11px, 1.05vw, 13px);
  --tt-side: 74px;
  --tt-mini-cell: 8px;
  --tt-i: var(--dsw-static-blue-400);
  --tt-j: var(--dsw-static-blue-600);
  --tt-l: var(--dsw-static-amber-600);
  --tt-o: var(--dsw-static-amber-400);
  --tt-s: var(--dsw-static-green-500);
  --tt-t: var(--dsw-static-deepseek-450);
  --tt-z: var(--dsw-static-red-500);
  pointer-events: auto;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 14px;
  background: color-mix(in srgb, var(--dsw-alias-bg-layer-2) 82%, transparent);
  box-shadow: var(--dsw-elevation-prominent);
  backdrop-filter: var(--dsw-menu-backdrop-filter, blur(20px) saturate(150%));
  -webkit-backdrop-filter: var(--dsw-menu-backdrop-filter, blur(20px) saturate(150%));
  outline: none;
}

body[data-ds-dark-theme] .tt-panel {
  --tt-i: var(--dsw-static-blue-300);
  --tt-j: var(--dsw-static-blue-400);
  --tt-l: var(--dsw-static-amber-400);
  --tt-o: var(--dsw-static-amber-400);
  --tt-s: var(--dsw-static-green-400);
  --tt-t: var(--dsw-static-deepseek-300);
  --tt-z: var(--dsw-static-red-400);
}

.tt-panel:focus-visible {
  outline: 2px solid var(--dsw-focus-ring-color);
  outline-offset: 2px;
}

.tt-head {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 34px;
  padding: 7px 10px 7px 12px;
  border-bottom: 1px solid var(--dsw-alias-border-l1);
  cursor: grab;
  touch-action: none;
  user-select: none;
}

.tt-head .tt-icon:first-of-type {
  margin-left: auto;
}

.tt-grip {
  flex: 0 0 auto;
  color: var(--dsw-alias-label-tertiary);
  font-size: 10px;
  line-height: 1;
  letter-spacing: -2px;
  cursor: inherit;
}

.tt-live {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.tt-dot {
  width: 6px;
  height: 6px;
  flex: 0 0 auto;
  border-radius: 999px;
  background: var(--dsw-alias-state-success-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--dsw-alias-state-success-primary) 16%, transparent);
  animation: tt-pulse 1.8s ease-in-out infinite;
}

.tt-title {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.14em;
  white-space: nowrap;
  color: var(--dsw-alias-label-secondary);
}

.tt-rate {
  flex: 0 0 auto;
  margin-left: 0;
  font-family: var(--ds-font-family-code, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 10px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
  color: var(--dsw-alias-label-tertiary);
}

.tt-kbd {
  flex: 0 0 auto;
  padding: 0 4px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-bottom-width: 2px;
  border-radius: 4px;
  background: color-mix(in srgb, var(--dsw-alias-bg-layer-1) 72%, transparent);
  font-family: var(--ds-font-family-code, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 9px;
  line-height: 15px;
  white-space: nowrap;
  color: var(--dsw-alias-label-tertiary);
}

.tt-rate[data-hot='true'] {
  color: var(--dsw-alias-state-business-primary);
}

.tt-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  flex: 0 0 auto;
  padding: 0;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--dsw-alias-label-tertiary);
  font: inherit;
  font-size: 11px;
  line-height: 1;
  cursor: pointer;
}

.tt-icon:hover {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
}

.tt-icon:active {
  background: var(--dsw-alias-interactive-bg-active);
}

.tt-icon:focus-visible {
  outline: 2px solid var(--dsw-focus-ring-color);
  outline-offset: 1px;
}

.tt-body {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px 0;
}

.tt-board-wrap {
  position: relative;
  flex: 0 0 auto;
}

.tt-board {
  display: grid;
  grid-template-columns: repeat(10, var(--tt-cell));
  grid-template-rows: repeat(20, var(--tt-cell));
  gap: 1px;
  padding: 5px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--dsw-alias-bg-layer-1) 90%, var(--dsw-alias-label-primary) 4%);
  box-shadow: inset 0 0 0 1px var(--dsw-alias-border-l1);
}

.tt-cell {
  width: var(--tt-cell);
  height: var(--tt-cell);
  border-radius: 2px;
  background: color-mix(in srgb, var(--dsw-alias-bg-base) 62%, transparent);
}

.tt-cell[data-piece] {
  --tt-piece-color: var(--tt-t);
  background:
    linear-gradient(
      155deg,
      color-mix(in srgb, var(--tt-piece-color) 68%, var(--dsw-alias-label-primary)) 0%,
      var(--tt-piece-color) 48%,
      color-mix(in srgb, var(--tt-piece-color) 82%, var(--dsw-alias-bg-base)) 100%
    );
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, var(--dsw-alias-label-primary) 24%, transparent),
    inset 0 -2px 0 color-mix(in srgb, var(--dsw-alias-bg-base) 34%, transparent);
}

.tt-cell[data-piece='i'] { --tt-piece-color: var(--tt-i); }
.tt-cell[data-piece='j'] { --tt-piece-color: var(--tt-j); }
.tt-cell[data-piece='l'] { --tt-piece-color: var(--tt-l); }
.tt-cell[data-piece='o'] { --tt-piece-color: var(--tt-o); }
.tt-cell[data-piece='s'] { --tt-piece-color: var(--tt-s); }
.tt-cell[data-piece='t'] { --tt-piece-color: var(--tt-t); }
.tt-cell[data-piece='z'] { --tt-piece-color: var(--tt-z); }

.tt-cell[data-ghost] {
  background: transparent;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--tt-piece-color) 52%, transparent);
  opacity: 0.62;
}

.tt-sand {
  position: absolute;
  inset: 0;
  z-index: 2;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.tt-side {
  display: flex;
  flex: 0 0 var(--tt-side);
  flex-direction: column;
  gap: 9px;
  min-width: 0;
}

.tt-block {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.tt-label {
  font-size: 9px;
  font-weight: 500;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--dsw-alias-label-tertiary);
}

.tt-next {
  display: grid;
  grid-template-columns: repeat(4, var(--tt-mini-cell));
  grid-template-rows: repeat(2, var(--tt-mini-cell));
  gap: 1px;
  width: max-content;
  padding: 4px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--dsw-alias-bg-layer-1) 90%, var(--dsw-alias-label-primary) 4%);
  box-shadow: inset 0 0 0 1px var(--dsw-alias-border-l1);
}

.tt-mini {
  width: var(--tt-mini-cell);
  height: var(--tt-mini-cell);
  border-radius: 1.5px;
  background: color-mix(in srgb, var(--dsw-alias-bg-base) 62%, transparent);
}

.tt-mini[data-piece] {
  --tt-piece-color: var(--tt-t);
  background: var(--tt-piece-color);
  box-shadow: inset 0 1px 0 color-mix(in srgb, var(--dsw-alias-label-primary) 22%, transparent);
}

.tt-mini[data-piece='i'] { --tt-piece-color: var(--tt-i); }
.tt-mini[data-piece='j'] { --tt-piece-color: var(--tt-j); }
.tt-mini[data-piece='l'] { --tt-piece-color: var(--tt-l); }
.tt-mini[data-piece='o'] { --tt-piece-color: var(--tt-o); }
.tt-mini[data-piece='s'] { --tt-piece-color: var(--tt-s); }
.tt-mini[data-piece='t'] { --tt-piece-color: var(--tt-t); }
.tt-mini[data-piece='z'] { --tt-piece-color: var(--tt-z); }

.tt-stats {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.tt-stat {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 6px;
}

.tt-stat-key {
  font-size: 9px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--dsw-alias-label-tertiary);
  white-space: nowrap;
}

.tt-stat-value {
  font-family: var(--ds-font-family-code, ui-monospace, SFMono-Regular, Menlo, monospace);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  color: var(--dsw-alias-label-primary);
  white-space: nowrap;
}

.tt-pad {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 3px;
  margin-top: auto;
}

.tt-pad-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 23px;
  padding: 0;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 6px;
  background: color-mix(in srgb, var(--dsw-alias-bg-layer-1) 76%, transparent);
  color: var(--dsw-alias-label-secondary);
  font: inherit;
  font-size: 11px;
  line-height: 1;
  cursor: pointer;
  touch-action: manipulation;
}

.tt-pad-btn:hover {
  background: var(--dsw-alias-interactive-bg-hover);
  color: var(--dsw-alias-label-primary);
}

.tt-pad-btn:active {
  background: var(--dsw-alias-interactive-bg-active);
}

.tt-pad-btn:focus-visible {
  outline: 2px solid var(--dsw-focus-ring-color);
  outline-offset: 1px;
}

.tt-pad-btn[data-span='2'] {
  grid-column: span 2;
}

.tt-foot {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 22px 9px 12px;
}

.tt-bar {
  flex: 1 1 auto;
  height: 3px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--dsw-alias-bg-skeleton);
}

.tt-bar-fill {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(
    90deg,
    var(--dsw-alias-state-business-primary),
    var(--dsw-alias-state-success-primary)
  );
  transition: width 180ms linear;
}

.tt-hint {
  flex: 0 0 auto;
  font-size: 9px;
  white-space: nowrap;
  color: var(--dsw-alias-label-tertiary);
}

.tt-modal {
  position: absolute;
  inset: 5px;
  z-index: 3;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 5px;
  padding: 12px;
  border-radius: 10px;
  text-align: center;
  background: color-mix(in srgb, var(--dsw-alias-bg-base) 78%, transparent);
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
}

.tt-modal-title {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--dsw-alias-label-primary);
}

.tt-modal-sub {
  font-size: 10px;
  color: var(--dsw-alias-label-tertiary);
}

.tt-modal-btn {
  margin-top: 4px;
  padding: 4px 10px;
  border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 7px;
  background: var(--dsw-alias-button-primary-fill);
  color: var(--dsw-alias-label-primary-inverted);
  font: inherit;
  font-size: 10px;
  font-weight: 500;
  cursor: pointer;
}

.tt-modal-btn:hover {
  background: var(--dsw-alias-button-primary-hover);
}

.tt-modal-btn:focus-visible {
  outline: 2px solid var(--dsw-focus-ring-color);
  outline-offset: 2px;
}

@keyframes tt-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.55; transform: scale(0.82); }
}

@media (max-width: 720px) {
  .tt-root {
    top: max(58px, calc(var(--dsh-frame-top-clearance, 0px) + 10px));
    right: 10px;
  }

  .tt-panel {
    --tt-side: 66px;
  }
}

@media (max-width: 520px) {
  .tt-root {
    top: auto;
    right: 50%;
    bottom: 14px;
    transform: translateX(50%);
  }

  .tt-panel {
    --tt-side: 68px;
  }
}

@media (max-height: 720px) {
  .tt-panel {
    --tt-cell: 11px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .tt-dot {
    animation: none;
  }

  .tt-bar-fill {
    transition: none;
  }
}

/* ---- window management ---- */

.tt-root[data-dragging='true'] .tt-head {
  cursor: grabbing;
}

.tt-resize {
  position: absolute;
  right: 2px;
  bottom: 2px;
  width: 16px;
  height: 16px;
  cursor: nwse-resize;
  touch-action: none;
  opacity: 0.55;
}

.tt-resize::before {
  content: '';
  position: absolute;
  right: 3px;
  bottom: 3px;
  width: 8px;
  height: 8px;
  border-right: 1.5px solid var(--dsw-alias-label-tertiary);
  border-bottom: 1.5px solid var(--dsw-alias-label-tertiary);
  border-bottom-right-radius: 2px;
}

.tt-resize:hover {
  opacity: 1;
}

.tt-root[data-resizing='true'],
.tt-root[data-resizing='true'] * {
  cursor: nwse-resize;
}

/* ---- fullscreen surface ---- */

.tt-root[data-fullscreen='true'] {
  inset: 0;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  padding: 24px;
  box-sizing: border-box;
  pointer-events: auto;
  transform: none;
  background: color-mix(in srgb, var(--dsw-alias-bg-base) 72%, transparent);
  backdrop-filter: blur(10px) saturate(120%);
  -webkit-backdrop-filter: blur(10px) saturate(120%);
}

.tt-root[data-fullscreen='true'] .tt-panel {
  border-radius: 18px;
  background: color-mix(in srgb, var(--dsw-alias-bg-layer-2) 74%, transparent);
  box-shadow: var(--dsw-elevation-prominent);
}

.tt-root[data-fullscreen='true'] .tt-head {
  min-height: 44px;
  padding: 10px 14px;
  cursor: default;
}

.tt-root[data-fullscreen='true'] .tt-grip {
  display: none;
}

.tt-root[data-fullscreen='true'] .tt-title,
.tt-root[data-fullscreen='true'] .tt-rate {
  font-size: 13px;
}

.tt-root[data-fullscreen='true'] .tt-icon {
  width: 30px;
  height: 30px;
  font-size: 14px;
}

.tt-root[data-fullscreen='true'] .tt-body {
  align-items: stretch;
  gap: 18px;
  padding: 16px 18px 0;
}

.tt-root[data-fullscreen='true'] .tt-label,
.tt-root[data-fullscreen='true'] .tt-stat-key {
  font-size: 11px;
}

.tt-root[data-fullscreen='true'] .tt-stat-value {
  font-size: 15px;
}

.tt-root[data-fullscreen='true'] .tt-stats {
  gap: 8px;
}

.tt-root[data-fullscreen='true'] .tt-pad {
  gap: 6px;
}

.tt-root[data-fullscreen='true'] .tt-pad-btn {
  height: 40px;
  border-radius: 9px;
  font-size: 16px;
}

.tt-root[data-fullscreen='true'] .tt-foot {
  gap: 12px;
  padding: 12px 18px 14px;
}

.tt-root[data-fullscreen='true'] .tt-kbd {
  font-size: 11px;
  line-height: 18px;
}

.tt-root[data-fullscreen='true'] .tt-bar {
  height: 4px;
}

.tt-root[data-fullscreen='true'] .tt-resize {
  display: none;
}

@media (prefers-reduced-motion: reduce) {
  .tt-root[data-fullscreen='true'] {
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }
}
`
