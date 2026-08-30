"use client";

import { useState } from "react";
import { ListPlus } from "lucide-react";
import { useErpScreen } from "@/lib/i18n/use-erp-screen";
import { AssignTaskForm } from "./assign-task-form";
import { UserTasksView } from "./user-tasks-view";

export function AssignTaskLanding({ lang: langProp }: { lang?: string }) {
  const s = useErpScreen("utask", langProp);
  const [showForm, setShowForm] = useState(true);
  const [nonce, setNonce] = useState(0);

  return (
    <>
      {/* Team list underneath so a manager immediately sees what they have assigned. */}
      <UserTasksView key={nonce} scope="team" lang={langProp} />
      {showForm && (
        <AssignTaskForm
          s={s}
          onClose={() => { setShowForm(false); }}
          onCreated={() => { setShowForm(false); setNonce((n) => n + 1); }}
        />
      )}
      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="fixed bottom-6 end-6 z-40 inline-flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-lg hover:bg-indigo-700"
        >
          <ListPlus className="h-4 w-4" /> {s.t("assign_task", "Assign Task")}
        </button>
      )}
    </>
  );
}
