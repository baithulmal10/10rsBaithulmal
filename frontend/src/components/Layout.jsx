import { useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { isAccountantAdmin, isCollector, roleLabel, useAuth } from "@/context/AuthContext";
import { Toaster } from "@/components/ui/sonner";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  House, UsersThree, HandHeart, Coins, Receipt,
  ChartBar, Users, GearSix, SignOut, HandCoins, Bank, List,
  BookOpen, DotsThreeOutline
} from "@phosphor-icons/react";

const nav = [
  // 10Rs Baithulmal (main fund)
  { to: "/", icon: House, label: "Dashboard", testid: "nav-dashboard", end: true, group: "Baithulmal" },
  { to: "/donors", icon: HandHeart, label: "Donors", testid: "nav-donors", group: "Baithulmal" },
  { to: "/beneficiaries", icon: UsersThree, label: "Beneficiaries", testid: "nav-beneficiaries", group: "Baithulmal" },
  { to: "/payments", icon: Coins, label: "Payments", testid: "nav-payments", group: "Baithulmal" },
  { to: "/kadan", icon: HandCoins, label: "Kadan (Loan)", testid: "nav-kadan", group: "Baithulmal" },
  { to: "/sadakah", icon: HandHeart, label: "Sadakah", testid: "nav-sadakah", group: "Baithulmal" },
  { to: "/accounts", icon: Bank, label: "Accounts", testid: "nav-accounts", group: "Baithulmal" },

  // Vattiyilla Kadan (separate fund)
  { to: "/vattiyilla", icon: HandCoins, label: "V-Dashboard", testid: "nav-v-dashboard", group: "Vattiyilla" },
  { to: "/vattiyilla-loans", icon: HandCoins, label: "V-Loans", testid: "nav-vattiyilla", group: "Vattiyilla" },
  { to: "/vattiyilla-accounts", icon: Bank, label: "V-Accounts", testid: "nav-v-accounts", group: "Vattiyilla" },

  // Shared
  { to: "/workers", icon: Users, label: "Workers", testid: "nav-workers", group: "Shared" },
  { to: "/expenses", icon: Receipt, label: "Expenses", testid: "nav-expenses", group: "Shared" },
  { to: "/reports", icon: ChartBar, label: "Reports", testid: "nav-reports", group: "Shared" },
  { to: "/admin", icon: GearSix, label: "Admin", testid: "nav-admin", adminOnly: true, group: "Shared" },
];

/* Bottom nav for mobile — Home / Directory / Ledger / More */
const DIRECTORY_ROUTES = ["/donors", "/beneficiaries", "/workers"];
const LEDGER_ROUTES = ["/payments", "/kadan", "/vattiyilla", "/vattiyilla-loans", "/vattiyilla-accounts", "/sadakah", "/expenses", "/accounts", "/reports"];

function SidebarContent({ user, logout, onNavigate }) {
  return (
    <>
      <div className="px-6 pt-8 pb-6 flex items-center gap-3">
        <div className="coin-badge" aria-hidden>10₹</div>
        <div>
          <div className="text-[19px] leading-none font-bold text-moss">Baithulmal</div>
          <div className="text-[11px] tracking-[0.2em] uppercase text-[color:var(--text-muted)] mt-1">10₹ Community Fund</div>
        </div>
      </div>

      <nav className="px-3 flex-1 overflow-y-auto pb-6">
        {["Baithulmal", "Vattiyilla", "Shared"].map(group => {
          const items = nav.filter(n => n.group === group
            && (!n.adminOnly || isAccountantAdmin(user))
            );
          if (items.length === 0) return null;
          return (
            <div key={group} className="mb-4">
              <div className="px-3 mb-1 text-[10px] uppercase tracking-widest text-[color:var(--text-muted)] font-semibold">
                {group === "Baithulmal" ? "10₹ Baithulmal" : group === "Vattiyilla" ? "Vattiyilla Kadan" : "Shared"}
              </div>
              {items.map(n => {
                const Icon = n.icon;
                return (
                  <NavLink
                    key={n.to}
                    to={n.to}
                    end={n.end}
                    onClick={onNavigate}
                    className={({ isActive }) => "side-link " + (isActive ? "active" : "")}
                    data-testid={n.testid}
                  >
                    <Icon size={18} weight="duotone" />
                    <span>{n.to === "/payments" && isCollector(user) ? "My Collections" : n.label}</span>
                  </NavLink>
                );
              })}
            </div>
          );
        })}
      </nav>

      <div className="px-4 pb-6 border-t border-earth pt-4 mx-3">
        <div className="text-xs text-[color:var(--text-muted)] uppercase tracking-wider">Signed in as</div>
        <div className="mt-1 font-medium text-[color:var(--text-primary)]">{user?.name}</div>
        <div className="text-xs text-[color:var(--text-secondary)]">{roleLabel(user?.role)}</div>
        <button
          onClick={logout}
          data-testid="logout-btn"
          className="mt-3 w-full flex items-center justify-center gap-2 text-sm px-3 py-2 rounded-full border border-earth hover:bg-white transition-colors"
        >
          <SignOut size={16} weight="duotone" /> Logout
        </button>
      </div>
    </>
  );
}

