// Backward-compat barrel: DB access moved to lib/db/{client,queries}.ts so
// SQLite (dev) and Postgres (prod, via DATABASE_URL) share one query layer.
// All call sites still just `import { ... } from "@/lib/db"`.
export * from "@/lib/db/queries";
export { dialect } from "@/lib/db/client";
