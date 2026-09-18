import { createMailbox, suggestEmail } from "./create-mailbox";

export type EntityType = "country" | "branch" | "user" | "agent";

/**
 * Generate email address for entity based on naming rules
 */
export async function generateEntityEmail(
  entityType: EntityType,
  entityData: Record<string, any>
): Promise<string> {
  let baseName = "";

  switch (entityType) {
    case "country":
      // Use country name, e.g. "Pakistan" → "pakistan@dgt.llc"
      baseName = entityData.name || entityData.country_name || "country";
      break;

    case "branch":
      // Use branch name, e.g. "Karachi Main" → "karachi-main@dgt.llc"
      baseName = entityData.name || entityData.branch_name || "branch";
      break;

    case "user":
      // Use first.last format, e.g. "Ahmed Khan" → "ahmed.khan@dgt.llc"
      const first = entityData.first_name || entityData.firstName || "";
      const last = entityData.last_name || entityData.lastName || "";
      baseName = `${first}.${last}`.replace(/\s+/g, "");
      break;

    case "agent":
      // Use agent code/name, e.g. "AG001" → "ag001@dgt.llc"
      baseName = entityData.code || entityData.agent_code || entityData.name || "agent";
      break;

    default:
      baseName = "entity";
  }

  // Get unique suggestion
  return await suggestEmail(baseName);
}

/**
 * Provision auto-email for entity (called on entity creation)
 */
export async function provisionEntityEmail(
  entityType: EntityType,
  entityId: string,
  entityData: Record<string, any>,
  shouldCreate: boolean = false
): Promise<{
  success: boolean;
  emailAddress?: string;
  error?: string;
}> {
  if (!shouldCreate) {
    return { success: true }; // User didn't request auto-email
  }

  try {
    // Generate email address
    const emailAddress = await generateEntityEmail(entityType, entityData);

    // Get display name
    let displayName = "";
    switch (entityType) {
      case "country":
        displayName = entityData.name || "Country";
        break;
      case "branch":
        displayName = `${entityData.name || "Branch"} Office`;
        break;
      case "user":
        displayName = `${entityData.first_name || ""} ${entityData.last_name || ""}`.trim() || "User";
        break;
      case "agent":
        displayName = entityData.name || `Agent ${entityData.code || ""}`;
        break;
    }

    // Provision mailbox
    const result = await createMailbox({
      emailAddress,
      displayName,
      purpose: "entity_email",
      linkedEntityId: entityId,
      linkedEntityType: entityType
    });

    if (!result.success) {
      return {
        success: false,
        error: result.error || "Failed to provision email"
      };
    }

    return {
      success: true,
      emailAddress: result.emailAddress
    };
  } catch (err: any) {
    return {
      success: false,
      error: err.message
    };
  }
}

/**
 * Integration point: call this from entity creation endpoints
 * Example: when creating a Country, if createEmail checkbox is true, call this
 */
export function getAutoEmailParams(entityType: EntityType): {
  checkboxLabel: string;
  description: string;
} {
  const labels: Record<EntityType, { label: string; desc: string }> = {
    country: {
      label: "Create DGT Email",
      desc: "Create an official country@dgt.llc email account"
    },
    branch: {
      label: "Create Branch Email",
      desc: "Create a branch office email account"
    },
    user: {
      label: "Create User Email",
      desc: "Create an official user.name@dgt.llc email account"
    },
    agent: {
      label: "Create Agent Email",
      desc: "Create an agent@dgt.llc email account"
    }
  };

  const config = labels[entityType];
  return {
    checkboxLabel: config.label,
    description: config.desc
  };
}
