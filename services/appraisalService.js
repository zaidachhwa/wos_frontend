import axiosInstance from "./axiosInstance";

export const fetchAppraisal = async ({ month, team } = {}) => {
  const { data } = await axiosInstance.get("/appraisal", {
    params: { month: month || undefined, team: team || undefined },
  });
  return data.data;
};
