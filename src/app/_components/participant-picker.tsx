"use client";

import { useEffect, useState } from "react";
import Select from "react-select";

interface Option {
  value: string;
  label: string;
}

const classNames = {
  control: () =>
    "mt-1 rounded border px-2 py-1 text-sm border-gray-300 bg-white dark:border-zinc-700 dark:bg-zinc-800",
  placeholder: () => "text-zinc-400 dark:text-zinc-500",
  input: () => "text-zinc-900 dark:text-zinc-100",
  singleValue: () => "text-zinc-900 dark:text-zinc-100",
  menu: () =>
    "mt-1 rounded border bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-800 z-10",
  option: ({ isFocused }: { isFocused: boolean }) =>
    `px-3 py-2 text-sm cursor-pointer ${
      isFocused ? "bg-zinc-100 dark:bg-zinc-700" : "dark:text-zinc-100"
    }`,
  multiValue: () =>
    "bg-zinc-100 dark:bg-zinc-700 rounded pl-2 pr-1 py-0.5 mr-1 my-0.5 text-sm inline-flex items-center gap-1",
  multiValueLabel: () => "text-sm dark:text-zinc-100",
  multiValueRemove: () => "cursor-pointer text-zinc-500 hover:text-red-500 rounded",
  clearIndicator: () => "cursor-pointer text-zinc-500 hover:text-red-500 px-1",
  dropdownIndicator: () => "text-zinc-400 px-1",
  indicatorSeparator: () => "bg-zinc-300 dark:bg-zinc-600",
};

/**
 * Searchable Slack-user picker — used wherever the app needs a person (or
 * people) selected by name instead of a raw pasted Slack user id. Selections
 * mirror into hidden inputs so native form submission needs no changes:
 * `formData.get(name)` (single) or `formData.getAll(name)` (multi) sees this
 * exactly like a native select would.
 *
 * react-select generates internal ids/state that aren't guaranteed to match
 * between the server-rendered HTML and the client's first render, causing a
 * hydration mismatch. Rendering nothing until after mount (rather than
 * next/dynamic's ssr:false, which Server Components can't use directly)
 * sidesteps that entirely.
 */
export function ParticipantPicker({
  name,
  options,
  defaultSelected = [],
  multi = true,
}: {
  name: string;
  options: Option[];
  /** Pre-checks these as already-selected — e.g. current participants/members when editing. */
  defaultSelected?: Option[];
  /** false for a single-assignee field (e.g. a rotation override) instead of a multi-select. */
  multi?: boolean;
}) {
  const [mounted, setMounted] = useState(false);
  const [selected, setSelected] = useState<Option[]>(defaultSelected);
  useEffect(() => setMounted(true), []);

  if (!mounted) {
    return (
      <div className="mt-1 h-9 animate-pulse rounded border bg-zinc-100 dark:border-zinc-700 dark:bg-zinc-800" />
    );
  }

  return (
    <>
      {multi ? (
        <Select<Option, true>
          isMulti
          unstyled
          instanceId={name}
          options={options}
          value={selected}
          onChange={(v) => setSelected([...v])}
          placeholder="Type a name to search…"
          noOptionsMessage={() => "No matches"}
          classNames={classNames}
        />
      ) : (
        <Select<Option, false>
          isMulti={false}
          isClearable
          unstyled
          instanceId={name}
          options={options}
          value={selected[0] ?? null}
          onChange={(v) => setSelected(v ? [v] : [])}
          placeholder="Type a name to search…"
          noOptionsMessage={() => "No matches"}
          classNames={classNames}
        />
      )}
      {selected.map((o) => (
        <input key={o.value} type="hidden" name={name} value={o.value} />
      ))}
    </>
  );
}
