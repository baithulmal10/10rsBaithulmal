import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, inr } from "@/lib/api";
import { roleLabel, useAuth } from "@/context/AuthContext";
import {
  CalendarBlank, Clock, UsersThree, HandHeart, Users, Receipt,
  ArrowDown, ArrowUp, UserPlus, Heart, HandCoins
} from "@phosphor-icons/react";

export default function Dashboard() {
  const { user } = useAuth();
  const [s, setS] = useState(null);
  const [thisMonth, setThisMonth] = useState(0);

  useEffect(() => {
    api.get("/accounts/summary").then(r => setS(r.data)).catch(() => {});
    api.get("/reports", { params: { range: "monthly" } })
      .then(r => setThisMonth(r.data.totals.income))
      .catch(() => {});
  }, []);

  return (
    <div data-testid="dashboard" className="space-y-5">
      {/* Greeting */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[color:var(--text-secondary)] text-base">Assalamu Alaikum</div>
          <div className="mt-1 text-[22px] sm:text-2xl font-bold text-[color:var(--text-primary)] leading-tight">
            {user?.name?.split(" ")[0] || "Admin"} · <span>{roleLabel(user?.role)}</span>
          </div>
        </div>
        <div className="w-12 h-12 rounded-full bg-[rgba(21,122,69,0.15)] flex items-center justify-center text-moss">
          <span className="text-lg font-semibold">{(user?.name || "A").charAt(0).toUpperCase()}</span>
        </div>
      </div>

      {/* Fund Balance hero */}
      <div className="hero-fund" data-testid="hero-fund-balance">
        <div className="text-sm text-white/85">Fund Balance</div>
        <div className="mt-1 text-4xl font-bold leading-none tracking-tight sm:text-5xl">{inr(s?.balance)}</div>

        <div className="grid grid-cols-2 mt-6 divide-x divide-white/25">
          <div className="pr-4">
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center rounded-full w-7 h-7 bg-white/20">
                <ArrowDown size={14} weight="bold" />
              </span>
              <span className="text-sm text-white/85">Collected</span>
            </div>
            <div className="mt-1.5 text-xl font-semibold">{inr(s?.total_collected)}</div>
          </div>
          <div className="pl-4">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-full bg-[#FBE9BE] text-[#8A5A18] flex items-center justify-center">
                <ArrowUp size={14} weight="bold" />
              </span>
              <span className="text-sm text-white/85">Distributed</span>
            </div>
            <div className="mt-1.5 text-xl font-semibold">
              {inr((s?.total_expense || 0) + (s?.total_sadakah || 0))}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 mt-4 divide-x divide-white/25">
          <div className="pr-4">
            <div className="text-sm text-white/85">Loan Outstanding</div>
            <div className="mt-1.5 text-xl font-semibold">{inr(s?.loan_outstanding || s?.total_loan_outstanding || 0)}</div>
          </div>
          <div className="pl-4">
            <div className="text-sm text-white/85">VI Kadan (Loan)</div>
            <div className="mt-1.5 text-xl font-semibold">{inr(s?.loan_outstanding || s?.total_loan_outstanding || 0)}</div>
          </div>
        </div>
      </div>

      {/* Colored tiles grid */}
      <div className="grid grid-cols-2 gap-3.5" data-testid="tiles">
        <Tile
          className="tile-mint"
          icon={CalendarBlank}
          label="This Month"
          value={inr(thisMonth)}
          testid="tile-this-month"
        />
        <Tile
          className="tile-amber"
          icon={Clock}
          label="Pending"
          value={inr(s?.total_pending)}
          testid="tile-pending"
        />
        <Tile
          className="tile-blue"
          icon={UsersThree}
          label="Donors"
          value={s?.donors_count ?? 0}
          testid="tile-donors"
        />
        <Tile
          className="tile-pink"
          icon={HandHeart}
          label="Beneficiaries"
          value={s?.beneficiaries_count ?? 0}
          testid="tile-beneficiaries"
        />
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="mt-2 mb-3 text-lg font-bold sm:text-xl">Quick Actions</h2>
        <div className="grid grid-cols-2 gap-3.5">
          <QuickAction to="/donors" icon={UserPlus} label="Add Donor" testid="qa-add-donor" />
          <QuickAction to="/beneficiaries" icon={Heart} label="Add Beneficiary" testid="qa-add-beneficiary" />
          <QuickAction to="/payments" icon={Receipt} label="Collect Payment" testid="qa-collect-payment" />
          <QuickAction to="/kadan" icon={HandCoins} label="New Kadan" testid="qa-new-kadan" />
        </div>
      </div>

      {/* Extra glance stats */}
      <div className="grid grid-cols-2 gap-3.5">
        <MiniStat icon={HandCoins} label="Loans outstanding" value={inr(s?.total_loan_outstanding)} />
        <MiniStat icon={Users} label="Workers" value={s?.workers_count ?? 0} />
      </div>
    </div>
  );
}

const Tile = ({ className, icon: Icon, label, value, testid }) => (
  <div className={`${className} rounded-xl p-4 sm:p-5`} data-testid={testid}>
    <Icon size={22} weight="regular" />
    <div className="mt-4 text-sm font-medium opacity-90">{label}</div>
    <div className="mt-1 text-2xl font-bold sm:text-3xl">{value}</div>
  </div>
);

const QuickAction = ({ to, icon: Icon, label, testid }) => (
  <Link
    to={to}
    data-testid={testid}
    className="card-earth p-4 sm:p-5 flex flex-col items-start gap-3 hover:-translate-y-0.5 transition-transform"
  >
    <span className="w-11 h-11 rounded-full bg-[rgba(21,122,69,0.15)] text-moss flex items-center justify-center">
      <Icon size={20} weight="bold" />
    </span>
    <span className="text-sm sm:text-base font-semibold text-[color:var(--text-primary)]">{label}</span>
  </Link>
);

const MiniStat = ({ icon: Icon, label, value }) => (
  <div className="flex items-center gap-3 p-4 card-earth">
    <span className="w-9 h-9 rounded-full bg-[rgba(21,122,69,0.12)] text-moss flex items-center justify-center">
      <Icon size={16} weight="duotone" />
    </span>
    <div className="min-w-0">
      <div className="text-xs text-[color:var(--text-muted)]">{label}</div>
      <div className="text-base font-bold truncate">{value}</div>
    </div>
  </div>
);
