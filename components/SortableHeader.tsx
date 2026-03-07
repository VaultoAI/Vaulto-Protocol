"use client";

import type { SortDirection } from "@/hooks/useSortableTable";

type SortableHeaderProps = {
  label: string;
  columnKey: string;
  currentSortColumn: string | null;
  currentSortDirection: SortDirection;
  onSort: (column: string) => void;
  className?: string;
};

function SortIcon({
  direction,
  isActive,
}: {
  direction: SortDirection;
  isActive: boolean;
}) {
  return (
    <span className={`ml-1 w-3 text-[10px] inline-block ${isActive ? "" : "invisible"}`}>
      {direction === "asc" ? "▲" : "▼"}
    </span>
  );
}

export function SortableHeader({
  label,
  columnKey,
  currentSortColumn,
  currentSortDirection,
  onSort,
  className = "",
}: SortableHeaderProps) {
  const isActive = currentSortColumn === columnKey;

  return (
    <button
      type="button"
      onClick={() => onSort(columnKey)}
      className={`inline-flex items-center whitespace-nowrap hover:text-foreground transition-colors cursor-pointer select-none ${className}`}
    >
      {label}
      <SortIcon direction={currentSortDirection} isActive={isActive} />
    </button>
  );
}

type SortableTableHeaderProps = {
  label: string;
  columnKey: string;
  currentSortColumn: string | null;
  currentSortDirection: SortDirection;
  onSort: (column: string) => void;
  className?: string;
};

export function SortableTableHeader({
  label,
  columnKey,
  currentSortColumn,
  currentSortDirection,
  onSort,
  className = "",
}: SortableTableHeaderProps) {
  const isActive = currentSortColumn === columnKey;

  return (
    <th className={`py-3 px-4 font-medium ${className}`}>
      <button
        type="button"
        onClick={() => onSort(columnKey)}
        className="inline-flex items-center whitespace-nowrap hover:text-foreground transition-colors cursor-pointer select-none"
      >
        {label}
        <SortIcon direction={currentSortDirection} isActive={isActive} />
      </button>
    </th>
  );
}
