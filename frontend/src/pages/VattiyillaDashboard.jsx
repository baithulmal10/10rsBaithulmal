import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, inr } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import {
  CalendarBlank, Clock, UsersThree, HandHeart, Users, Receipt,
  ArrowDown, ArrowUp, UserPlus, Heart, HandCoins, WarningCircle
} from "@phosphor-icons/react";

export default function VattiyillaDashboard() {
  const { user } = useAuth();
  const [s, setS] = useState(null);

  useEffect(() => {
    api.get("/accounts/summary", { params: { fund: "vattiyilla" } })
      .then(r => setS(r.data))
      .catch(() => {});
  }, []);

  return (
    <div data-testid="vattiyilla-dashboard" className="space-y-5">
      {/* Greeting */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[color:var(--text-secondary)] text-sm">VI</div>
          <div className="mt-1 text-[22px] sm:text-2xl font-bold text-[color:var(--text-primary)] leading-tight">
            Interest-free Loans · <span className="text-moss">{user?.role}</span>
          </div>
        </div>
        <div className="w-12 h-12 rounded-full bg-[rgba(21,122,69,0.15)] flex items-center justify-center text-moss">
          <HandCoins size={20} weight="duotone" />
        </div>
      </div>

      {/* Fund Balance hero */}
      <div className="hero-fund" data-testid="v-hero-fund-balance">
        <div className="text-white/85 text-sm">Available Kitty</div>
        <div className="mt-1 text-4xl sm:text-5xl font-bold tracking-tight leading-none">{inr(s?.balance)}</div>

        <div className="mt-6 grid grid-cols-2 divide-x divide-white/25">
          <div className="pr-4">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center">
                <ArrowDown size={14} weight="bold" />
              </span>
              <span className="text-white/85 text-sm">Repayments Received</span>
            </div>
            <div className="mt-1.5 text-xl font-semibold">{inr(s?.total_collected)}</div>
          </div>
          <div className="pl-4">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-full bg-[#FBE9BE] text-[#8A5A18] flex items-center justify-center">
                <ArrowUp size={14} weight="bold" />
              </span>
              <span className="text-white/85 text-sm">Loans Issued</span>
            </div>
            <div className="mt-1.5 text-xl font-semibold">{inr(s?.total_loan_issued)}</div>
          </div>
        </div>
      </div>

      {/* Colored tiles grid */}
      <div className="grid grid-cols-2 gap-3.5" data-testid="v-tiles">
        <Tile className="tile-mint" icon={CalendarBlank} label="Active Loans" value={s?.loans_active ?? 0} testid="v-tile-active" />
        <Tile className="tile-amber" icon={Clock} label="Outstanding" value={inr(s?.total_loan_outstanding)} testid="v-tile-outstanding" />
        <Tile className="tile-blue" icon={UsersThree} label="Closed Loans" value={s?.loans_closed ?? 0} testid="v-tile-closed" />
        <Tile className="tile-pink" icon={WarningCircle} label="Blocked" value={s?.loans_blocked ?? 0} testid="v-tile-blocked" />
      </div>

      {/* Quick Actions */}
      <div>
        <h2 className="text-lg sm:text-xl font-bold mt-2 mb-3">Quick Actions</h2>
        <div className="grid grid-cols-2 gap-3.5">
          <QuickAction to="/beneficiaries" icon={Heart} label="Add Beneficiary" testid="v-qa-beneficiary" />
          <QuickAction to="/vattiyilla-loans" icon={HandCoins} label="New VI" testid="v-qa-newloan" />
          <QuickAction to="/vattiyilla-loans" icon={Receipt} label="Collect Payment" testid="v-qa-collect-payment" />
          <QuickAction to="/vattiyilla-accounts" icon={Receipt} label="VI Accounts" testid="v-qa-accounts" />
          <QuickAction to="/reports" icon={Users} label="Reports" testid="v-qa-reports" />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3.5">
        <MiniStat icon={UsersThree} label="Beneficiaries" value={s?.beneficiaries_count ?? 0} />
        <MiniStat icon={HandCoins} label="Total Issued" value={inr(s?.total_loan_issued)} />
      </div>
    </div>
  );
}

const Tile = ({ className, icon: Icon, label, value, testid }) => (
  <div className={`${className} rounded-xl p-4 sm:p-5`} data-testid={testid}>
    <Icon size={22} weight="regular" />
    <div className="mt-4 text-sm font-medium opacity-90">{label}</div>
    <div className="mt-1 text-2xl sm:text-3xl font-bold">{value}</div>
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
  <div className="card-earth p-4 flex items-center gap-3">
    <span className="w-9 h-9 rounded-full bg-[rgba(21,122,69,0.12)] text-moss flex items-center justify-center">
      <Icon size={16} weight="duotone" />
    </span>
    <div className="min-w-0">
      <div className="text-xs text-[color:var(--text-muted)]">{label}</div>
      <div className="text-base font-bold truncate">{value}</div>
    </div>
  </div>
);
