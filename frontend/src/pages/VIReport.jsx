import { useEffect, useState } from "react";
import { api, formatDate, formatDetail, inr } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { ArrowClockwise } from "@phosphor-icons/react";

const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};
const monthStart = () => `${today().slice(0, 7)}-01`;

const STATUS_LABELS = {
  pending: "Pending",
  active: "Active",
  time_limit_exceed: "Overdue",
  blocked: "Blocked",
  closed: "Closed",
  rejected: "Rejected",
};

export default function VIReport() {
  const [dateFrom, setDateFrom] = useState(monthStart);
  const [dateTo, setDateTo] = useState(today);
  const [status, setStatus] = useState("all");
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);

  const applyFilter = async (filters = { dateFrom, dateTo, status }) => {
    if (!filters.dateFrom || !filters.dateTo) return toast.error("Select both dates");
    if (filters.dateTo < filters.dateFrom) return toast.error("End date must be on or after start date");
    setLoading(true);
    try {
      const { data } = await api.get("/reports/vi", {
        params: {
          date_from: filters.dateFrom,
          date_to: filters.dateTo,
          ...(filters.status !== "all" ? { status: filters.status } : {}),
        },
      });
      setReport(data);
    } catch (error) {
      toast.error(formatDetail(error.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { applyFilter(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const reset = () => {
    const from = monthStart();
    const to = today();
    setDateFrom(from);
    setDateTo(to);
    setStatus("all");
    applyFilter({ dateFrom: from, dateTo: to, status: "all" });
  };

  return (
    <div data-testid="vi-report">
      <PageHeader title="VI Report" subtitle="VI Kadan applications and loan balances only. Dates filter by application date." />

      <div className="card-earth p-4 mb-5 grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
        <div><Label htmlFor="vi-from">Application Date From</Label><Input id="vi-from" type="date" value={dateFrom} onChange={event => setDateFrom(event.target.value)} /></div>
        <div><Label htmlFor="vi-to">Application Date To</Label><Input id="vi-to" type="date" value={dateTo} onChange={event => setDateTo(event.target.value)} /></div>
        <div>
          <Label htmlFor="vi-status">VI Status</Label>
          <select id="vi-status" value={status} onChange={event => setStatus(event.target.value)} className="flex h-10 w-full rounded-md border border-earth bg-white px-3 text-sm">
            <option value="all">All Statuses</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
        <div className="flex gap-2">
          <Button type="button" onClick={() => applyFilter()} disabled={loading} className="btn-primary-moss rounded-full"><ArrowClockwise size={14} className="mr-2" />{loading ? "Loading..." : "Apply Filter"}</Button>
          <Button type="button" variant="outline" onClick={reset} disabled={loading} className="rounded-full">Reset</Button>
        </div>
      </div>

      {report && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-5">
            <Summary label="VI Records" value={report.records} />
            <Summary label="Total Issued" value={inr(report.total_issued)} />
            <Summary label="Outstanding Balance" value={inr(report.total_outstanding)} />
            <Summary label="Application Date Range" value={`${formatDate(report.date_from)} – ${formatDate(report.date_to)}`} />
          </div>
          <div className="card-earth overflow-x-auto">
            <Table>
              <TableHeader><TableRow className="bg-sidebar"><TableHead>Application Date</TableHead><TableHead>Beneficiary</TableHead><TableHead>Security Member</TableHead><TableHead>Given Date</TableHead><TableHead>Due Date</TableHead><TableHead>Amount</TableHead><TableHead>Paid</TableHead><TableHead>Balance</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {report.loans.length === 0 ? (
                  <TableRow><TableCell colSpan={9} className="py-10 text-center text-[color:var(--text-muted)]">No VI records found</TableCell></TableRow>
                ) : report.loans.map(loan => (
                  <TableRow key={loan.id}>
                    <TableCell>{formatDate(loan.created_at)}</TableCell>
                    <TableCell>{loan.beneficiary?.name || "—"}<div className="text-xs text-[color:var(--text-muted)]">Aadhaar: {loan.beneficiary?.aadhar_number || "—"} · {loan.beneficiary?.contact || "—"}</div></TableCell>
                    <TableCell>{loan.security?.name || "—"}<div className="text-xs text-[color:var(--text-muted)]">{loan.security?.contact || ""}</div></TableCell>
                    <TableCell>{formatDate(loan.given_date)}</TableCell>
                    <TableCell>{formatDate(loan.due_date)}</TableCell>
                    <TableCell>{inr(loan.amount)}</TableCell>
                    <TableCell>{inr(loan.total_paid)}</TableCell>
                    <TableCell className="font-semibold">{inr(Math.max(0, Number(loan.amount || 0) - Number(loan.total_paid || 0)))}</TableCell>
                    <TableCell>{STATUS_LABELS[loan.status] || loan.status || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}

function Summary({ label, value }) {
  return <div className="card-earth p-4"><div className="text-xs uppercase tracking-widest text-[color:var(--text-muted)]">{label}</div><div className="mt-1 font-semibold">{value}</div></div>;
}
