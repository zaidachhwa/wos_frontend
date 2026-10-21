import axiosInstance from "./axiosInstance";

// Team availability, anonymous feedback and special bonus requests.

export const fetchAvailability = async () => {
  const { data } = await axiosInstance.get("/availability");
  return data.data;
};

// Returns nothing about the stored record — by design.
export const submitAnonymousFeedback = async ({ message, category }) => {
  const { data } = await axiosInstance.post("/feedback", { message, category });
  return data;
};

export const fetchFeedbackInbox = async (params) => {
  const { data } = await axiosInstance.get("/feedback", { params });
  return data.data;
};

export const setFeedbackStatus = async ({ id, status }) => {
  const { data } = await axiosInstance.patch(`/feedback/${id}`, { status });
  return data;
};

export const fetchMyBonusRequest = async () => {
  const { data } = await axiosInstance.get("/bonus-requests/mine");
  return data.data;
};

export const submitBonusRequest = async (reason) => {
  const { data } = await axiosInstance.post("/bonus-requests", { reason });
  return data.data.request;
};

export const fetchBonusRequests = async (month) => {
  const { data } = await axiosInstance.get("/bonus-requests", { params: month ? { month } : {} });
  return data.data;
};
