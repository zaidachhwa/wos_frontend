"use client";

import { use, useEffect } from "react";
import { useRouter } from "next/navigation";

// Task details are a drawer on the list page, not a standalone view —
// redirect so links from notifications/comments land somewhere real.
export default function TaskRedirectPage({ params }) {
  const { id } = use(params);
  const router = useRouter();

  useEffect(() => {
    router.replace(`/tasks?open=${id}`);
  }, [id, router]);

  return null;
}
