"use client";

import { useMemo, useState } from "react";

type CalendarTask = {
  id: string;
  dueDate: string;
  title: string;
};

type Props = {
  initialYear: number;
  initialMonth: number; // 0-based
  tasks: CalendarTask[];
};

function monthLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString("en-IE", {
    month: "long",
    year: "numeric",
  });
}

function formatDueDate(value: string): string {
  return new Date(value).toLocaleDateString("en-IE", {
    day: "numeric",
    month: "short",
  });
}

function moveMonth(year: number, month: number, delta: number): { year: number; month: number } {
  const next = new Date(year, month + delta, 1);
  return { year: next.getFullYear(), month: next.getMonth() };
}

export function ComplianceCalendar({ initialYear, initialMonth, tasks }: Props) {
  const [viewYear, setViewYear] = useState(initialYear);
  const [viewMonth, setViewMonth] = useState(initialMonth);

  const today = new Date();

  const monthData = useMemo(() => {
    const firstOfMonth = new Date(viewYear, viewMonth, 1);
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const firstWeekdayOffset = (firstOfMonth.getDay() + 6) % 7; // Monday-first

    const tasksInMonth = tasks
      .filter((task) => {
        const due = new Date(task.dueDate);
        return due.getFullYear() === viewYear && due.getMonth() === viewMonth;
      })
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

    const highlightedDays = new Set<number>(tasksInMonth.map((task) => new Date(task.dueDate).getDate()));

    const cells: Array<number | null> = [];
    for (let i = 0; i < firstWeekdayOffset; i += 1) cells.push(null);
    for (let day = 1; day <= daysInMonth; day += 1) cells.push(day);

    return { tasksInMonth, highlightedDays, cells };
  }, [tasks, viewMonth, viewYear]);

  function goPrevMonth() {
    const next = moveMonth(viewYear, viewMonth, -1);
    setViewYear(next.year);
    setViewMonth(next.month);
  }

  function goNextMonth() {
    const next = moveMonth(viewYear, viewMonth, 1);
    setViewYear(next.year);
    setViewMonth(next.month);
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-[#3e5c4b]">Compliance Calendar</h2>
        <div className="flex items-center gap-2">
          <button
            aria-label="Previous month"
            onClick={goPrevMonth}
            className="rounded-md border border-[#cbd5e1] bg-white px-2 py-1 text-sm font-semibold text-[#334155] hover:bg-[#f8fafc]"
          >
            {"<"}
          </button>
          <button
            aria-label="Next month"
            onClick={goNextMonth}
            className="rounded-md border border-[#cbd5e1] bg-white px-2 py-1 text-sm font-semibold text-[#334155] hover:bg-[#f8fafc]"
          >
            {">"}
          </button>
        </div>
      </div>

      <p className="mt-2 text-lg font-semibold">{monthLabel(viewYear, viewMonth)}</p>
      <div className="mt-3 grid grid-cols-7 gap-1 text-center text-xs font-medium text-[#64748b]">
        <span>Mon</span>
        <span>Tue</span>
        <span>Wed</span>
        <span>Thu</span>
        <span>Fri</span>
        <span>Sat</span>
        <span>Sun</span>
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1">
        {monthData.cells.map((day, idx) => {
          if (!day) {
            return <div key={`empty-${idx}`} className="h-9 rounded-md bg-[#f8fafc]" />;
          }

          const isToday =
            day === today.getDate() &&
            viewMonth === today.getMonth() &&
            viewYear === today.getFullYear();
          const isHighlighted = monthData.highlightedDays.has(day);

          return (
            <div
              key={day}
              className={`flex h-9 items-center justify-center rounded-md text-sm font-medium ${
                isHighlighted
                  ? "bg-[#dbeafe] text-[#1e3a8a] ring-1 ring-[#93c5fd]"
                  : "bg-white text-[#334155] border border-[#e2e8f0]"
              } ${isToday ? "border border-[#0f766e]" : ""}`}
              title={isHighlighted ? "Task due" : undefined}
            >
              {day}
            </div>
          );
        })}
      </div>

      {monthData.tasksInMonth.length === 0 ? (
        <p className="mt-3 text-sm text-[#6b8073]">No deadlines in this month.</p>
      ) : (
        <ul className="mt-3 space-y-1">
          {monthData.tasksInMonth.slice(0, 6).map((task) => (
            <li key={task.id} className="flex items-center justify-between text-sm">
              <span className="truncate text-[#3b4a3f]">{task.title}</span>
              <span className="ml-2 shrink-0 text-xs text-[#7a8880]">{formatDueDate(task.dueDate)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
