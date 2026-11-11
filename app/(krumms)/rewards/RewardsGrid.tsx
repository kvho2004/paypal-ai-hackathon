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

// AG Grid's theme API takes colors, not CSS classes, so the brand blue (#2f398e) is repeated here for each mode.
const theme = themeQuartz
  .withPart(colorSchemeVariable)
  .withParams(
    {
      accentColor: "#2f398e",
      backgroundColor: "#ffffff",
      foregroundColor: "#1c2040",
      headerBackgroundColor: "#eef0fb",
      headerTextColor: "#2f398e",
      borderColor: "rgba(47, 57, 142, 0.14)",
      fontFamily: "inherit",
      headerFontWeight: 600,
      borderRadius: 10,
      wrapperBorderRadius: 12,
    },
    "light",
  )
  .withParams(
    {
      accentColor: "#a3acff",
      backgroundColor: "#161a46",
      foregroundColor: "#eceefb",
      headerBackgroundColor: "#1f2468",
      headerTextColor: "#a3acff",
      borderColor: "rgba(163, 172, 255, 0.2)",
    },
    "dark",
  );

const usd = (cents: number) => (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });

function timeAgo(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  return hrs < 24 ? `${hrs} hr ago` : `${Math.round(hrs / 24)} d ago`;
}

const DOTS = 10;

/**
 * Progress toward a reward as a punch card: one dot per tenth of the point cost. A card is only full when the
 * reward is actually redeemable, so a nearly-there balance never shows ten dots.
 */
function PunchDots({ row }: { row: RewardRow }) {
  const ready = row.pointsNeeded === 0;
  const filled = ready ? DOTS : Math.min(DOTS - 1, Math.floor(row.progress * DOTS));
  return (
    <div className="flex items-center gap-2" title={`${row.balance} of ${row.pointCost} points`}>
      <span className="flex gap-1" aria-hidden>
        {Array.from({ length: DOTS }, (_, i) => (
          <span
            key={i}
            className={`h-2.5 w-2.5 rounded-full ${
              i < filled ? (ready ? "bg-success" : "bg-brand-text") : "border border-line bg-transparent"
            }`}
          />
        ))}
      </span>
      <span className={`text-xs ${ready ? "font-semibold text-success" : "text-muted"}`}>
        {ready ? "Ready!" : `${row.pointsNeeded} to go`}
      </span>
    </div>
  );
}

function ProgressCell({ data }: ICellRendererParams<RewardRow>) {
  if (!data) return null;
  return (
    <div className="flex h-full items-center">
      <PunchDots row={data} />
    </div>
  );
}

/** Phone layout: one card per reward, because the grid's columns do not fit a narrow screen. */
function RewardCard({ row }: { row: RewardRow }) {
  const live = row.source === "live";
  const flagText = row.valueFlag === "best" ? "Best value" : row.valueFlag === "poor" ? "Poor use of points" : null;
  return (
    <li className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-medium">{row.reward}</p>
          <p className="text-xs text-muted">
            {row.programName} · {row.pointCost} points
          </p>
        </div>
        {row.centsPerPoint !== null && (
          <div className="shrink-0 text-right">
            <p
              className={`font-display text-lg font-semibold ${
                row.valueFlag === "best" ? "text-success" : row.valueFlag === "poor" ? "text-danger" : "text-brand-text"
              }`}
            >
              {row.centsPerPoint.toFixed(2)}¢
            </p>
            <p className="text-[11px] text-muted">per point</p>
          </div>
        )}
      </div>
      <div className="mt-3">
        <PunchDots row={row} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
        {flagText && (
          <span
            className={`rounded-full px-2 py-0.5 font-medium ${
              row.valueFlag === "best" ? "bg-success/15 text-success" : "bg-danger/15 text-danger"
            }`}
          >
            {flagText}
          </span>
        )}
        <span className={`rounded-full px-2 py-0.5 font-medium ${live ? "bg-success/15 text-success" : "bg-accent text-[#4a3700]"}`}>
          {row.source}
        </span>
        <span>{timeAgo(row.fetchedAt)}</span>
        {row.expiresAt && <span>· expires {row.expiresAt}</span>}
      </div>
    </li>
  );
}

