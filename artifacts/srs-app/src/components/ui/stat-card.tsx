import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  description?: string;
  delay?: number;
  trend?: { value: number; label: string; positive?: boolean };
}

export function StatCard({ title, value, icon, description, delay = 0, trend }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: "easeOut" }}
    >
      <Card className="overflow-hidden border-border/50 bg-card/50 backdrop-blur-sm hover:shadow-xl hover:border-primary/20 transition-all duration-300">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="p-3 rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20">
              {icon}
            </div>
            {trend && (
              <div className={`text-xs font-medium px-2.5 py-1 rounded-full ${
                trend.positive ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'
              }`}>
                {trend.positive ? '+' : '-'}{Math.abs(trend.value)}% {trend.label}
              </div>
            )}
          </div>
          <div className="mt-6">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <h3 className="text-3xl font-bold tracking-tight text-foreground mt-1">{value}</h3>
            {description && (
              <p className="text-xs text-muted-foreground mt-2">{description}</p>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
