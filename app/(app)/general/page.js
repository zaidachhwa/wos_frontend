"use client";

import { useState } from "react";
import { Plus } from "lucide-react";

import AssignedByMeTasks from "@/components/general/AssignedByMeTasks";
import GeneralTaskDialog from "@/components/general/GeneralTaskDialog";
import MyGeneralTasks from "@/components/general/MyGeneralTasks";
import { Button } from "@/components/ui/Field";
import { useAuthStore } from "@/store/authStore";

// "General" section. The Director (and admin) assign simple tasks here;
// everyone sees the tasks assigned to them in "My tasks".
const CREATOR_ROLES = ["director", "admin"];

export default function GeneralPage() {
  const role = useAuthStore((s) => s.user?.role);
  const isCreator = CREATOR_ROLES.includes(role);
  const [tab, setTab] = useState(isCreator ? "created" : "mine");
  const [creating, setCreating] = useState(false);

  return (
    <div className="mx-auto max-w-[1100px] space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">General</h1>
          <p className="mt-1 text-sm text-muted">
            {isCreator ? "Assign simple tasks to anyone and track who completed them on time." : "Tasks assigned to you by the Director."}
          </p>
        </div>
        {isCreator && (
          <Button onClick={() => setCreating(true)}>
            <Plus size={16} /> New task
          </Button>
        )}
      </div>

      {isCreator && (
        <div className="flex gap-1 self-start rounded-btn border border-border bg-surface p-1">
          {[
            ["created", "Assigned by me"],
            ["mine", "My tasks"],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className={`rounded-[8px] px-3 py-1.5 text-sm font-medium transition-colors duration-150 ${
                tab === key ? "bg-primary text-primary-foreground" : "text-muted hover:text-primary"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {isCreator && tab === "created" ? <AssignedByMeTasks /> : <MyGeneralTasks />}

      {isCreator && <GeneralTaskDialog open={creating} onClose={() => setCreating(false)} task={null} />}
    </div>
  );
}
