import axiosInstance from "./axiosInstance";

export const fetchNotifications = async () => {
  const { data } = await axiosInstance.get("/notifications");
  return data.data; // { notifications, unreadCount }
};

export const markRead = async (id) => {
  const { data } = await axiosInstance.patch(`/notifications/${id}/read`);
  return data.data.notification;
};

export const markAllRead = async () => {
  await axiosInstance.post("/notifications/mark-all-read");
};

export const fetchActivity = async (params = {}) => {
  const { data } = await axiosInstance.get("/activity", { params });
  return data.data.activity;
};
