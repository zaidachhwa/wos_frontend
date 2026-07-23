import axiosInstance from "./axiosInstance";

export const fetchLeaderboard = async ({ week } = {}) => {
  const { data } = await axiosInstance.get("/leaderboard", { params: { week: week || undefined } });
  return data.data;
};
