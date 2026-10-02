import axiosInstance from "./axiosInstance";

export const fetchTeamReport = async ({ from, to, department }) => {
  const { data } = await axiosInstance.get("/reports/team", { params: { from, to, department: department || undefined } });
  return data.data;
};

export const downloadTeamReportCsv = async ({ from, to, department }) => {
  const { data } = await axiosInstance.get("/reports/team", {
    params: { from, to, format: "csv", department: department || undefined },
    responseType: "blob",
  });
  const url = URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = url;
  a.download = `team-report-${from}-to-${to}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};
