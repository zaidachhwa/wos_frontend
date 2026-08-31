"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuthStore } from "@/store/authStore";
import { fetchDashboardSummary, fetchProjectAnalytics, fetchUserAnalytics } from "@/services/analyticsService";
import { fetchProjects } from "@/services/projectService";
import { fetchUsers } from "@/services/orgService";
import { exportToCSV, exportToExcel, exportToPDF } from "@/lib/exportUtils";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from "recharts";

import Skeleton from "@/components/ui/Skeleton";
import Pagination from "@/components/ui/Pagination";

const COLORS = ["#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#f97316"];

export default function AnalyticsPage() {
  const me = useAuthStore((s) => s.user);
  const canAccess = ["admin", "manager", "subadmin", "hr"].includes(me?.role);

  // Filters state
  const [dateRange, setDateRange] = useState("thisMonth");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [selectedUser, setSelectedUser] = useState("");
  const [selectedProject, setSelectedProject] = useState("");
  const [minHours, setMinHours] = useState("");
  const [maxHours, setMaxHours] = useState("");
  
  // Tab state
  const [activeTab, setActiveTab] = useState("projects"); // "projects" or "users"
  
  // Table state
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("timeDesc"); // timeDesc, timeAsc, nameAsc, nameDesc

  if (!canAccess) {
    return <div className="p-8 text-center text-muted">You do not have permission to view Analytics.</div>;
  }

  // Derived filter params
  let startDate = "";
  let endDate = "";
  const today = new Date();
  
  if (dateRange === "today") {
    startDate = today.toISOString().split("T")[0];
    endDate = startDate;
  } else if (dateRange === "thisWeek") {
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    startDate = startOfWeek.toISOString().split("T")[0];
    endDate = today.toISOString().split("T")[0];
  } else if (dateRange === "thisMonth") {
    startDate = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split("T")[0];
    endDate = today.toISOString().split("T")[0];
  } else if (dateRange === "custom") {
    startDate = customStart;
    endDate = customEnd;
  }

  const queryParams = {
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    user: selectedUser || undefined,
    project: selectedProject || undefined,
    minHours: minHours || undefined,
    maxHours: maxHours || undefined,
    sort,
    page,
    limit: 10
  };

  const { data: summary, isLoading: loadingSummary } = useQuery({
    queryKey: ["analytics", "dashboard", queryParams],
    queryFn: () => fetchDashboardSummary(queryParams),
  });

  const { data: projectData, isLoading: loadingProjects } = useQuery({
    queryKey: ["analytics", "projects", queryParams],
    queryFn: () => fetchProjectAnalytics(queryParams),
  });

  const { data: userData, isLoading: loadingUsers } = useQuery({
    queryKey: ["analytics", "users", queryParams],
    queryFn: () => fetchUserAnalytics(queryParams),
  });

  const { data: allProjects = [] } = useQuery({ queryKey: ["projects"], queryFn: fetchProjects });
  const { data: allUsers = [] } = useQuery({ queryKey: ["users"], queryFn: fetchUsers });

  const resetFilters = () => {
    setDateRange("thisMonth");
    setCustomStart("");
    setCustomEnd("");
    setSelectedUser("");
    setSelectedProject("");
    setMinHours("");
    setMaxHours("");
    setPage(1);
  };

  const handleExport = (format) => {
    const isProj = activeTab === "projects";
    const data = isProj ? projectData?.projects : userData?.users;
    if (!data) return;

    if (format === "csv") {
      exportToCSV(data, `${activeTab}_analytics.csv`);
    } else if (format === "excel") {
      exportToExcel(data, `${activeTab}_analytics.xlsx`);
    } else if (format === "pdf") {
      const headers = isProj ? ["Project Name", "Total Hours", "Total Contributors"] : ["User Name", "Total Hours", "Total Projects"];
      const rows = data.map((item) => 
        isProj ? [item.projectName, (item.totalMinutes / 60).toFixed(1), item.totalUsers] : [item.userName, (item.totalMinutes / 60).toFixed(1), item.totalProjects]
      );
      exportToPDF(headers, rows, `Analytics Report (${activeTab})`, `${activeTab}_analytics.pdf`);
    }
  };

  return (
    <div className="mx-auto max-w-[1600px] space-y-6 pb-12">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h1 className="text-2xl font-bold tracking-tight">Project Analytics & Reports</h1>
        <div className="flex gap-2">
          <button onClick={() => handleExport("csv")} className="px-3 py-1.5 text-sm bg-surface border border-border rounded hover:bg-muted/10 transition">CSV</button>
          <button onClick={() => handleExport("excel")} className="px-3 py-1.5 text-sm bg-surface border border-border rounded hover:bg-muted/10 transition">Excel</button>
          <button onClick={() => handleExport("pdf")} className="px-3 py-1.5 text-sm bg-surface border border-border rounded hover:bg-muted/10 transition">PDF</button>
        </div>
      </div>

      {/* Filters */}
      <section className="bg-surface border border-border p-5 rounded-card space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-base font-semibold">Filters</h2>
          <button onClick={resetFilters} className="text-sm text-primary hover:underline">Reset Filters</button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted">Date Range</label>
            <select 
              value={dateRange} 
              onChange={(e) => setDateRange(e.target.value)}
              className="w-full rounded-input border border-border bg-transparent px-3 py-2 text-sm focus:border-primary focus:outline-none"
            >
              <option value="today">Today</option>
              <option value="thisWeek">This Week</option>
              <option value="thisMonth">This Month</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>

          {dateRange === "custom" && (
            <div className="space-y-1 flex gap-2">
              <div className="w-1/2">
                <label className="text-xs font-medium text-muted">Start</label>
                <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="w-full rounded-input border border-border bg-transparent px-2 py-2 text-sm" />
              </div>
              <div className="w-1/2">
                <label className="text-xs font-medium text-muted">End</label>
                <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="w-full rounded-input border border-border bg-transparent px-2 py-2 text-sm" />
              </div>
            </div>
          )}

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted">Project</label>
            <select 
              value={selectedProject} 
              onChange={(e) => setSelectedProject(e.target.value)}
              className="w-full rounded-input border border-border bg-transparent px-3 py-2 text-sm focus:border-primary focus:outline-none"
            >
              <option value="">All Projects</option>
              {allProjects?.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted">User</label>
            <select 
              value={selectedUser} 
              onChange={(e) => setSelectedUser(e.target.value)}
              className="w-full rounded-input border border-border bg-transparent px-3 py-2 text-sm focus:border-primary focus:outline-none"
            >
              <option value="">All Users</option>
              {allUsers?.map(u => <option key={u._id} value={u._id}>{u.name}</option>)}
            </select>
          </div>

          <div className="space-y-1 flex gap-2">
            <div className="w-1/2">
              <label className="text-xs font-medium text-muted">Min Hrs</label>
              <input type="number" value={minHours} onChange={e => setMinHours(e.target.value)} placeholder="0" className="w-full rounded-input border border-border bg-transparent px-3 py-2 text-sm" />
            </div>
            <div className="w-1/2">
              <label className="text-xs font-medium text-muted">Max Hrs</label>
              <input type="number" value={maxHours} onChange={e => setMaxHours(e.target.value)} placeholder="∞" className="w-full rounded-input border border-border bg-transparent px-3 py-2 text-sm" />
            </div>
          </div>
        </div>
      </section>

      {/* Summary Cards */}
      {loadingSummary ? (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-24 rounded-card" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="bg-surface border border-border p-4 rounded-card flex flex-col justify-center">
            <p className="text-xs text-muted mb-1">Total Projects</p>
            <p className="text-2xl font-bold">{summary?.totalProjects || 0}</p>
          </div>
          <div className="bg-surface border border-border p-4 rounded-card flex flex-col justify-center">
            <p className="text-xs text-muted mb-1">Active Users</p>
            <p className="text-2xl font-bold">{summary?.totalActiveUsers || 0}</p>
          </div>
          <div className="bg-surface border border-border p-4 rounded-card flex flex-col justify-center">
            <p className="text-xs text-muted mb-1">Total Worked</p>
            <p className="text-2xl font-bold text-primary">{summary?.totalWorkingHours || 0} hrs</p>
          </div>
          <div className="bg-surface border border-border p-4 rounded-card flex flex-col justify-center">
            <p className="text-xs text-muted mb-1">Most Active Project</p>
            <p className="text-sm font-semibold truncate">{summary?.mostActiveProject?.name || "-"}</p>
            {summary?.mostActiveProject && <p className="text-xs text-muted">{summary.mostActiveProject.hours} hrs</p>}
          </div>
          <div className="bg-surface border border-border p-4 rounded-card flex flex-col justify-center">
            <p className="text-xs text-muted mb-1">Most Active User</p>
            <p className="text-sm font-semibold truncate">{summary?.mostActiveUser?.name || "-"}</p>
            {summary?.mostActiveUser && <p className="text-xs text-muted">{summary.mostActiveUser.hours} hrs</p>}
          </div>
        </div>
      )}

      {/* Tabs & Sorting */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 mt-6">
        <div className="flex gap-1 rounded-btn border border-border bg-surface p-1">
          <button 
            onClick={() => { setActiveTab("projects"); setPage(1); }}
            className={`rounded-[8px] px-4 py-1.5 text-sm font-medium transition-colors ${activeTab === "projects" ? "bg-primary text-primary-foreground" : "text-muted hover:text-primary"}`}
          >
            Project-Wise Analytics
          </button>
          <button 
            onClick={() => { setActiveTab("users"); setPage(1); }}
            className={`rounded-[8px] px-4 py-1.5 text-sm font-medium transition-colors ${activeTab === "users" ? "bg-primary text-primary-foreground" : "text-muted hover:text-primary"}`}
          >
            User-Wise Analytics
          </button>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted">Sort by:</span>
          <select 
            value={sort} 
            onChange={(e) => { setSort(e.target.value); setPage(1); }}
            className="rounded-input border border-border bg-surface px-3 py-1.5 text-sm focus:border-primary focus:outline-none"
          >
            <option value="timeDesc">Highest Time Spent</option>
            <option value="timeAsc">Lowest Time Spent</option>
            <option value="nameAsc">Name (A-Z)</option>
            <option value="nameDesc">Name (Z-A)</option>
          </select>
        </div>
      </div>

      {/* Data Visualization & Tables */}
      {activeTab === "projects" ? (
        <div className="space-y-6">
          {/* Chart */}
          {projectData?.projects?.length > 0 && (
            <div className="bg-surface border border-border rounded-card p-6 h-80">
              <h3 className="text-sm font-semibold mb-4">Top Projects by Time Spent (Filtered)</h3>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={projectData.projects.slice(0, 10).map(p => ({ name: p.projectName, hours: Number((p.totalMinutes / 60).toFixed(1)) }))}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="var(--muted)" />
                  <YAxis tick={{ fontSize: 12 }} stroke="var(--muted)" />
                  <Tooltip cursor={{ fill: 'var(--muted)', opacity: 0.1 }} contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)' }} />
                  <Bar dataKey="hours" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Table */}
          <div className="bg-surface border border-border rounded-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/10 border-b border-border">
                  <tr>
                    <th className="px-4 py-3 font-medium">Project Name</th>
                    <th className="px-4 py-3 font-medium">Total Time Spent</th>
                    <th className="px-4 py-3 font-medium">Total Contributors</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loadingProjects ? (
                    <tr><td colSpan={3} className="p-4 text-center text-muted">Loading...</td></tr>
                  ) : projectData?.projects?.length === 0 ? (
                    <tr><td colSpan={3} className="p-8 text-center text-muted">No projects match the current filters.</td></tr>
                  ) : (
                    projectData?.projects?.map((proj) => (
                      <tr key={proj.projectId} className="hover:bg-muted/5 transition cursor-pointer">
                        <td className="px-4 py-3 font-medium">{proj.projectName}</td>
                        <td className="px-4 py-3">{Math.floor(proj.totalMinutes / 60)}h {proj.totalMinutes % 60}m</td>
                        <td className="px-4 py-3">{proj.totalUsers} users</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {projectData?.pagination && (
              <div className="p-4 border-t border-border">
                <Pagination 
                  page={projectData.pagination.page} 
                  totalPages={projectData.pagination.totalPages} 
                  total={projectData.pagination.total} 
                  onPageChange={setPage} 
                />
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Chart */}
          {userData?.users?.length > 0 && (
            <div className="bg-surface border border-border rounded-card p-6 h-80">
              <h3 className="text-sm font-semibold mb-4">Top Users by Time Spent (Filtered)</h3>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={userData.users.slice(0, 10).map(u => ({ name: u.userName, hours: Number((u.totalMinutes / 60).toFixed(1)) }))}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} stroke="var(--muted)" />
                  <YAxis tick={{ fontSize: 12 }} stroke="var(--muted)" />
                  <Tooltip cursor={{ fill: 'var(--muted)', opacity: 0.1 }} contentStyle={{ borderRadius: '8px', border: '1px solid var(--border)' }} />
                  <Bar dataKey="hours" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Table */}
          <div className="bg-surface border border-border rounded-card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/10 border-b border-border">
                  <tr>
                    <th className="px-4 py-3 font-medium">User Name</th>
                    <th className="px-4 py-3 font-medium">Total Time Spent</th>
                    <th className="px-4 py-3 font-medium">Total Projects</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {loadingUsers ? (
                    <tr><td colSpan={3} className="p-4 text-center text-muted">Loading...</td></tr>
                  ) : userData?.users?.length === 0 ? (
                    <tr><td colSpan={3} className="p-8 text-center text-muted">No users match the current filters.</td></tr>
                  ) : (
                    userData?.users?.map((user) => (
                      <tr key={user.userId} className="hover:bg-muted/5 transition cursor-pointer">
                        <td className="px-4 py-3 font-medium">{user.userName}</td>
                        <td className="px-4 py-3">{Math.floor(user.totalMinutes / 60)}h {user.totalMinutes % 60}m</td>
                        <td className="px-4 py-3">{user.totalProjects} projects</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            {userData?.pagination && (
              <div className="p-4 border-t border-border">
                <Pagination 
                  page={userData.pagination.page} 
                  totalPages={userData.pagination.totalPages} 
                  total={userData.pagination.total} 
                  onPageChange={setPage} 
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
