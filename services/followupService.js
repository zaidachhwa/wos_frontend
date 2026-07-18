import axiosInstance from "./axiosInstance";

export const fetchFollowUps = async (params = {}) => {
  const { data } = await axiosInstance.get("/followups", { params });
  return data.data.followUps;
};

export const saveFollowUp = async (payload) => {
  const { data } = await axiosInstance.post("/followups", payload);
  return data.data.followUp;
};

export const reviewFollowUp = async ({ id, managerComment }) => {
  const { data } = await axiosInstance.patch(`/followups/${id}/review`, { managerComment });
  return data.data.followUp;
};

export const fetchFollowUpSuggestion = async (date) => {
  const { data } = await axiosInstance.get("/followups/suggestions", { params: { date } });
  return data.data;
};
