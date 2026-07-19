import { useToastStore } from "@/store/toastStore";

export default function useToast() {
  const push = useToastStore((s) => s.push);
  return {
    success: (message) => push({ tone: "success", message }),
    error: (message) => push({ tone: "danger", message }),
    info: (message) => push({ tone: "info", message }),
  };
}
