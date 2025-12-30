import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Cpu, CreditCard, Database, Zap } from "lucide-react";
import { createPortalSession } from "@/api/stripe";
import { fetchMonthlyUsageSummary } from "@/api/usage";
import { toast } from "@/components/ui/use-toast";

const plan = {
  name: "Team",
  price: "$39",
  cadence: "per user / mo",
  tokens: "2M tokens / mo pooled",
  nextInvoice: "Apr 30, 2026",
};

const usageCatalog = [
  {
    id: "training",
    label: "Training compute",
    unit: "GPU-hr",
    billingUnit: 1,
    included: 25,
    rate: 0.45,
    icon: Cpu,
    accent: "text-indigo-600",
    bg: "bg-indigo-100",
  },
  {
    id: "inference",
    label: "Inference",
    unit: "images",
    billingUnit: 1000,
    included: 250000,
    rate: 0.08,
    icon: Zap,
    accent: "text-amber-600",
    bg: "bg-amber-100",
  },
  {
    id: "storage",
    label: "Storage",
    unit: "GB-month",
    billingUnit: 1,
    included: 500,
    rate: 0.02,
    icon: Database,
    accent: "text-blue-600",
    bg: "bg-blue-100",
  },
];

const formatNumber = (value) => Number(value).toLocaleString("en-US");

