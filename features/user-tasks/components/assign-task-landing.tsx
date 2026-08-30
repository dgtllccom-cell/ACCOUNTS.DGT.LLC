"use client";

import { UserTasksView } from "./user-tasks-view";

/**
 * Assign Task landing = the Team Tasks register with the Assign form opened by
 * default, so a manager lands straight on the assignment workspace.
 */
export function AssignTaskLanding({ lang: langProp }: { lang?: string }) {
  return <UserTasksView scope="team" lang={langProp} autoAssign />;
}
