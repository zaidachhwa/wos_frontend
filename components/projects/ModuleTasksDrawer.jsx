"use client";

import { useQuery } from "@tanstack/react-query";
import { ClipboardList } from "lucide-react";

import Drawer from "@/components/ui/Drawer";
import Skeleton from "@/components/ui/Skeleton";
import EmptyState from "@/components/ui/EmptyState";
import TaskTable from "@/components/tasks/TaskTable";
import { fetchTasks } from "@/services/taskService";

export default function ModuleTasksDrawer({ module, projectId, onClose, onOpenTask }) {
  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["tasks", { project: projectId, module: module?._id }],
    queryFn: () => fetchTasks({ project: projectId, module: module._id }),
    enabled: Boolean(module),
  });

  return (
    <Drawer open={Boolean(module)} onClose={onClose} title={module?.name || "Module tasks"} wide>
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : tasks.length ? (
        <TaskTable tasks={tasks} onOpen={onOpenTask} />
      ) : (
        <EmptyState icon={ClipboardList} heading="No tasks in this module yet" />
      )}
    </Drawer>
  );
}
