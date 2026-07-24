export const databaseNamingConventions = {
  tableCase: "plural_snake_case",
  columnCase: "snake_case",
  foreignKeySuffix: "_id",
  timestampColumns: ["created_at", "updated_at", "deleted_at"],
  actorColumns: ["created_by", "updated_by", "approved_by", "rejected_by", "posted_by"],
  softDeleteRule: "Use deleted_at instead of permanent delete for business records"
} as const;

export const apiNamingConventions = {
  routeCase: "kebab-case",
  verbs: {
    GET: "list_or_read",
    POST: "create_or_submit_action",
    PATCH: "update_draft_or_editable_fields",
    DELETE: "request_soft_delete_only"
  }
} as const;

export const featureFolderPattern = [
  "actions.ts",
  "validation.ts",
  "permissions.ts",
  "constants.ts",
  "components/",
  "server/",
  "reports/"
] as const;

