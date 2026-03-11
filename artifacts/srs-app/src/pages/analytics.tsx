import { useGetAnalyticsSummary, useGetHeatmapData } from "@workspace/api-client-react";
import { format, subDays, parseISO } from "date-fns";
import { Card } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { StatCard } from "@/components/ui/stat-card";
import { Brain, Calendar, Target, Zap } from "lucide-react";

export default function Analytics() {
  const { data: summary, isLoading: sumLoading } = useGetAnalyticsSummary();
  const { data: heatmap, isLoading: heatLoading } = useGetHeatmapData();

  if (sumLoading || heatLoading) {
    return <div className="p-12 animate-pulse flex flex-col gap-8">
      <div className="h-10 w-48 bg-muted rounded"></div>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[1,2,3,4].map(i => <div key={i} className="h-32 bg-muted rounded-xl"></div>)}
      </div>
      <div className="h-64 bg-muted rounded-xl"></div>
    </div>;
  }

  // Ensure we have some data for chart even if empty
  const chartData = heatmap?.data || [];
  const processedChartData = chartData.map(d => ({
    ...d,
    displayDate: format(parseISO(d.date), 'MM-dd')
  }));

  // Activity Grid (GitHub style) mock rendering
  // A real one would pad to 365 days, we'll just do a 30 day recent view for simplicity
  const today = new Date();
  const recentDays = Array.from({length: 30}).map((_, i) => {
    const d = subDays(today, 29 - i);
    const dateStr = format(d, 'yyyy-MM-dd');
    const record = chartData.find(x => x.date === dateStr);
    return { date: dateStr, count: record ? record.count : 0 };
  });

  const getIntensityColor = (count: number) => {
    if (count === 0) return 'bg-secondary dark:bg-secondary/50';
    if (count < 5) return 'bg-indigo-200 dark:bg-indigo-900';
    if (count < 15) return 'bg-indigo-400 dark:bg-indigo-700';
    if (count < 30) return 'bg-indigo-500 dark:bg-indigo-600';
    return 'bg-indigo-600 dark:bg-indigo-500';
  };

  return (
    <div className="h-full max-w-6xl mx-auto p-6 md:p-12 overflow-y-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
          <Target className="w-8 h-8 text-primary" />
          学习分析报告
        </h1>
        <p className="text-muted-foreground mt-2">查看你的学习历程与记忆数据</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <StatCard 
          title="记忆保持率" 
          value={`${Math.round((summary?.retentionRate || 0) * 100)}%`} 
          icon={<Brain className="w-6 h-6" />}
        />
        <StatCard 
          title="活跃卡片数" 
          value={summary?.activeCards || 0} 
          icon={<div className="font-bold text-lg">🗂️</div>}
        />
        <StatCard 
          title="历史总复习" 
          value={summary?.totalReviews || 0} 
          icon={<Calendar className="w-6 h-6" />}
        />
        <StatCard 
          title="最长连续学习" 
          value={`${summary?.streak || 0} 天`} 
          icon={<Zap className="w-6 h-6" />}
          trend={{ value: 12, label: "超过平均水平", positive: true }}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Chart */}
        <Card className="p-6 bg-card border-border/50 lg:col-span-2 shadow-md">
          <h3 className="text-lg font-bold mb-6">复习活动趋势</h3>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={processedChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="displayDate" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fill: 'hsl(var(--muted-foreground))', fontSize: 12}} 
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{fill: 'hsl(var(--muted-foreground))', fontSize: 12}}
                />
                <Tooltip 
                  cursor={{fill: 'hsl(var(--secondary))'}}
                  contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}}
                />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={40} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Heatmap Grid */}
        <Card className="p-6 bg-card border-border/50 shadow-md">
          <h3 className="text-lg font-bold mb-6">近30天热力图</h3>
          <div className="grid grid-cols-7 gap-2">
            {recentDays.map((day, i) => (
              <div 
                key={day.date}
                title={`${day.date}: ${day.count} reviews`}
                className={`aspect-square rounded-sm ${getIntensityColor(day.count)} transition-all hover:scale-110 hover:ring-2 ring-primary/30`}
              />
            ))}
          </div>
          <div className="mt-6 flex items-center justify-between text-xs text-muted-foreground">
            <span>少</span>
            <div className="flex gap-1">
              <div className="w-3 h-3 rounded-sm bg-secondary dark:bg-secondary/50"></div>
              <div className="w-3 h-3 rounded-sm bg-indigo-200 dark:bg-indigo-900"></div>
              <div className="w-3 h-3 rounded-sm bg-indigo-400 dark:bg-indigo-700"></div>
              <div className="w-3 h-3 rounded-sm bg-indigo-600 dark:bg-indigo-500"></div>
            </div>
            <span>多</span>
          </div>
        </Card>
      </div>
    </div>
  );
}
