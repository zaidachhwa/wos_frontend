import {
  BarChart3,
  LayoutDashboard,
  Calendar,
  FolderKanban,
  CheckSquare,
  MessageSquare,
  Users,
  Bell,
  Settings,
  Trophy,
} from "lucide-react";

export const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/calendar", label: "Calendar", icon: Calendar },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/follow-ups", label: "Follow-ups", icon: MessageSquare },
  { href: "/team", label: "Team", icon: Users },
  { href: "/reports", label: "Reports", icon: BarChart3 },
  { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { href: "/notifications", label: "Notifications", icon: Bell },
  { href: "/settings", label: "Settings", icon: Settings },
];
