import { pgTable, text, boolean, timestamp } from 'drizzle-orm/pg-core';

/*
  Only what cannot be derived from the filesystem.

  A file's path is its directory chain plus its name, its size and mime come from `fs.stat` and the
  extension, and its dimensions are nobody's business here — all of that was deliberately left out
  rather than stored and kept in sync. What remains is ownership (which the permission system needs
  and the filesystem cannot answer), the flags governing how the file is served, and alt text.
*/

export const kempoFileDirectory = pgTable('kempoFileDirectory', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),          // validated; the real directory segment on disk
  parentId: text('parentId'),            // self-referential; null = root
  ownerId: text('ownerId').notNull(),    // no FK — matches the uploadedBy-style convention already used
  createdAt: timestamp('createdAt').notNull(),
});

export const kempoFile = pgTable('kempoFile', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),          // validated; the real filename, extension included, on disk
  directoryId: text('directoryId'),      // null = root; stored for filtering, not identity
  kind: text('kind').notNull(),          // derived from the extension at upload; drives the library's type filter
  altText: text('altText').notNull().default(''),

  /*
    public: downloadable with no session at all. Needed because permissions cannot express
    "anyone" — currentUserHasPermission answers 401 the moment there is no token, so it can only
    ever describe which *authenticated* users may act.
  */
  public: boolean('public').notNull().default(false),

  /*
    trusted: someone holding files:upload_trusted vouched for this file's contents, so it is served
    with its real content type and may execute in the browser. Untrusted files are still served —
    just neutered into something that cannot run. See server/utils/serving/resolveDownload.js.
  */
  trusted: boolean('trusted').notNull().default(false),

  /*
    alias: an optional second URL for a public file, so it can be referenced at a path that looks
    like a real file rather than an API endpoint. Resolved through the route:unmatched hook, which
    runs the same gate as the id-based route — an alias is a lookup key, never a bypass.
  */
  alias: text('alias').unique(),

  ownerId: text('ownerId').notNull(),
  createdAt: timestamp('createdAt').notNull(),
  updatedAt: timestamp('updatedAt').notNull(),
});
