import { 
  BarChart3, 
  BrainCircuit, 
  CheckSquare, 
  FileText, 
  LayoutDashboard 
} from "lucide-react";
import { Link, useLocation } from "wouter";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

const NAV_ITEMS = [
  { title: "总览面板", url: "/", icon: LayoutDashboard },
  { title: "文档解析", url: "/analyze", icon: FileText },
  { title: "卡片校验", url: "/validate", icon: CheckSquare },
  { title: "间隔复习", url: "/review", icon: BrainCircuit },
  { title: "学习分析", url: "/analytics", icon: BarChart3 },
];

export function AppSidebar() {
  const [location] = useLocation();

  return (
    <Sidebar className="border-r border-border/50 bg-sidebar/50 backdrop-blur-xl">
      <SidebarHeader className="p-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary shadow-lg shadow-primary/25">
            <BrainCircuit className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground">AI 记忆引擎</h1>
            <p className="text-xs text-muted-foreground">智能 SRS 系统</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="px-6 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
            核心流程
          </SidebarGroupLabel>
          <SidebarGroupContent className="px-3 mt-2">
            <SidebarMenu>
              {NAV_ITEMS.map((item) => {
                const isActive = location === item.url;
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton 
                      asChild 
                      isActive={isActive}
                      className={`
                        mb-1 h-11 rounded-lg px-4 transition-all duration-200
                        ${isActive 
                          ? 'bg-primary/10 text-primary font-medium shadow-sm' 
                          : 'text-muted-foreground hover:bg-secondary/80 hover:text-foreground'
                        }
                      `}
                    >
                      <Link href={item.url} className="flex items-center gap-3">
                        <item.icon className={`h-5 w-5 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
                        <span className="text-sm">{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
