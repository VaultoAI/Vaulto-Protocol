"use client";

import { useState, useMemo, useCallback } from "react";

export type SortDirection = "asc" | "desc";

export type SortConfig<T extends string> = {
  column: T | null;
  direction: SortDirection;
};

export type SortableColumn<T extends string, D> = {
  key: T;
  getValue: (item: D) => string | number | bigint | null | undefined;
};

export function useSortableTable<T extends string, D>(
  data: D[],
  columns: SortableColumn<T, D>[],
  defaultSort?: { column: T; direction: SortDirection }
) {
  const [sortConfig, setSortConfig] = useState<SortConfig<T>>({
    column: defaultSort?.column ?? null,
    direction: defaultSort?.direction ?? "desc",
  });

  const handleSort = useCallback((column: T) => {
    setSortConfig((prev) => {
      if (prev.column === column) {
        return {
          column,
          direction: prev.direction === "asc" ? "desc" : "asc",
        };
      }
      return { column, direction: "desc" };
    });
  }, []);

  const sortedData = useMemo(() => {
    if (!sortConfig.column) return data;

    const columnConfig = columns.find((c) => c.key === sortConfig.column);
    if (!columnConfig) return data;

    return [...data].sort((a, b) => {
      const aVal = columnConfig.getValue(a);
      const bVal = columnConfig.getValue(b);

      // Handle null/undefined
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return sortConfig.direction === "asc" ? 1 : -1;
      if (bVal == null) return sortConfig.direction === "asc" ? -1 : 1;

      // Compare values
      let comparison = 0;
      if (typeof aVal === "bigint" && typeof bVal === "bigint") {
        comparison = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      } else if (typeof aVal === "number" && typeof bVal === "number") {
        comparison = aVal - bVal;
      } else if (typeof aVal === "string" && typeof bVal === "string") {
        comparison = aVal.localeCompare(bVal);
      } else {
        // Mixed types - convert to string
        comparison = String(aVal).localeCompare(String(bVal));
      }

      return sortConfig.direction === "asc" ? comparison : -comparison;
    });
  }, [data, columns, sortConfig]);

  return {
    sortedData,
    sortConfig,
    handleSort,
  };
}