export default function Billing() {
  const [portalLoading, setPortalLoading] = useState(false);
  const [usageMetrics, setUsageMetrics] = useState({ training: 0, inference: 0, storage: 0 });
  const [usageLoading, setUsageLoading] = useState(true);
  const [usageError, setUsageError] = useState(null);

  useEffect(() => {
    let isActive = true;

    const loadUsage = async () => {
      setUsageLoading(true);
      setUsageError(null);
      try {
        const summary = await fetchMonthlyUsageSummary();
        if (isActive) {
          setUsageMetrics(summary);
        }
      } catch (error) {
        console.error("Failed to load usage summary:", error);
        if (isActive) {
          setUsageError(error?.message || "Unable to load usage data.");
        }
      } finally {
        if (isActive) {
          setUsageLoading(false);
        }
      }
    };

    loadUsage();

    return () => {
      isActive = false;
    };
  }, []);

  const usageItems = useMemo(
    () =>
      usageCatalog.map((item) => ({
        ...item,
        used: Number.isFinite(usageMetrics[item.id]) ? usageMetrics[item.id] : 0,
      })),
    [usageMetrics]
  );

  const usageWithCosts = useMemo(
    () =>
      usageItems.map((item) => {
        const progress = item.included > 0 ? Math.min(100, (item.used / item.included) * 100) : 0;
        const usageCost = (item.used / item.billingUnit) * item.rate;
        const overageUnits = Math.max(0, item.used - item.included);
        const overageCost = (overageUnits / item.billingUnit) * item.rate;
        return {
          ...item,
          progress,
          usageCost,
          overageUnits,
          overageCost,
        };
      }),
    [usageItems]
  );

  const totals = useMemo(
    () =>
      usageWithCosts.reduce(
        (acc, item) => ({
          usageCost: acc.usageCost + item.usageCost,
          overageCost: acc.overageCost + item.overageCost,
        }),
        { usageCost: 0, overageCost: 0 }
      ),
    [usageWithCosts]
  );

  return (
    <div className="min-h-screen p-6 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
              <CreditCard className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Billing & Usage</h1>
              <p className="text-gray-600">Track training, inference, and storage spend in real time.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="bg-blue-100 text-blue-700 border-0">
              {plan.name} plan
            </Badge>
            <Link to={createPageUrl("Pricing")}>
              <Button variant="outline">See pricing</Button>
            </Link>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <Card className="glass-effect border-0 shadow-lg">
            <CardHeader>
              <CardTitle>Current plan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-2xl font-semibold text-gray-900">{plan.name}</p>
              <p className="text-sm text-gray-600">
                {plan.price} {plan.cadence}
              </p>
              <p className="text-sm text-gray-500">{plan.tokens}</p>
              <p className="text-xs text-gray-400">Next invoice: {plan.nextInvoice}</p>
            </CardContent>
          </Card>

          <Card className="glass-effect border-0 shadow-lg">
            <CardHeader>
              <CardTitle>Usage value (month to date)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-3xl font-semibold text-gray-900">
                  ${totals.usageCost.toFixed(2)}
                </p>
                <p className="text-xs text-gray-500">Total usage at metered rates</p>
              </div>
              <div>
                <p className="text-lg font-semibold text-blue-600">
                  ${totals.overageCost.toFixed(2)}
                </p>
                <p className="text-xs text-gray-500">Estimated overages after included usage</p>
              </div>
            </CardContent>
          </Card>

          <Card className="glass-effect border-0 shadow-lg">
            <CardHeader>
              <CardTitle>Billing controls</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm text-gray-600">
                <span>Spend alerts</span>
                <span className="font-semibold text-gray-900">Enabled</span>
              </div>
              <div className="flex items-center justify-between text-sm text-gray-600">
                <span>Monthly cap</span>
                <span className="font-semibold text-gray-900">$750</span>
              </div>
              <Button
                className="w-full bg-blue-600 hover:bg-blue-700"
                onClick={async () => {
                  if (portalLoading) return;
                  setPortalLoading(true);
                  try {
                    const { url } = await createPortalSession();
                    if (url) {
                      window.location.href = url;
                    }
                  } catch (error) {
                    toast({
                      title: "Unable to open billing portal",
                      description: error?.message || "Please contact support.",
                    });
                  } finally {
                    setPortalLoading(false);
                  }
                }}
              >
                {portalLoading ? "Opening portal..." : "Manage billing"}
              </Button>
            </CardContent>
          </Card>
        </div>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-gray-500">Usage</p>
              <h2 className="text-2xl font-semibold text-gray-900">Services this month</h2>
            </div>
            <span className="text-sm text-gray-500">
              {usageLoading
                ? "Loading usage..."
                : usageError
                ? "Usage data unavailable."
                : "Included usage resets every billing cycle."}
            </span>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {usageWithCosts.map((item) => {
              const Icon = item.icon;
              return (
                <Card key={item.id} className="glass-effect border-0 shadow-lg">
                  <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                      <CardTitle className="text-base">{item.label}</CardTitle>
                      <p className="text-xs text-gray-500">
                        Rate ${item.rate} / {item.billingUnit === 1 ? item.unit : `1k ${item.unit}`}
                      </p>
                    </div>
                    <div className={`w-10 h-10 rounded-lg ${item.bg} flex items-center justify-center`}>
                      <Icon className={`w-5 h-5 ${item.accent}`} />
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-baseline justify-between">
                      <p className="text-xl font-semibold text-gray-900">
                        {formatNumber(item.used)} {item.unit}
                      </p>
                      <span className="text-xs text-gray-500">
                        / {formatNumber(item.included)} included
                      </span>
                    </div>
                    <Progress value={item.progress} className="h-2" />
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>{item.progress.toFixed(0)}% of included usage</span>
                      <span>
                        Overages: ${item.overageCost.toFixed(2)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </section>

        <section className="space-y-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-gray-500">Cost breakdown</p>
            <h2 className="text-2xl font-semibold text-gray-900">Line items</h2>
          </div>
          <Card className="glass-effect border-0 shadow-lg">
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Service</TableHead>
                    <TableHead>Used</TableHead>
                    <TableHead>Included</TableHead>
                    <TableHead>Billable</TableHead>
                    <TableHead>Rate</TableHead>
                    <TableHead className="text-right">Est. overage</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usageWithCosts.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.label}</TableCell>
                      <TableCell>
                        {formatNumber(item.used)} {item.unit}
                      </TableCell>
                      <TableCell>
                        {formatNumber(item.included)} {item.unit}
                      </TableCell>
                      <TableCell>
                        {formatNumber(item.overageUnits)} {item.unit}
                      </TableCell>
                      <TableCell>
                        ${item.rate} / {item.billingUnit === 1 ? item.unit : `1k ${item.unit}`}
                      </TableCell>
                      <TableCell className="text-right">${item.overageCost.toFixed(2)}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow>
                    <TableCell colSpan={5} className="text-right font-semibold">
                      Total estimated overage
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      ${totals.overageCost.toFixed(2)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}
