"use client";

import { useEffect, useState } from "react";
import DatePicker from "react-datepicker";

import "react-datepicker/dist/react-datepicker.css";

/**
 * react-datepicker wrappers that mirror the selection into a hidden input, so
 * native form submission is unchanged: the server action still reads
 * `formData.get(name)` as a "yyyy-mm-dd" (date) or "HH:MM" (time) string —
 * exactly like the old <input type="date/time"> did.
 *
 * Mount-guarded (render a plain input until mounted) to avoid any SSR/CSR
 * mismatch, same approach as ParticipantPicker. The calendar popup renders
 * through a body-level portal (#datepicker-portal, in the root layout) so it
 * isn't clipped by the overflow-hidden cards the forms sit in.
 */

const INPUT = "input w-full";
const pad = (n: number) => String(n).padStart(2, "0");

function parseDate(s?: string): Date | null {
  if (!s) return null;
  const d = new Date(`${s}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}
function formatDate(d: Date | null): string {
  return d ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : "";
}

function parseTime(s?: string): Date | null {
  if (!s || !/^\d{1,2}:\d{2}$/.test(s)) return null;
  const [h, m] = s.split(":").map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}
function formatTime(d: Date | null): string {
  return d ? `${pad(d.getHours())}:${pad(d.getMinutes())}` : "";
}

export function DateField({
  name,
  defaultValue,
  className = INPUT,
  placeholder = "Select a date",
}: {
  name: string;
  defaultValue?: string;
  className?: string;
  placeholder?: string;
}) {
  const [date, setDate] = useState<Date | null>(parseDate(defaultValue));
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const value = formatDate(date);

  return (
    <>
      {mounted ? (
        <DatePicker
          selected={date}
          onChange={setDate}
          dateFormat="yyyy-MM-dd"
          placeholderText={placeholder}
          className={className}
          wrapperClassName="block w-full"
          portalId="datepicker-portal"
          showPopperArrow={false}
          isClearable
        />
      ) : (
        <input readOnly value={value} placeholder={placeholder} className={className} />
      )}
      <input type="hidden" name={name} value={value} />
    </>
  );
}

export function TimeField({
  name,
  defaultValue,
  className = INPUT,
  intervals = 15,
}: {
  name: string;
  defaultValue?: string;
  className?: string;
  intervals?: number;
}) {
  const [time, setTime] = useState<Date | null>(parseTime(defaultValue));
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const value = formatTime(time);

  return (
    <>
      {mounted ? (
        <DatePicker
          selected={time}
          onChange={setTime}
          showTimeSelect
          showTimeSelectOnly
          timeIntervals={intervals}
          timeCaption="Time"
          dateFormat="HH:mm"
          timeFormat="HH:mm"
          placeholderText="Select a time"
          className={className}
          wrapperClassName="block w-full"
          portalId="datepicker-portal"
          showPopperArrow={false}
        />
      ) : (
        <input readOnly value={value} placeholder="Select a time" className={className} />
      )}
      <input type="hidden" name={name} value={value} />
    </>
  );
}
