import axiosInstance from "./axiosInstance";

export const fetchTimeBlocks = async (params = {}) => {
  const { data } = await axiosInstance.get("/timeblocks", { params });
  return data.data.timeBlocks;
};

export const createTimeBlock = async (payload) => {
  const { data } = await axiosInstance.post("/timeblocks", payload);
  return data.data.timeBlock;
};

export const updateTimeBlock = async ({ id, ...payload }) => {
  const { data } = await axiosInstance.patch(`/timeblocks/${id}`, payload);
  return data.data.timeBlock;
};

export const deleteTimeBlock = async (id) => {
  await axiosInstance.delete(`/timeblocks/${id}`);
};

export const fetchCalendar = async ({ from, to, user }) => {
  const { data } = await axiosInstance.get("/calendar", { params: { from, to, user: user || undefined } });
  return data.data.items;
};
