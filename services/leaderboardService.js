import axiosInstance from "./axiosInstance";

export const fetchLeaderboard = async ({ week, team } = {}) => {
  const { data } = await axiosInstance.get("/leaderboard", {
    params: { week: week || undefined, team: team || undefined },
  });
  return data.data;
};

export const downloadLeaderboardCsv = async ({ week, team } = {}) => {
  const { data } = await axiosInstance.get("/leaderboard", {
    params: { week: week || undefined, team: team || undefined, format: "csv" },
    responseType: "blob",
  });
  const url = URL.createObjectURL(data);
  const a = document.createElement("a");
  a.href = url;
  a.download = `leaderboard-${week || "current"}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

export const fetchPointsConfig = async () => {
  const { data } = await axiosInstance.get("/leaderboard/points-config");
  return data.data;
};

export const updatePointsConfig = async (values) => {
  const { data } = await axiosInstance.put("/leaderboard/points-config", values);
  return data.data;
};
