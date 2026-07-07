"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BarChart3, Trophy } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { ExpiringMonthRow, ReviewScoreRow } from "@/lib/dashboard/charts";
import { cn } from "@/lib/utils";

const BAR_COLORS = [
  "from-primary to-emerald-400",
  "from-sky-500 to-cyan-400",
  "from-violet-500 to-purple-400",
  "from-amber-500 to-orange-400",
  "from-rose-500 to-pink-400",
];

const MONTH_BAR_COLORS = [
  "from-primary to-emerald-300",
  "from-warning to-amber-300",
  "from-danger to-rose-400",
];

export function DashboardCharts() {
  const [reviewScores, setReviewScores] = useState<ReviewScoreRow[]>([]);
  const [expiringByMonth, setExpiringByMonth] = useState<ExpiringMonthRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard/charts")
      .then((r) => r.json())
      .then((data) => {
        setReviewScores(data.reviewScores ?? []);
        setExpiringByMonth(data.expiringByMonth ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const maxReviewScore = Math.max(1, ...reviewScores.map((r) => r.score));
  const maxExpiring = Math.max(1, ...expiringByMonth.map((m) => m.count));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-card to-primary/5">
        <CardContent>
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15">
              <Trophy className="h-4 w-4 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Review score</h3>
              <p className="text-[10px] text-muted">
                Confirm = 1 pt · Input/correct = 5 pts
              </p>
            </div>
          </div>

          {loading ? (
            <p className="text-sm text-muted">Loading scores...</p>
          ) : !reviewScores.length ? (
            <p className="text-sm text-muted">
              No review activity yet. Confirm fields on the review queue to earn
              points.
            </p>
          ) : (
            <div className="space-y-4">
              {reviewScores.map((row, index) => {
                const widthPct = (row.score / maxReviewScore) * 100;
                const confirmPts = row.confirmCount;
                const confirmShare =
                  row.score > 0 ? (confirmPts / row.score) * 100 : 0;

                return (
                  <motion.div
                    key={row.userId}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.06 }}
                  >
                    <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                      <span className="truncate font-medium text-foreground">
                        {row.userEmail}
                      </span>
                      <span className="shrink-0 font-bold text-primary">
                        {row.score} pts
                      </span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-accent/80">
                      <div
                        className={cn(
                          "flex h-full rounded-full bg-gradient-to-r transition-all duration-500",
                          BAR_COLORS[index % BAR_COLORS.length]
                        )}
                        style={{ width: `${widthPct}%` }}
                      >
                        <div
                          className="h-full bg-white/25"
                          style={{ width: `${confirmShare}%` }}
                        />
                      </div>
                    </div>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {row.confirmCount} confirm · {row.correctCount} correct
                    </p>
                  </motion.div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="overflow-hidden border-warning/20 bg-gradient-to-br from-card to-warning/5">
        <CardContent>
          <div className="mb-4 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-warning/15">
              <BarChart3 className="h-4 w-4 text-warning" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Ending in 3 months
              </h3>
              <p className="text-[10px] text-muted">Expirations & renewals by month</p>
            </div>
          </div>

          {loading ? (
            <p className="text-sm text-muted">Loading chart...</p>
          ) : (
            <div className="flex h-44 items-end justify-between gap-3 pt-2">
              {expiringByMonth.map((month, index) => {
                const heightPct = (month.count / maxExpiring) * 100;
                return (
                  <motion.div
                    key={month.monthKey}
                    className="flex min-w-0 flex-1 flex-col items-center gap-2"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.08 }}
                  >
                    <span className="text-sm font-bold text-foreground">
                      {month.count}
                    </span>
                    <div className="flex w-full flex-1 items-end">
                      <div
                        className={cn(
                          "w-full rounded-t-lg bg-gradient-to-t shadow-lg shadow-warning/10 transition-all duration-500",
                          MONTH_BAR_COLORS[index % MONTH_BAR_COLORS.length],
                          month.count === 0 ? "min-h-[4px] opacity-40" : "min-h-[8px]"
                        )}
                        style={{
                          height: `${Math.max(heightPct, month.count > 0 ? 12 : 4)}%`,
                        }}
                      />
                    </div>
                    <span className="w-full truncate text-center text-[10px] text-muted">
                      {month.label.split(" ")[0]}
                    </span>
                  </motion.div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
