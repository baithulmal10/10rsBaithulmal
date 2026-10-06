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

export default function BaithulmalReport() {
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
      const { data } = await api.get("/reports/baithulmal", {
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
    <div data-testid="baithulmal-report">
      <PageHeader title="10Rs Baithulmal Report" subtitle="Payment Collection records only, filtered by the actual collection date." />

      <div className="card-earth p-4 mb-5 grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
        <div><Label htmlFor="baithulmal-from">From</Label><Input id="baithulmal-from" type="date" value={dateFrom} onChange={event => setDateFrom(event.target.value)} /></div>
        <div><Label htmlFor="baithulmal-to">To</Label><Input id="baithulmal-to" type="date" value={dateTo} onChange={event => setDateTo(event.target.value)} /></div>
        <div>
          <Label htmlFor="baithulmal-status">Payment Status</Label>
          <select id="baithulmal-status" value={status} onChange={event => setStatus(event.target.value)} className="flex h-10 w-full rounded-md border border-earth bg-white px-3 text-sm">
            <option value="all">All Statuses</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option>
          </select>
        </div>
        <div className="flex gap-2">
          <Button type="button" onClick={() => applyFilter()} disabled={loading} className="btn-primary-moss rounded-full"><ArrowClockwise size={14} className="mr-2" />{loading ? "Loading..." : "Apply Filter"}</Button>
          <Button type="button" variant="outline" onClick={reset} disabled={loading} className="rounded-full">Reset</Button>
        </div>
      </div>

      {report && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
            <Summary label="Collection Count" value={report.collections} />
            <Summary label="Total Amount" value={inr(report.total_amount)} />
            <Summary label="Date Range" value={`${formatDate(report.date_from)} – ${formatDate(report.date_to)}`} />
          </div>
          <div className="card-earth overflow-x-auto">
            <Table>
              <TableHeader><TableRow className="bg-sidebar"><TableHead>Collection Date</TableHead><TableHead>Receipt</TableHead><TableHead>Donor</TableHead><TableHead>Collector</TableHead><TableHead>Period</TableHead><TableHead>Method</TableHead><TableHead>Status</TableHead><TableHead>Amount</TableHead></TableRow></TableHeader>
              <TableBody>
                {report.records.length === 0 ? (
                  <TableRow><TableCell colSpan={8} className="py-10 text-center text-[color:var(--text-muted)]">No collections found</TableCell></TableRow>
                ) : report.records.map(record => (
                  <TableRow key={record.id}>
                    <TableCell>{formatDate(record.collected_date)}</TableCell>
                    <TableCell className="font-mono text-xs">{record.receipt_no || "—"}</TableCell>
                    <TableCell>{record.donor?.name || "—"}<div className="text-xs text-[color:var(--text-muted)]">{record.donor?.serial || record.donor?.contact || ""}</div></TableCell>
                    <TableCell>{record.collected_by_name || "—"}</TableCell>
                    <TableCell>{record.from_month || "—"} – {record.to_month || "—"}</TableCell>
                    <TableCell>{record.payment_mode || "—"}</TableCell>
                    <TableCell>{record.status || "—"}</TableCell>
                    <TableCell className="font-semibold">{inr(record.total_amount)}</TableCell>
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
