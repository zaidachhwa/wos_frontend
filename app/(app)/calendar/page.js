"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import listPlugin from "@fullcalendar/list";
import interactionPlugin from "@fullcalendar/interaction";
import { Plus, Check } from "lucide-react";

import TimeBlockDialog from "@/components/calendar/TimeBlockDialog";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/ui/Field";
import { fetchCalendar, fetchTimeBlocks } from "@/services/timeblockService";
import { fetchProjects } from "@/services/projectService";
import { fetchDirectory } from "@/services/orgService";
import { combineDeadlineAndTime } from "@/lib/taskDates";
import { projectColor } from "@/lib/projectColor";

// Muted calendar palette (defined in globals.css; CSS vars resolve at paint).
const CATEGORY_COLORS = {
  meeting: "var(--cal-meeting)",
  deep_work: "var(--cal-deep-work)",
  personal: "var(--cal-personal)",
  followup: "var(--cal-followup)",
  project_work: "var(--cal-project-work)",
  break: "var(--cal-break)",
};
const TYPE_COLORS = {
  task_deadline: "var(--cal-task-deadline)",
  project_deadline: "var(--cal-project-deadline)",
  followup: "var(--cal-followup)",
};

const eventColor = (item) =>
  item.color ||
  (item.projectName && projectColor(item.projectName)) ||
  CATEGORY_COLORS[item.category] ||
  TYPE_COLORS[item.type] ||
  "var(--cal-default)";

const renderEventContent = (arg) => {
  const item = arg.event.extendedProps;
  const done = item.status === "completed";
  return (
    <div className={`flex items-center gap-1 truncate px-1 text-xs ${done ? "line-through opacity-60" : ""}`}>
      {done && <Check size={12} className="shrink-0" />}
      {arg.timeText && <span className="shrink-0 opacity-80">{arg.timeText}</span>}
      {(item.projectName || item.label) && (
        <span className="shrink-0 rounded-full bg-white/20 px-1.5 py-0.5 text-[10px] font-medium">
          {item.projectName || item.label}
        </span>
      )}
      <span className="truncate">{arg.event.title}</span>
    </div>
  );
};

export default function CalendarPage() {
  const router = useRouter();
  const me = useAuthStore((s) => s.user);
  const canViewOthers = ["admin", "manager", "subadmin"].includes(me?.role);
  const [viewUser, setViewUser] = useState("");
  const [range, setRange] = useState(null);
  const [dialog, setDialog] = useState({ open: false, block: null, defaultDate: null });

  const { data: items = [] } = useQuery({
    queryKey: ["calendar", range, viewUser],
    queryFn: () => fetchCalendar({ ...range, user: viewUser }),
    enabled: Boolean(range),
  });
  const { data: blocks = [] } = useQuery({
    queryKey: ["timeblocks", range, viewUser],
    queryFn: () => fetchTimeBlocks({ ...range, user: viewUser || undefined }),
    enabled: Boolean(range),
  });
  const { data: projects = [] } = useQuery({ queryKey: ["projects"], queryFn: fetchProjects });
  const { data: directory = [] } = useQuery({ queryKey: ["directory"], queryFn: fetchDirectory });

  const localDay = (d) => {
    const x = new Date(d);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  };

  const events = items.map((item) => {
    const spanStartDay = item.spanStart && localDay(item.spanStart);
    // deadline is stored as a UTC-midnight date-only value (see lib/taskDates.js),
    // so its UTC calendar day IS its intended calendar day — unlike spanStart/today
    // below, which are real instants and need local-day extraction. Don't "fix"
    // this to match the other two.
    const deadlineDay = item.start && new Date(item.start).toISOString().slice(0, 10);
    const isMultiDay = item.type === "task_deadline" && spanStartDay && deadlineDay && spanStartDay < deadlineDay;

    if (isMultiDay) {
      const todayDay = localDay(new Date());
      const barStartDay = [spanStartDay, todayDay, deadlineDay].sort()[1];
      const barEnd = new Date(Date.parse(deadlineDay) + 86400000).toISOString().slice(0, 10); // exclusive end, computed in UTC to dodge DST

      return {
        id: `${item.type}:${item.id}`,
        title: item.title,
        start: barStartDay,
        end: barEnd,
        allDay: true,
        backgroundColor: eventColor(item),
        borderColor: "transparent",
        extendedProps: item,
      };
    }

    return {
      id: `${item.type}:${item.id}`,
      title: item.title,
      // A task's startTime/endTime are "HH:mm" wall-clock values with no
      // timezone of their own — combine them with the deadline's date here,
      // in the browser, so they land on the viewer's own local clock (the
      // server can't do this combination correctly, since it doesn't know
      // the viewer's timezone).
      start: item.startTime ? combineDeadlineAndTime(item.start, item.startTime) : item.start,
      end: item.endTime ? combineDeadlineAndTime(item.start, item.endTime) : item.end || undefined,
      backgroundColor: eventColor(item),
      borderColor: "transparent",
      extendedProps: item,
    };
  });

  const onDatesSet = useCallback((info) => {
    setRange({ from: info.start.toISOString(), to: info.end.toISOString() });
  }, []);

  const onEventClick = (info) => {
    const item = info.event.extendedProps;
    if (item.type === "timeblock") {
      const block = blocks.find((b) => b._id === item.id);
      if (block) setDialog({ open: true, block, defaultDate: null });
    } else if (item.link) {
      router.push(item.link);
    }
  };

  const onDateClick = (info) => {
    setDialog({ open: true, block: null, defaultDate: info.dateStr.slice(0, 10) });
  };

  return (
    <div className="mx-auto max-w-[1600px] space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {canViewOthers ? (
          <select
            aria-label="Whose calendar"
            value={viewUser}
            onChange={(e) => setViewUser(e.target.value)}
            className="rounded-input border border-border bg-surface px-3 py-2 text-sm outline-none transition-colors duration-150 focus:border-primary"
          >
            <option value="">My calendar</option>
            {directory
              .filter((d) => d._id !== me?._id)
              .map((d) => (
                <option key={d._id} value={d._id}>
                  {d.name} ({d.role})
                </option>
              ))}
          </select>
        ) : (
          <span />
        )}
        <Button onClick={() => setDialog({ open: true, block: null, defaultDate: null })}>
          <Plus size={16} /> New time block
        </Button>
      </div>

      <div className="rounded-card border border-border bg-surface p-6">
        <FullCalendar
          plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
          initialView="timeGridWeek"
          headerToolbar={{
            left: "prev,next today",
            center: "title",
            right: "timeGridDay,timeGridWeek,dayGridMonth,listWeek",
          }}
          buttonText={{ today: "Today", day: "Day", week: "Week", month: "Month", list: "Agenda" }}
          events={events}
          eventContent={renderEventContent}
          datesSet={onDatesSet}
          eventClick={onEventClick}
          dateClick={onDateClick}
          nowIndicator
          height="auto"
          dayMaxEventRows={4}
          firstDay={1}
          slotMinTime="06:00:00"
          slotMaxTime="22:00:00"
          scrollTime="08:00:00"
          slotDuration="00:30:00"
          eventTimeFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
          slotLabelFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
          dayHeaderFormat={{ weekday: "short", day: "numeric" }}
          allDayText="All day"
        />
      </div>

      <TimeBlockDialog
        open={dialog.open}
        onClose={() => setDialog({ open: false, block: null, defaultDate: null })}
        block={dialog.block}
        defaultDate={dialog.defaultDate}
        directory={directory}
        projects={projects}
      />
    </div>
  );
}
