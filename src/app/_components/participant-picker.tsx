"use client";

import { useEffect, useState } from "react";
import Select from "react-select";

interface Option {
  value: string;
  label: string;
}

const classNames = {
  control: () =>
    "mt-1 rounded-field border border-base-300 bg-base-100 px-2 py-1 text-sm",
  placeholder: () => "text-base-content/40",
  input: () => "text-base-content",
  singleValue: () => "text-base-content",
  menu: () => "mt-1 rounded-box border border-base-300 bg-base-100 shadow-lg z-10",
  option: ({ isFocused }: { isFocused: boolean }) =>
    `px-3 py-2 text-sm cursor-pointer ${isFocused ? "bg-base-200" : ""}`,
  multiValue: () =>
    "bg-primary/10 text-primary rounded pl-2 pr-1 py-0.5 mr-1 my-0.5 text-sm inline-flex items-center gap-1",
  multiValueLabel: () => "text-sm",
  multiValueRemove: () => "cursor-pointer text-base-content/50 hover:text-error rounded",
  clearIndicator: () => "cursor-pointer text-base-content/50 hover:text-error px-1",
  dropdownIndicator: () => "text-base-content/40 px-1",
  indicatorSeparator: () => "bg-base-300",
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
    return <div className="mt-1 h-9 animate-pulse rounded-field border border-base-300 bg-base-200" />;
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
