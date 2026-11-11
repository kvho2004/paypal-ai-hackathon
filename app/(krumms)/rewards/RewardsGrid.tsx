"use client";

import { useEffect, useMemo, useState } from "react";
import { AgGridReact } from "ag-grid-react";
import {
  AllCommunityModule,
  ModuleRegistry,
  colorSchemeVariable,
  themeQuartz,
  type ColDef,
  type ICellRendererParams,
} from "ag-grid-community";
import type { RewardRow } from "../../../lib/views/rewards";

ModuleRegistry.registerModules([AllCommunityModule]);

const theme = themeQuartz.withPart(colorSchemeVariable);

const usd = (cents: number) => (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });

function timeAgo(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  return hrs < 24 ? `${hrs} hr ago` : `${Math.round(hrs / 24)} d ago`;
}

/** Progress toward a reward: balance / point cost, with "ready" once it is redeemable. */
function ProgressCell({ data }: ICellRendererParams<RewardRow>) {
  if (!data) return null;
  const ready = data.pointsNeeded === 0;
  return (
    <div className="flex h-full items-center gap-2" title={`${data.balance} of ${data.pointCost} points`}>
      <div className="h-2 w-24 overflow-hidden rounded-full bg-black/10 dark:bg-white/15">
        <div
          className={`h-full rounded-full ${ready ? "bg-green-600" : "bg-blue-500"}`}
          style={{ width: `${Math.round(data.progress * 100)}%` }}
        />
      </div>
      <span className="text-xs opacity-80">{ready ? "Ready" : `${data.pointsNeeded} to go`}</span>
    </div>
  );
}

/** Freshness badge: how old the balance read is, and whether it is live or mock data. */
function FreshnessCell({ data }: ICellRendererParams<RewardRow>) {
  if (!data) return null;
  const live = data.source === "live";
  return (
    <span className="flex h-full items-center gap-2 text-xs">
      <span
        className={`rounded px-1.5 py-0.5 ${
          live ? "bg-green-600/15 text-green-700 dark:text-green-300" : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
        }`}
      >
        {data.source}
      </span>
      <span className="opacity-70">{timeAgo(data.fetchedAt)}</span>
    </span>
  );
}

export default function RewardsGrid({ rows }: { rows: RewardRow[] }) {
  const [filter, setFilter] = useState("");

  // The theme follows the OS light/dark setting.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => document.body.setAttribute("data-ag-theme-mode", mq.matches ? "dark" : "light");
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  const columnDefs = useMemo<ColDef<RewardRow>[]>(
    () => [
      { field: "programName", headerName: "Program", width: 140 },
      { field: "reward", headerName: "Reward", flex: 1, minWidth: 170 },
      { field: "pointCost", headerName: "Points", width: 100, type: "numericColumn" },
      {
        field: "menuValueCents",
        headerName: "Menu value",
        width: 130,
        type: "numericColumn",
        valueFormatter: (p) => (p.value == null ? "n/a" : usd(p.value)),
      },
      {
        field: "centsPerPoint",
        headerName: "¢ / point",
        width: 120,
        type: "numericColumn",
        sort: "desc", // best value first
        valueFormatter: (p) => (p.value == null ? "n/a" : p.value.toFixed(2)),
        cellClassRules: {
          "font-semibold text-green-700 dark:text-green-300": (p) => p.data?.valueFlag === "best",
          "font-semibold text-red-600 dark:text-red-400": (p) => p.data?.valueFlag === "poor",
        },
        tooltipValueGetter: (p) =>
          p.data?.valueFlag === "best"
            ? "Best value"
            : p.data?.valueFlag === "poor"
              ? "Poor use of points"
              : undefined,
      },
      {
        field: "progress",
        headerName: "Close to earning",
        width: 210,
        cellRenderer: ProgressCell,
        comparator: (a: number, b: number) => a - b,
      },
      {
        field: "expiresAt",
        headerName: "Expires",
        width: 120,
        valueFormatter: (p) => p.value ?? "none",
      },
      { field: "fetchedAt", headerName: "Updated", width: 190, cellRenderer: FreshnessCell },
    ],
    [],
  );

  return (
    <div>
      <input
        type="search"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filter rewards..."
        aria-label="Filter rewards"
        className="mb-3 w-full max-w-xs rounded border border-black/15 bg-transparent px-3 py-1.5 text-sm dark:border-white/20"
      />
      <div style={{ height: 420 }}>
        <AgGridReact<RewardRow>
          theme={theme}
          rowData={rows}
          columnDefs={columnDefs}
          quickFilterText={filter}
          defaultColDef={{ sortable: true, resizable: true }}
          getRowId={(p) => p.data.id}
          rowClassRules={{
            "bg-green-500/10": (p) => p.data?.valueFlag === "best",
            "bg-red-500/10": (p) => p.data?.valueFlag === "poor",
          }}
          tooltipShowDelay={300}
        />
      </div>
    </div>
  );
}
