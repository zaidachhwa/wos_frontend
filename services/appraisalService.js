import axiosInstance from "./axiosInstance";

export const fetchAppraisal = async ({ month, team, department } = {}) => {
  const { data } = await axiosInstance.get("/appraisal", {
    params: { month: month || undefined, team: team || undefined, department: department || undefined },
  });
  return data.data;
};

export const fetchMyAppraisal = async ({ month } = {}) => {
  const { data } = await axiosInstance.get("/appraisal/me", {
    params: { month: month || undefined },
  });
  return data.data;
};

export const fetchUserAppraisal = async ({ userId, month }) => {
  const { data } = await axiosInstance.get(`/appraisal/${userId}`, {
    params: { month: month || undefined },
  });
  return data.data;
};

export const fetchAppraisalConfig = async () => {
  const { data } = await axiosInstance.get("/appraisal/config");
  return data.data;
};

export const updateAppraisalConfig = async (payload) => {
  const { data } = await axiosInstance.patch("/appraisal/config", payload);
  return data.data;
};

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

export const downloadAppraisalCsv = async ({ month, team, department, filename } = {}) => {
  const { data } = await axiosInstance.get("/appraisal", {
    params: { month: month || undefined, team: team || undefined, department: department || undefined, format: "csv" },
    responseType: "blob",
  });
  downloadBlob(data, filename || `appraisal-report-${month || "current"}.csv`);
};

export const downloadUserAppraisalCsv = async ({ userId, month, name }) => {
  const { data } = await axiosInstance.get(`/appraisal/${userId}`, {
    params: { month: month || undefined, format: "csv" },
    responseType: "blob",
  });
  downloadBlob(data, `appraisal-${(name || "employee").replace(/\s+/g, "-")}-${month || "current"}.csv`);
};
