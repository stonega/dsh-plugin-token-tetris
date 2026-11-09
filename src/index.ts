/**
 * Host half of the Token Tetris plugin.
 *
 * The game lives entirely in the browser half (`./client`). This module exists
 * so the Loader has a real plugin entry: dsh-client-modules scans live Loader
 * entries, finds this package's manifest through that entry, and serves the
 * `dsh.client` bundle declared in package.json. There is intentionally no Host
 * state, route, or model-facing surface.
 */

export const name = 'dsh-tetris-plugin'

export function apply() {
  // Nothing to install on the Host. The browser half registers the overlay.
}
