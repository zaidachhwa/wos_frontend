import axiosInstance from "./axiosInstance";

export const fetchFollowUps = async (params = {}) => {
  const { data } = await axiosInstance.get("/followups", { params });
  return data.data.followUps;
};

// Paginated variant for the "Previous follow-ups" history list — fetchFollowUps
// above stays as-is for the other (already-bounded) own/team lookups.
export const fetchFollowUpsPage = async ({ page, limit }) => {
  const { data } = await axiosInstance.get("/followups", { params: { page, limit } });
  return { followUps: data.data.followUps, pagination: data.data.pagination };
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

export const fetchWorkLog = async () => {
  const { data } = await axiosInstance.get("/followups/work-log");
  return data.data;
};
