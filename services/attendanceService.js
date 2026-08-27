import axiosInstance from "./axiosInstance";

export const fetchAttendance = async ({ month, user } = {}) => {
  const { data } = await axiosInstance.get("/attendance", {
    params: { month: month || undefined, user: user || undefined },
  });
  return data.data.records;
};

export const markAttendance = async (payload) => {
  const { data } = await axiosInstance.post("/attendance", payload);
  return data.data.record;
};

export const deleteAttendance = async (id) => {
  await axiosInstance.delete(`/attendance/${id}`);
};

export const fetchAttendanceConfig = async () => {
  const { data } = await axiosInstance.get("/attendance/config");
  return data.data;
};

export const updateAttendanceConfig = async (payload) => {
  const { data } = await axiosInstance.patch("/attendance/config", payload);
  return data.data;
};

export const fetchAttendanceReport = async ({ month } = {}) => {
  const { data } = await axiosInstance.get("/attendance/report", { params: { month: month || undefined } });
  return data.data.report;
};

export const fetchUserDeadlines = async () => {
  const { data } = await axiosInstance.get("/attendance/deadlines");
  return data.data.users;
};

export const setUserMorningDeadline = async ({ userId, morningDeadline }) => {
  const { data } = await axiosInstance.patch(`/attendance/deadline/${userId}`, { morningDeadline });
  return data.data.user;
};

export const downloadAttendanceReportCsv = async ({ month } = {}) => {
  const { data } = await axiosInstance.get("/attendance/report", {
    params: { month: month || undefined, format: "csv" },
    responseType: "blob",
  });
  const url = URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = url;
  a.download = `attendance-report-${month || "current"}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};
