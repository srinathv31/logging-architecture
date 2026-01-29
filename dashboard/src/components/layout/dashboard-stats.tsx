import { Activity, Users, Server, CheckCircle2 } from "lucide-react";
import { StatCard } from "./stat-card";
import { getDashboardStats } from "@/data/queries";

export async function DashboardStats() {
  const stats = await getDashboardStats();

  const successStatus = 
    stats.successRate >= 90 ? "success" : 
    stats.successRate >= 70 ? "warning" : "error";

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        icon={Activity}
        label="Total Traces"
        value={stats.totalTraces.toLocaleString()}
      />
      <StatCard
        icon={Users}
        label="Accounts Tracked"
        value={stats.totalAccounts.toLocaleString()}
      />
      <StatCard
        icon={Server}
        label="Systems Connected"
        value={stats.totalSystems}
        subtitle={stats.systemNames.length > 0 ? stats.systemNames.slice(0, 4).join(", ") + (stats.systemNames.length > 4 ? "..." : "") : undefined}
      />
      <StatCard
        icon={CheckCircle2}
        label="Success Rate"
        value={`${stats.successRate}%`}
        status={successStatus}
      />
    </div>
  );
}
