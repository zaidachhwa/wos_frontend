"use client";

import { useState } from "react";
import { Plus, BarChart3, History, ShieldAlert } from "lucide-react";

import AppraisalTabs from "@/components/appraisal/AppraisalTabs";
import EvaluationDialog from "@/components/appraisal/evaluations/EvaluationDialog";
import MonthlyPerformanceView from "@/components/appraisal/evaluations/MonthlyPerformanceView";
import EvaluationHistoryTable from "@/components/appraisal/evaluations/EvaluationHistoryTable";
import { Button } from "@/components/ui/Field";
import EmptyState from "@/components/ui/EmptyState";
import { useAuthStore } from "@/store/authStore";
import { VIEW_ALL_ROLES, TEAM_LEAD_ROLES } from "@/lib/appraisal";

export default function PerformanceEvaluationsPage() {
  const role = useAuthStore((s) => s.user?.role);
  const canAccess = [...VIEW_ALL_ROLES, ...TEAM_LEAD_ROLES, "member"].includes(role);

  const [activeTab, setActiveTab] = useState("breakdown"); // "breakdown" | "history"
  const [dialogState, setDialogState] = useState({
    open: false,
    employeeId: "",
    criterionId: "",
    date: "",
  });

  if (!canAccess) {
    return (
      <EmptyState
        icon={ShieldAlert}
        heading="Access Denied"
        description="You do not have permission to view performance evaluations."
      />
    );
  }

  const handleOpenEvaluationDialog = (employeeId = "", criterionId = "", date = "") => {
    setDialogState({
      open: true,
      employeeId,
      criterionId,
      date,
    });
  };

  const handleCloseDialog = () => {
    setDialogState({
      open: false,
      employeeId: "",
      criterionId: "",
      date: "",
    });
  };

  return (
    <div className="mx-auto max-w-[1200px] space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Performance Evaluations
          </h1>
          <p className="mt-1 text-sm text-muted">
            Track, record, and audit frequency-based evaluations (Daily, Weekly, Biweekly, Monthly) with transparent calculation scoring.
          </p>
        </div>

        {role !== "member" && (
          <Button
            onClick={() => handleOpenEvaluationDialog()}
            className="flex items-center gap-1.5"
          >
            <Plus size={16} />
            Record Evaluation
          </Button>
        )}
      </div>

      {/* Main Appraisal Navigation Tabs */}
      <AppraisalTabs />

      {/* Secondary Tab Switcher */}
      <div className="flex gap-1 self-start rounded-btn border border-border bg-surface p-1">
        <button
          type="button"
          onClick={() => setActiveTab("breakdown")}
          className={`flex items-center gap-2 rounded-[8px] px-3.5 py-1.5 text-sm font-medium transition-colors duration-150 ${
            activeTab === "breakdown"
              ? "bg-primary text-primary-foreground"
              : "text-muted hover:text-primary"
          }`}
        >
          <BarChart3 size={15} />
          Monthly Breakdown & Score Calculation
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("history")}
          className={`flex items-center gap-2 rounded-[8px] px-3.5 py-1.5 text-sm font-medium transition-colors duration-150 ${
            activeTab === "history"
              ? "bg-primary text-primary-foreground"
              : "text-muted hover:text-primary"
          }`}
        >
          <History size={15} />
          Evaluation History & Log
        </button>
      </div>

      {/* Tab Panels */}
      {activeTab === "breakdown" ? (
        <MonthlyPerformanceView
          onRecordEvaluation={role !== "member" ? handleOpenEvaluationDialog : undefined}
        />
      ) : (
        <EvaluationHistoryTable
          onRecordEvaluation={role !== "member" ? handleOpenEvaluationDialog : undefined}
        />
      )}

      {/* Record Evaluation Dialog Modal */}
      <EvaluationDialog
        open={dialogState.open}
        onClose={handleCloseDialog}
        initialEmployeeId={dialogState.employeeId}
        initialCriterionId={dialogState.criterionId}
        initialDate={dialogState.date}
      />
    </div>
  );
}
