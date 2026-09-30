import axiosInstance from "./axiosInstance";

// The configurable monthly appraisal API (/api/appraisals). Every score in
// these responses is computed by the backend engine — the UI only formats.

const clean = (params) => Object.fromEntries(Object.entries(params || {}).filter(([, v]) => v !== undefined && v !== null && v !== ""));

export const fetchAppraisals = async (params) => {
  const { data } = await axiosInstance.get("/appraisals", { params: clean(params) });
  return data.data;
};

export const fetchAppraisalDetail = async (id) => {
  const { data } = await axiosInstance.get(`/appraisals/${id}`);
  return data.data.appraisal;
};

export const openEmployeeMonth = async ({ userId, month }) => {
  const { data } = await axiosInstance.get(`/appraisals/employee/${userId}/month/${month}`);
  return data.data.appraisal;
};

export const fetchMyAppraisals = async () => {
  const { data } = await axiosInstance.get("/appraisals/my");
  return data.data.history;
};

export const fetchTeamAppraisals = async (month) => {
  const { data } = await axiosInstance.get("/appraisals/team", { params: clean({ month }) });
  return data.data;
};

export const fetchEmployeeHistory = async (userId) => {
  const { data } = await axiosInstance.get(`/appraisals/employee/${userId}/history`);
  return data.data;
};

export const saveMonthlyInputs = async ({ month, rows }) => {
  const { data } = await axiosInstance.patch("/appraisals/inputs", { month, rows });
  return data;
};

const appraisalAction = async (method, url, body) => {
  const { data } = await axiosInstance[method](url, body);
  return data.data.appraisal;
};

export const saveHrInputs = ({ id, ...body }) => appraisalAction("patch", `/appraisals/${id}/hr-inputs`, body);
export const saveEvaluation = ({ id, criterionKey, ...body }) => appraisalAction("patch", `/appraisals/${id}/evaluations/${criterionKey}`, body);
export const recalculateAppraisal = (id) => appraisalAction("post", `/appraisals/${id}/recalculate`);
export const submitAppraisal = (id) => appraisalAction("post", `/appraisals/${id}/submit`);
export const finalizeAppraisal = (id) => appraisalAction("post", `/appraisals/${id}/finalize`);
export const reopenAppraisal = ({ id, reason }) => appraisalAction("post", `/appraisals/${id}/reopen`, { reason });

export const finalizeMonth = async ({ month, ids }) => {
  const { data } = await axiosInstance.post("/appraisals/finalize-month", { month, ids });
  return data;
};

export const fetchAppraisalAudit = async (id) => {
  const { data } = await axiosInstance.get(`/appraisals/${id}/audit`);
  return data.data.logs;
};

// ---- configuration

export const fetchAppraisalSettings = async () => {
  const { data } = await axiosInstance.get("/appraisals/config");
  return data.data;
};

// These three return { message, data: { weightage, ... } } — saving is never
// blocked by the 100% rule, so the caller shows the server's warning when
// a department isn't at 100% yet.
export const createCriterion = async (payload) => {
  const { data } = await axiosInstance.post("/appraisals/criteria", payload);
  return data;
};

export const updateCriterion = async ({ id, ...payload }) => {
  const { data } = await axiosInstance.patch(`/appraisals/criteria/${id}`, payload);
  return data;
};

export const deleteCriterion = async (id) => {
  await axiosInstance.delete(`/appraisals/criteria/${id}`);
};

export const saveAllocation = async (items) => {
  const { data } = await axiosInstance.put("/appraisals/criteria/allocation", { items });
  return data;
};

export const reorderCriteria = async (ids) => {
  await axiosInstance.patch("/appraisals/criteria/reorder", { ids });
};

export const updateAppraisalSettings = async (payload) => {
  const { data } = await axiosInstance.patch("/appraisals/settings", payload);
  return data.data.settings;
};

// ---- reports, emails, periods, client changes

export const fetchAppraisalReport = async (params) => {
  const { data } = await axiosInstance.get("/appraisals/reports", { params: clean(params) });
  return data.data;
};

export const downloadAppraisalReportCsv = async (params) => {
  const { data } = await axiosInstance.get("/appraisals/reports", { params: clean({ ...params, format: "csv" }), responseType: "blob" });
  const url = URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = url;
  a.download = `appraisal-report-${params.month}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

export const fetchEmailLogs = async (params) => {
  const { data } = await axiosInstance.get("/appraisals/emails", { params: clean(params) });
  return data.data;
};

export const retryEmailLog = async (id) => {
  const { data } = await axiosInstance.post(`/appraisals/emails/${id}/retry`);
  return data.data.log;
};

export const fetchPeriods = async () => {
  const { data } = await axiosInstance.get("/appraisals/periods");
  return data.data.periods;
};

export const closePeriod = async (month) => {
  const { data } = await axiosInstance.post(`/appraisals/periods/${month}/close`);
  return data;
};

export const fetchClientChanges = async (params) => {
  const { data } = await axiosInstance.get("/appraisals/client-changes", { params: clean(params) });
  return data.data.tasks;
};

export const categorizeClientChange = async ({ taskId, category }) => {
  const { data } = await axiosInstance.patch(`/appraisals/client-changes/${taskId}`, { category });
  return data.data;
};
