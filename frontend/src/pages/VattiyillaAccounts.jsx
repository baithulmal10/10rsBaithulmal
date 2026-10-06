import { useEffect, useState } from "react";
import { api, formatDate, inr, formatDetail } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import StatusBadge from "@/components/StatusBadge";
import { toast } from "sonner";

export default function VattiyillaAccounts() {
  const [summary, setSummary] = useState(null);
  const [loans, setLoans] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const [s, l] = await Promise.all([
        api.get("/accounts/summary", { params: { fund: "vattiyilla" } }),
        api.get("/loans", { params: { kadan_type: "vattiyilla" } }),
      ]);
      setSummary(s.data);
      setLoans(l.data);
    } catch (e) { toast.error(formatDetail(e.response?.data?.detail)); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const totalRepayments = loans.reduce((acc, l) => acc + (l.total_paid || 0), 0);
  const totalIssued = loans.reduce((acc, l) => acc + (l.amount || 0), 0);

  return (
    <div data-testid="vattiyilla-accounts">
      <PageHeader
        title="VI Accounts"
        subtitle="Isolated ledger for the interest-free loan fund — separate from the main Baithulmal accounts."
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
        <div className="card-earth p-5 sm:p-6">
          <div className="text-xs uppercase tracking-widest text-[color:var(--text-muted)]">Available Kitty</div>
          <div className="text-3xl sm:text-4xl font-bold text-moss mt-2">{inr(summary?.balance)}</div>
        </div>
        <div className="card-earth p-5 sm:p-6">
          <div className="text-xs uppercase tracking-widest text-[color:var(--text-muted)]">Total Issued (all-time)</div>
          <div className="text-3xl sm:text-4xl font-bold mt-2">{inr(totalIssued)}</div>
        </div>
        <div className="card-earth p-5 sm:p-6">
          <div className="text-xs uppercase tracking-widest text-[color:var(--text-muted)]">Outstanding</div>
          <div className="text-3xl sm:text-4xl font-bold text-[color:var(--status-vatti)] mt-2">{inr(summary?.total_loan_outstanding)}</div>
        </div>
      </div>

      <h2 className="text-lg sm:text-xl font-bold mt-8 mb-4">Loan Ledger</h2>
      <div className="card-earth overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-sidebar">
              <TableHead>Beneficiary</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Issued</TableHead>
              <TableHead>Repaid</TableHead>
              <TableHead>Outstanding</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Due</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-10 text-[color:var(--text-muted)]">Loading…</TableCell></TableRow>
            ) : loans.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-10 text-[color:var(--text-muted)]">No VI loans yet.</TableCell></TableRow>
            ) : loans.map(l => {
              const outstanding = Math.max(0, l.amount - (l.total_paid || 0));
              return (
                <TableRow key={l.id} data-testid={`v-acc-row-${l.id}`}>
                  <TableCell>
                    <div className="font-medium">{l.beneficiary?.name}</div>
                    <div className="text-xs text-[color:var(--text-muted)]">{l.beneficiary?.contact}</div>
                  </TableCell>
                  <TableCell>{l.category}</TableCell>
                  <TableCell className="font-semibold">{inr(l.amount)}</TableCell>
                  <TableCell className="text-moss font-semibold">{inr(l.total_paid || 0)}</TableCell>
                  <TableCell className="text-[color:var(--status-vatti)] font-semibold">{inr(outstanding)}</TableCell>
                  <TableCell><StatusBadge status={l.status} /></TableCell>
                  <TableCell className="text-xs">{formatDate(l.due_date)}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="mt-6 flex items-center justify-between text-sm">
        <div className="text-[color:var(--text-muted)]">Total repayments recorded</div>
        <div className="font-bold text-moss text-lg">{inr(totalRepayments)}</div>
      </div>
    </div>
  );
}
