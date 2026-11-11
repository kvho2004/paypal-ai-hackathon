"use client";

import { useMemo } from "react";
import { AgGridReact } from "ag-grid-react";
import { AllCommunityModule, ModuleRegistry, type ColDef, type ICellRendererParams } from "ag-grid-community";
import type { RewardRow } from "../../../lib/views/rewards";
import { PunchDots, theme, useAgThemeMode } from "../rewards/RewardsGrid";
import type { RankedPick } from "./agentTypes";

ModuleRegistry.registerModules([AllCommunityModule]);

const usd = (cents: number) => (cents / 100).toLocaleString("en-US", { style: "currency", currency: "USD" });

type PicksProps = {
  /** Ranked meal suggestions (suggestMeals), best first. */
  picks: RankedPick[];
  /** Called when the student presses Order. The Order button only shows for picks with canCheckout. */
  onOrder?: (pick: RankedPick) => void;
};
type RowsProps = {
  /** Rewards ranked by value (rankRedemptions): the same grid without an Order button. */
  rows: RewardRow[];
};

/**
 * The agent's ranked results, rendered in chat. Wide screens get a compact AG Grid; phones get cards, because the
 * columns do not fit. Use `picks` for meal suggestions or `rows` for reward rankings.
 */
export default function RankedGrid(props: PicksProps | RowsProps) {
  return "picks" in props ? <PicksView {...props} /> : <RowsView {...props} />;
}

// ---- Ranked meal picks ------------------------------------------------------------------------------------

function OrderCell({ data, context }: ICellRendererParams<RankedPick, unknown, { onOrder?: (p: RankedPick) => void }>) {
  if (!data?.canCheckout || !context.onOrder) return null;
  return (
    <button
      type="button"
      onClick={() => context.onOrder?.(data)}
      className="rounded-full bg-brand px-3 py-1 text-xs font-medium text-brand-contrast"
    >
      Order
    </button>
  );
}

function Chips({ pick }: { pick: RankedPick }) {
  return (
    <>
      {pick.unlocks && (
        <span className="rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success">
          Gets you {pick.unlocks}
        </span>
      )}
      {pick.offer && (
        <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-[#4a3700]">{pick.offer}</span>
      )}
    </>
  );
}

function PicksView({ picks, onOrder }: PicksProps) {
  useAgThemeMode();

  const columnDefs = useMemo<ColDef<RankedPick>[]>(
    () => [
      { field: "item", headerName: "Pick", flex: 1, minWidth: 140, wrapText: true, autoHeight: true },
      { field: "priceCents", headerName: "Price", width: 90, valueFormatter: (p) => usd(p.value) },
      {
        field: "pointsEarned",
        headerName: "Points",
        width: 95,
        valueFormatter: (p) => `+${p.value}`,
        tooltipValueGetter: () => "Points this order should earn. Pending until the program posts them.",
      },
      {
        headerName: "Why",
        flex: 2,
        minWidth: 200,
        wrapText: true,
        autoHeight: true,
        valueGetter: (p) => (p.data ? p.data.reasons.join(" · ") : ""),
      },
      {
        headerName: "Unlocks",
        width: 140,
        wrapText: true,
        autoHeight: true,
        valueGetter: (p) => p.data?.unlocks ?? p.data?.offer ?? "",
      },
      { headerName: "", width: 90, sortable: false, cellRenderer: OrderCell },
    ],
    [],
  );

  if (picks.length === 0) return <p className="text-sm text-muted">No matches. Try loosening a preference.</p>;

  return (
    <div>
      <ul className="space-y-3 sm:hidden">
        {picks.map((p) => (
          <li key={`${p.programId}:${p.item}`} className="rounded-2xl border border-line bg-surface p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="font-medium">{p.item}</p>
              <p className="shrink-0 font-display text-lg font-semibold text-brand-text">{usd(p.priceCents)}</p>
            </div>
            {p.reasons.length > 0 && (
              <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-muted">
                {p.reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            )}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted">+{p.pointsEarned} points pending</span>
              <Chips pick={p} />
            </div>
            {p.canCheckout && onOrder && (
              <button
                type="button"
                onClick={() => onOrder(p)}
                className="mt-3 w-full rounded-full bg-brand px-3 py-2 text-sm font-medium text-brand-contrast"
              >
                Order
              </button>
            )}
          </li>
        ))}
      </ul>

      <div className="hidden sm:block">
        <AgGridReact<RankedPick>
          theme={theme}
          rowData={picks}
          columnDefs={columnDefs}
          context={{ onOrder }}
          domLayout="autoHeight"
          autoSizeStrategy={{ type: "fitGridWidth" }}
          defaultColDef={{ sortable: false, resizable: true }}
          getRowId={(p) => `${p.data.programId}:${p.data.item}`}
          tooltipShowDelay={300}
        />
      </div>
    </div>
  );
}

// ---- Reward rankings --------------------------------------------------------------------------------------

function DotsCell({ data }: ICellRendererParams<RewardRow>) {
  return data ? (
    <div className="flex h-full items-center">
      <PunchDots row={data} />
    </div>
  ) : null;
}

function RowsView({ rows }: RowsProps) {
  useAgThemeMode();

  const columnDefs = useMemo<ColDef<RewardRow>[]>(
    () => [
      { field: "reward", headerName: "Reward", flex: 1, minWidth: 130 },
      { field: "programName", headerName: "Program", width: 120 },
      {
        field: "centsPerPoint",
        headerName: "¢ / pt",
        width: 90,
        valueFormatter: (p) => (p.value == null ? "n/a" : p.value.toFixed(2)),
        cellClassRules: {
          "font-semibold text-success": (p) => p.data?.valueFlag === "best",
          "font-semibold text-danger": (p) => p.data?.valueFlag === "poor",
        },
      },
      { field: "progress", headerName: "Close to earning", width: 300, sortable: false, cellRenderer: DotsCell },
    ],
    [],
  );

  if (rows.length === 0) return <p className="text-sm text-muted">No rewards to rank yet.</p>;

  return (
    <div>
      <ul className="space-y-3 sm:hidden">
        {rows.map((r) => (
          <li key={r.id} className="rounded-2xl border border-line bg-surface p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium">{r.reward}</p>
                <p className="text-xs text-muted">
                  {r.programName} · {r.pointCost} points
                </p>
              </div>
              {r.centsPerPoint !== null && (
                <p className="shrink-0 font-display text-lg font-semibold text-brand-text">
                  {r.centsPerPoint.toFixed(2)}¢
                </p>
              )}
            </div>
            <div className="mt-3">
              <PunchDots row={r} />
            </div>
          </li>
        ))}
      </ul>

      <div className="hidden sm:block">
        <AgGridReact<RewardRow>
          theme={theme}
          rowData={rows}
          columnDefs={columnDefs}
          domLayout="autoHeight"
          autoSizeStrategy={{ type: "fitGridWidth" }}
          defaultColDef={{ sortable: false, resizable: true }}
          getRowId={(p) => p.data.id}
        />
      </div>
    </div>
  );
}
