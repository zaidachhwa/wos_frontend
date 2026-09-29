"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Button, Textarea } from "@/components/ui/Field";
import useToast from "@/hooks/useToast";
import { addBugComment } from "@/services/bugService";
import { apiError, fmtDateTime } from "@/lib/appraisal";

export default function BugComments({ bug }) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [text, setText] = useState("");
  const [comments, setComments] = useState(bug.comments || []);

  const add = useMutation({
    mutationFn: () => addBugComment({ id: bug._id, text }),
    onSuccess: (fresh) => {
      setComments(fresh.comments || []);
      setText("");
      queryClient.invalidateQueries({ queryKey: ["bugs"] });
    },
    onError: (e) => toast.error(apiError(e)),
  });

  return (
    <section className="mt-6 border-t border-border pt-4">
      <h3 className="text-sm font-semibold">Comments</h3>
      {comments.length === 0 ? (
        <p className="mt-2 text-sm text-muted">No comments yet.</p>
      ) : (
        <ul className="mt-2 space-y-2 text-sm">
          {comments.map((c) => (
            <li key={c._id}>
              <p className="text-xs text-muted">
                {c.user?.name || "—"} · {fmtDateTime(c.createdAt)}
              </p>
              <p className="whitespace-pre-wrap">{c.text}</p>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 flex items-end gap-2">
        <div className="flex-1">
          <Textarea rows={2} placeholder="Add a comment" value={text} onChange={(e) => setText(e.target.value)} />
        </div>
        <Button variant="secondary" disabled={!text.trim() || add.isPending} onClick={() => add.mutate()}>
          Comment
        </Button>
      </div>
    </section>
  );
}
