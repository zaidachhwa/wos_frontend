import axiosInstance from "./axiosInstance";

export const fetchTeamReport = async ({ from, to }) => {
  const { data } = await axiosInstance.get("/reports/team", { params: { from, to } });
  return data.data;
};

export const fetchWorkLog = async (date) => {
  const { data } = await axiosInstance.get("/reports/work-log", { params: date ? { date } : {} });
  return data.data;
};

export const downloadTeamReportCsv = async ({ from, to }) => {
  const { data } = await axiosInstance.get("/reports/team", {
    params: { from, to, format: "csv" },
    responseType: "blob",
  });
  const url = URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = url;
  a.download = `team-report-${from}-to-${to}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};
