import { defineConfig } from 'drizzle-kit';

/*
  Local/CI test-database setup only — this extension has no migrations of its own in production.
  Its tables are created the real way, via createTablesFromSchema at install time (see install.js
  and installExtension in kempo's sdk), which the data-layer and API-contract suites exercise
  directly. This file exists so `npx drizzle-kit push` can stand up a throwaway database with both
  kempo's core tables (user/session/permission/hook/...) and this extension's own, mirroring the
  schema array kempo's app-drizzle.config.js template scaffolds into a real site.

  No dotenv here on purpose: nothing in this repo's own runtime loads .env either, so pulling it in
  only for this file would be one more dependency to explain rather than one less step.
  DATABASE_URL needs to be a real environment variable — export it, or prefix the command.
*/
export default defineConfig({
  schema: [
    './server/db/schema.js',
    './node_modules/kempo/server/db/schema.js',
  ],
  out: './server/db/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