/** Freshness badge: how old the balance read is, and whether it is live or mock data. */
function FreshnessCell({ data }: ICellRendererParams<RewardRow>) {
  if (!data) return null;
  const live = data.source === "live";
  return (
    <span className="flex h-full items-center gap-2 text-xs">
      <span
        className={`rounded-full px-2 py-0.5 font-medium ${
          live ? "bg-success/15 text-success" : "bg-accent text-[#4a3700]"
        }`}
      >
        {data.source}
      </span>
      <span className="text-muted">{timeAgo(data.fetchedAt)}</span>
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

  const hasExpiry = rows.some((r) => r.expiresAt);

  const columnDefs = useMemo<ColDef<RewardRow>[]>(
    () => [
      { field: "programName", headerName: "Program", width: 140 },
      { field: "reward", headerName: "Reward", flex: 1, minWidth: 170 },
      { field: "pointCost", headerName: "Points", width: 100, type: "numericColumn" },
      {
        field: "menuValueCents",
        headerName: "Worth",
        width: 130,
        type: "numericColumn",
        valueFormatter: (p) => (p.value == null ? "n/a" : usd(p.value)),
      },
      {
        field: "centsPerPoint",
        headerName: "¢ / pt",
        width: 120,
        type: "numericColumn",
        sort: "desc", // best value first
        valueFormatter: (p) => (p.value == null ? "n/a" : p.value.toFixed(2)),
        cellClassRules: {
          "font-semibold text-success": (p) => p.data?.valueFlag === "best",
          "font-semibold text-danger": (p) => p.data?.valueFlag === "poor",
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
        width: 250,
        cellRenderer: ProgressCell,
        comparator: (a: number, b: number) => a - b,
      },
      // Only worth a column when at least one reward actually expires (Demo Diner's do not).
      ...(hasExpiry
        ? [
            {
              field: "expiresAt",
              headerName: "Expires",
              width: 120,
              valueFormatter: (p: { value: string | null }) => p.value ?? "none",
            } satisfies ColDef<RewardRow>,
          ]
        : []),
      { field: "fetchedAt", headerName: "Updated", width: 190, cellRenderer: FreshnessCell },
    ],
    [hasExpiry],
  );

  // The grid filters itself (quickFilterText); the phone cards need the same filter applied by hand.
  const needle = filter.trim().toLowerCase();
  const visibleRows = needle
    ? rows.filter((r) => `${r.programName} ${r.reward}`.toLowerCase().includes(needle))
    : rows;

  return (
    <div>
      <input
        type="search"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder="Filter rewards..."
        aria-label="Filter rewards"
        className="mb-3 w-full max-w-xs rounded-full border border-line bg-k-bg px-4 py-1.5 text-sm outline-none focus:border-brand-text"
      />
      <ul className="space-y-3 sm:hidden">
        {visibleRows.map((r) => (
          <RewardCard key={r.id} row={r} />
        ))}
        {visibleRows.length === 0 && <li className="py-6 text-center text-sm text-muted">No rewards match.</li>}
      </ul>
      <div className="hidden sm:block">
        <AgGridReact<RewardRow>
          theme={theme}
          rowData={rows}
          columnDefs={columnDefs}
          // Height follows the rows instead of a fixed box, and the columns shrink to fit the card.
          domLayout="autoHeight"
          autoSizeStrategy={{
            type: "fitGridWidth",
            columnLimits: [
              { colId: "programName", minWidth: 120 },
              { colId: "expiresAt", minWidth: 100 },
              { colId: "pointCost", minWidth: 80 },
              { colId: "menuValueCents", minWidth: 105 },
              { colId: "centsPerPoint", minWidth: 95 },
              { colId: "progress", minWidth: 215 },
              { colId: "fetchedAt", minWidth: 150 },
              { colId: "reward", minWidth: 130 },
            ],
          }}
          quickFilterText={filter}
          defaultColDef={{ sortable: true, resizable: true }}
          getRowId={(p) => p.data.id}
          rowClassRules={{
            "bg-success/10": (p) => p.data?.valueFlag === "best",
            "bg-danger/10": (p) => p.data?.valueFlag === "poor",
          }}
          tooltipShowDelay={300}
        />
      </div>
    </div>
  );
}
