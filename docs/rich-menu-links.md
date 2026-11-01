# LINE rich-menu web links

The setup script uses two app origins:

- `PUBLIC_BASE_URL`: the separate Purchase app; Purchase links use `/purchases`.
- `NEW_PUBLIC_BASE_URL`: Inventra; Order and Movement links use `/orders` and
  `/movements`. Both are generated from this setting; neither has a hardcoded host.

After changing an origin, existing LINE menus must be republished: changing an
application environment variable does not modify definitions already held by LINE.
`npm run setup:rich-menu` creates and activates all four menus. For a domain-only
change where existing artwork/actions/defaults should remain unchanged, use a
selective replacement instead:

1. Read and privately back up LINE's menu list, aliases, default menu, and the
   active submenu definitions/images using the configured channel access token.
2. Clone the active Order and Movement definitions, replacing only the intended
   old-origin URI actions. Preserve command messages, bounds, text, Back actions,
   and Purchase links. Check new destinations and POST `/richmenu/validate`.
3. Create replacement menu IDs and upload the original images. Verify definitions
   and downloaded image hashes before switching any aliases.
4. Repoint only `order-menu` and `movement-menu`. Keep Main/Purchase aliases and
   the default menu unchanged. Re-read the active aliases and definitions to prove
   the new URLs are live. Restore the original aliases if publication verification
   fails. Retain old menus for rollback; do not bulk-delete historical menus.

Someone already viewing an old submenu should tap **Back**, then open that
submenu again so LINE resolves its updated alias. No chat message or webhook
change is required for the menu URL update itself.