function BottomNav({ location, user }) {
  const path = location.pathname;
  const isHome = path === "/";
  const isDir = DIRECTORY_ROUTES.some(r => path.startsWith(r));
  const isLed = LEDGER_ROUTES.some(r => path.startsWith(r));
  const isMore = path.startsWith("/admin") || (!isHome && !isDir && !isLed);

  const items = [
    { to: "/", label: "Home", icon: House, active: isHome, testid: "bn-home" },
    { to: "/donors", label: "Directory", icon: UsersThree, active: isDir, testid: "bn-directory" },
    { to: "/payments", label: "Ledger", icon: BookOpen, active: isLed, testid: "bn-ledger" },
    { to: "/reports", label: "More", icon: DotsThreeOutline, active: isMore, testid: "bn-more" },
  ];

  return (
    <div className="bottom-nav lg:hidden" data-testid="mobile-bottom-nav">
      {items.map(it => {
        const Icon = it.icon;
        return (
          <NavLink key={it.to} to={it.to} className={it.active ? "active" : ""} data-testid={it.testid}>
            <Icon size={22} weight={it.active ? "fill" : "regular"} className="bn-icon" />
            <span>{it.label}</span>
          </NavLink>
        );
      })}
    </div>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const currentLabel = nav.find(n => (n.end ? location.pathname === n.to : location.pathname.startsWith(n.to)))?.label || "Baithulmal";

  return (
    <div className="min-h-screen flex bg-app" data-testid="app-shell">
      {/* Desktop sidebar */}
      <aside
        className="hidden lg:flex w-[260px] shrink-0 bg-white border-r border-earth flex-col"
        data-testid="sidebar"
      >
        <SidebarContent user={user} logout={logout} />
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile top bar */}
        <header className="lg:hidden sticky top-0 z-30 bg-white border-b border-earth px-4 py-3 flex items-center justify-between" data-testid="mobile-header">
          <div className="flex items-center gap-3">
            <div className="coin-badge-sm" aria-hidden>10₹</div>
            <div>
              <div className="text-base leading-none font-bold text-moss">Baithulmal</div>
              <div className="text-[10px] tracking-[0.2em] uppercase text-[color:var(--text-muted)] mt-1">{currentLabel}</div>
            </div>
          </div>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <button
                className="w-10 h-10 rounded-full border border-earth bg-white flex items-center justify-center"
                data-testid="mobile-menu-btn"
                aria-label="Open menu"
              >
                <List size={20} weight="bold" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[280px] p-0 bg-white flex flex-col" data-testid="mobile-sidebar">
              <SidebarContent user={user} logout={logout} onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>
        </header>

        <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8 pb-24 lg:pb-8" data-testid="main-content">
          <Outlet />
        </main>
      </div>

      <BottomNav location={location} user={user} />
      <Toaster position="top-right" richColors />
    </div>
  );
}
