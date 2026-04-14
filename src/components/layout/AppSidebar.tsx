import { useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  MessageSquareText,
  GitCompare,
  Users,
  Database,
  FileBarChart,
  Settings,
  Trophy,
  Home,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import wizrIcon from "@/assets/wizr-icon-transparent.png";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";

interface NavItemDef {
  title: string;
  url: string;
  icon: React.ComponentType<{ className?: string }>;
  tourId: string;
}

const homeItem: NavItemDef = {
  title: "Inicio",
  url: "/dashboard",
  icon: Home,
  tourId: "nav-inicio",
};

const monitorItems: NavItemDef[] = [
  { title: "Fuentes", url: "/dashboard/fuentes", icon: Database, tourId: "nav-fuentes" },
  { title: "Panorama", url: "/dashboard/panorama", icon: LayoutDashboard, tourId: "nav-panorama" },
];

const analyzeItems: NavItemDef[] = [
  { title: "Semántica", url: "/dashboard/semantica", icon: MessageSquareText, tourId: "nav-semantica" },
  { title: "Comparativa", url: "/dashboard/comparativa", icon: GitCompare, tourId: "nav-comparativa" },
  { title: "Influenciadores", url: "/dashboard/influenciadores", icon: Users, tourId: "nav-influenciadores" },
  { title: "Rankings", url: "/dashboard/rankings", icon: Trophy, tourId: "nav-rankings" },
];

const produceItems: NavItemDef[] = [
  { title: "Reportes", url: "/dashboard/reportes", icon: FileBarChart, tourId: "nav-reportes" },
  { title: "Configuración", url: "/dashboard/configuracion", icon: Settings, tourId: "nav-configuracion" },
];

function NavItem({ item, collapsed, isActive }: { item: NavItemDef; collapsed: boolean; isActive: boolean }) {
  return (
    <SidebarMenuItem data-tour={item.tourId}>
      <SidebarMenuButton asChild isActive={isActive} tooltip={collapsed ? item.title : undefined}>
        <NavLink
          to={item.url}
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
          activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
        >
          <item.icon className="h-5 w-5 shrink-0" />
          {!collapsed && <span>{item.title}</span>}
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function NavGroup({ label, items, collapsed, isActive }: { label: string; items: NavItemDef[]; collapsed: boolean; isActive: (url: string) => boolean }) {
  return (
    <SidebarGroup className="mt-4">
      <SidebarGroupLabel className="px-2 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/60">
        {!collapsed ? label : ""}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <NavItem key={item.url} item={item} collapsed={collapsed} isActive={isActive(item.url)} />
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function AppSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const collapsed = state === "collapsed";
  const isActive = (path: string) => location.pathname === path;

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-white/90 p-1.5 flex items-center justify-center">
            <img src={wizrIcon} alt="Wizr" className="h-full w-full object-contain" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-lg font-bold text-sidebar-foreground tracking-tight">WIZR</span>
              <span className="text-[10px] text-sidebar-foreground/70 uppercase tracking-widest">
                Análisis Estratégico
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-4">
        {/* Home */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <NavItem
                item={homeItem}
                collapsed={collapsed}
                isActive={location.pathname === "/dashboard" || location.pathname === "/dashboard/inicio"}
              />
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <NavGroup label="Monitor" items={monitorItems} collapsed={collapsed} isActive={isActive} />
        <NavGroup label="Analizar" items={analyzeItems} collapsed={collapsed} isActive={isActive} />
        <NavGroup label="Producir" items={produceItems} collapsed={collapsed} isActive={isActive} />
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3">
        {!collapsed && (
          <p className="px-2 text-xs text-sidebar-foreground/50">Wizr Intelligence Platform</p>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
