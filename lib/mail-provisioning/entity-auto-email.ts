import { createMailbox, suggestEmail } from "./create-mailbox";

export type EntityType = "country" | "main_branch" | "city_branch" | "branch" | "user" | "agent";

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

    case "main_branch":
      // Use main branch name, e.g. "Dubai Main" → "dubai.branch@dgt.llc"
      const mbName = entityData.name || entityData.branch_name || "main";
      baseName = `${mbName}.branch`;
      break;

    case "city_branch":
    case "branch":
      // Use city branch name, e.g. "Karachi Main" → "karachi@dgt.llc"
      baseName = entityData.name || entityData.branch_name || "branch";
      break;

    case "user":
      // Use first.last format, e.g. "Ahmed Khan" → "ahmed.khan@dgt.llc"
      const first = entityData.first_name || entityData.firstName || "";
      const last = entityData.last_name || entityData.lastName || "";
      baseName = first && last ? `${first}.${last}`.replace(/\s+/g, "") : (entityData.username || "user");
      break;

    case "agent":
      // Use agent code/name, e.g. "AG001" → "ag001.agent@dgt.llc"
      const agCode = entityData.code || entityData.agent_code || entityData.name || "agent";
      baseName = `${agCode}.agent`;
      break;

    default:
      baseName = "entity";
  }

  // Clean basename
  const cleanBase = baseName.toLowerCase().replace(/[^a-z0-9.]/g, "-");
  return await suggestEmail(cleanBase);
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
        displayName = entityData.name || "Country Office";
        break;
      case "main_branch":
        displayName = `${entityData.name || "Main Branch"} (HQ)`;
        break;
      case "city_branch":
      case "branch":
        displayName = `${entityData.name || "City Branch"} Office`;
        break;
      case "user":
        displayName = `${entityData.first_name || ""} ${entityData.last_name || ""}`.trim() || entityData.name || "User";
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
      linkedEntityType: entityType as any
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
    main_branch: {
      label: "Create Main Branch Email",
      desc: "Create an official main branch@dgt.llc email account"
    },
    city_branch: {
      label: "Create City Branch Email",
      desc: "Create an official city branch@dgt.llc email account"
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
