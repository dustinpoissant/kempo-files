# kempo-files

A file library for [kempo](https://github.com/dustinpoissant/kempo). Upload files into real folders, manage them from the admin, and serve them through an API that checks permissions before a single byte goes out.

Not only a media library. Images, video and audio are the common case, but the design is deliberately generic: STL files for a store, `.mcaddon` packs for a download page, PDFs, fonts, scripts. Anything you want to keep and hand out.

---

## What makes this different from a public uploads folder

**Files live in `files/` at the site root — a sibling of `public/`, never inside it.** kempo-server's static file scanner is rooted at `public/`, so nothing in the library can be served by accident. Every download goes through a route that has checked a permission and fired a hook first.

That one decision is what makes the rest possible:

- **Per-file access.** A file is either `public` (anyone can fetch it) or restricted to users holding `files:download`.
- **A veto hook.** `file:before_download` fires on every download. A store extension can refuse a file that has not been paid for; a scanner can hold one back until it has finished looking at it. kempo-files never needs to know why.
- **Trust, rather than a banned-types list.** See below.
- **Real folders and real filenames.** A download arrives called `assembly-manual.pdf`, not `a1b2c3d4.pdf`.

---

## Trusted files

The usual advice is to refuse uploads of "dangerous" types. That is the wrong tool here — an admin uploading `analytics.js` to reference from a page is not an attacker, and they can already put a `<script>` tag straight into a template. Blocking them protects against nothing.

The real question is not *what type is this* but *did somebody decide this is safe to run*. So there is no allowlist and no denylist. Instead every file has a `trusted` flag, and how it is served depends on it:

| | Trusted | Not trusted |
|---|---|---|
| `.js`, `.html`, `.css`, `.svg`, `.json`, source code | Real content type — a script referenced with `<script src>` executes | `text/plain` + `nosniff` — the source is **viewable but cannot execute or render as markup** |
| Images, video, audio, archives, fonts, 3D models | Real content type | Real content type — rendering these cannot run anything |
| PDFs, Office files, unknown binaries | Real content type | `application/octet-stream` as an attachment — never rendered in place |

Only users holding `files:upload_trusted` can set the flag. Everyone else can upload freely; their files just arrive unreviewed.

### Files that are never up for review

Everything uploaded through the library is site content somebody might reference from a page, so reviewing it makes sense. But an extension can store files on behalf of **users** — a private per-user space, a form attachment, anything member-supplied — and for those, approval is not merely unnecessary, it is dangerous: approving an arbitrary member's `.js` would let it execute on your site's own origin.

So `storeUpload` takes a `reviewable` flag, defaulting to true:

```javascript
await storeUpload({ name, data, ownerId, reviewable: false });
```

A file marked unreviewable is a one-way gate, not a filter:

- it never appears in the **Needs review** queue, so a site with a per-user file space doesn't bury its real review work under every document its members ever uploaded
- `setFileTrust` refuses to grant it trust — with a 409, from any route, for anybody
- it is served as inert text **at the response** even if the trusted flag somehow got set anyway (a row edited in the database, a restore from a backup taken before the flag existed)
- the admin shows it as *Not up for review* rather than *Unreviewed*, and hides every approve control for it

Withdrawing trust is still allowed — making a file less dangerous is never refused. There is deliberately **no route that flips the flag**: only the code that stores the file decides, because a flag an admin could clear and then approve would not be a guarantee.

Serving untrusted source as plain text also *is* the review mechanism — an unreviewed file's own URL shows its source safely, so there is no separate code viewer to build. The admin has a **Needs review** filter for finding them.

**Trust does not survive a content replacement by an untrusted writer.** Replace an approved file's bytes and, unless you personally hold `files:upload_trusted`, it drops back to unreviewed — regardless of who owns it. Otherwise approval would be a one-time thing you could get and then quietly swap out from under.

---

## Aliases

The canonical URL for a file is `/kempo-files/api/files/<id>`, which is fine for an `<img>` but reads like plumbing. A **public** file can also be given an alias — a real-looking path it is additionally served at:

```html
<script src="scripts/analytics.js"></script>
<img src="images/hero.jpg">
```

Aliases work through kempo's `route:unmatched` hook, which fires for URLs nothing else on the site claimed. Because that only runs after every real route, page and static file has been ruled out, an alias can never shadow something else — and no prefix or configuration is needed.

An alias is a second way to look a file up, **never a second set of rules**: it runs the same permission check, the same `file:before_download` veto and the same trusted/untrusted serving decision as the id URL. Making a file private removes its alias, since a bare public path pointing at a private file is exactly the confusion worth avoiding.

**An alias chooses its directory, not its filename** — `scripts/analytics.js` is allowed for `analytics.js`, `scripts/anything-else.js` is not. Otherwise a `.js` file could be published as `photo.png`, and the extension a browser reads to decide how to treat the response would stop matching the file actually being served. Renaming a file carries its alias along, so the rule never strands one.

The canonical `/kempo-files/api/files/<id>` URL keeps working whether or not an alias exists, and regardless of what the alias is later changed to — it is the address to use anywhere the link has to keep resolving.

Requires kempo with `route:unmatched` support and a `public/CATCH.js` in the site (kempo scaffolds one for new sites; see *Upgrading an existing site* below).

---

## Install

```bash
npm install kempo-files
```

Then enable it from the admin's Extensions screen, which creates the tables, registers the permissions and creates `files/`.

### Upgrading an existing site

Sites scaffolded before `route:unmatched` existed have a `public/CATCH.page.html` but no `public/CATCH.js`. Everything except aliases works without it. To enable aliases, add this file:

```javascript
// public/CATCH.js
import { dirname } from 'path';
import { fileURLToPath } from 'url';
import serveUnmatched from 'kempo/server/utils/routing/serveUnmatched.js';

export default (request, response) => serveUnmatched(request, response, dirname(fileURLToPath(import.meta.url)));
```

Keep `CATCH.page.html` where it is — it stays the page rendered for a genuine 404.

---

## Permissions

Ownership follows the own/others pattern used elsewhere in kempo: `files:own:update` covers what you uploaded, `files:others:update` covers everything. Holding the second does not require the first.

| Permission | Allows |
|---|---|
| `files:browse` | List and view the library (also covers navigating folders) |
| `files:upload` | Upload files, and replace the contents of existing ones |
| `files:upload_trusted` | Mark files trusted, so they are served as their real type |
| `files:download` | Download files that are not public |
| `files:own:update` / `files:others:update` | Rename, move, alias, edit alt text |
| `files:own:delete` / `files:others:delete` | Delete files |
| `directories:create` | Create folders |
| `directories:own:update` / `directories:others:update` | Rename or move folders |
| `directories:own:delete` / `directories:others:delete` | Delete folders |

Two groups ship ready to use: **kempo-files:contributor** (upload and manage your own) and **kempo-files:trusted_uploader** (the same, plus approving files). Administrators bypass permission checks entirely, so they get everything without configuration.

---

## Hooks

| Event | Bails? | When |
|---|---|---|
| `file:before_upload` | yes | Before a file is stored, or its contents replaced. Throw `{ code, msg }` to refuse it — this is where a site puts its own upload policy, e.g. no `.exe`. |
| `file:uploaded` | no | After a file lands. Where a scanner or thumbnail generator picks it up. |
| `file:before_download` | yes | Before any download, public or not. Throw `{ code, msg }` to block it. |
| `file:deleted` | no | After a file is removed, with the row it had. Where anything *derived* from a file — a generated thumbnail, a cached transcode, an index entry — cleans up after itself. Not bail-capable: the bytes are already gone, and there is no undo to refuse into. |

Handlers are awaited in sequence, so anything slow — an external API call, a model — should be started and left to run rather than awaited inline, or every upload waits for it.

```javascript
// hooks/no-executables.js
export default async ({ name }) => {
  if(name.endsWith('.exe')) throw { code: 415, msg: 'Executables are not accepted here' };
};
```

---

## SDK

Server-side, for other extensions and hooks:

```javascript
import { listFiles, storeUpload, filePath } from 'kempo-files/sdk';
```

These are the data operations, with no permission checks of their own — the routes enforce who may do what, and anything calling in here is server-side code that has already decided it is allowed.

Alongside the CRUD, three folder-tree reads exist for extensions that need to reason about *where* something is rather than what it is:

| | |
|---|---|
| `getDirectory(id)` | One folder row |
| `directoryAncestry(id)` | Its ancestry as whole rows, root-first, the folder itself last |
| `directorySubtree(id)` | Every folder at or below it, one query per level rather than one per folder |

`directoryAncestry` is how an extension answers "is this folder inside the subtree I own?" — by ids rather than by comparing path strings, which change the moment anything above them is renamed. `kempo-files/sdk`'s `directoryPath` walks the same chain but only ever needed the names, and two folders under different parents can share a name. `kempo-user-dirs` uses it for every containment check it makes.

In the browser, served at `/kempo-files/sdk.js`:

```javascript
import { listFiles, uploadFile, urlForFile } from '/kempo-files/sdk.js';
```

Both return `[error, data]` tuples, matching the rest of kempo.

---

## Deliberately out of scope

- **Thumbnails.** No `sharp` dependency, no generation. Images preview from the original. A separate extension's job.
- **A private per-user space.** Its own extension built on this one: [kempo-user-dirs](https://github.com/dustinpoissant/kempo-user-dirs).
- **Reference tracking.** Deleting a file does not check whether anything links to it. Doing that properly means understanding every extension's content, and guessing badly would be worse than being clear it does not happen.
- **Streaming uploads.** Bodies are buffered in memory before a route runs, which is kempo-server's model. `max_upload_size_mb` (default 250) is the ceiling.

---

## Development

```bash
npm install
npm run link:local          # use sibling checkouts of kempo, kempo-server, kempo-ui
docker compose up -d        # test database on 5436
export DATABASE_URL=postgresql://kempo:kempo_files_test_password@localhost:5436/kempo_files_test
npx drizzle-kit push --force
npm test
```

Database-backed suites skip themselves when no database is reachable, so `npm test` still runs cleanly without one — check for `(SKIPPED)` in the output before assuming everything ran.
