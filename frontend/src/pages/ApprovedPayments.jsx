import { useEffect, useState } from "react";
import { api, inr } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const formatDate = date => date.toISOString().slice(0, 10);

function rangeFor(value) {
  const end = new Date();
  const start = new Date(end);
  if (value === "week") start.setDate(end.getDate() - 6);
  if (value === "month") start.setMonth(end.getMonth() - 1);
  if (value === "year") start.setFullYear(end.getFullYear() - 1);
  return { date_from: formatDate(start), date_to: formatDate(end) };
}

export default function ApprovedPayments() {
  const [rows, setRows] = useState([]);
  const [collectors, setCollectors] = useState([]);
  const [period, setPeriod] = useState("month");
  const [collectorId, setCollectorId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const range = period === "custom" ? { date_from: dateFrom, date_to: dateTo } : rangeFor(period);
    const params = { ...range };
    if (collectorId) params.collector_id = collectorId;
    try {
      const [payments, users] = await Promise.all([
        api.get("/payments/approved", { params }),
        api.get("/payments/collectors"),
      ]);
      setRows(Array.isArray(payments.data) ? payments.data : []);
      setCollectors(Array.isArray(users.data) ? users.data : []);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [period, collectorId, dateFrom, dateTo]);

  const total = rows.reduce((sum, row) => sum + Number(row.total_amount || 0), 0);

  return (
    <div data-testid="approved-payments-page">
      <PageHeader title="Approved Payments" subtitle="Approved collections, grouped by collection date and user." />
      <div className="grid items-end grid-cols-1 gap-3 p-4 mb-4 card-earth md:grid-cols-4">
        <div>
          <Label>Period</Label>
          <select value={period} onChange={e => setPeriod(e.target.value)} className="flex w-full h-10 px-3 text-sm bg-white border rounded-md border-earth" data-testid="approved-period">
            <option value="week">Last Week</option>
            <option value="month">Last Month</option>
            <option value="year">Last Year</option>
            <option value="custom">Custom</option>
          </select>
        </div>
        {period === "custom" && <><div><Label>From</Label><Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} /></div><div><Label>To</Label><Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} /></div></>}
        <div>
          <Label>User</Label>
          <select value={collectorId} onChange={e => setCollectorId(e.target.value)} className="flex w-full h-10 px-3 text-sm bg-white border rounded-md border-earth" data-testid="approved-user-filter">
            <option value="">All users</option>
            {collectors.map(user => <option value={user.id} key={user.id}>{user.name}</option>)}
          </select>
        </div>
        <Button type="button" variant="outline" onClick={load}>Refresh</Button>
      </div>
      <div className="p-4 mb-4 card-earth"><span className="text-sm text-[color:var(--text-muted)]">Total approved</span><div className="text-3xl font-bold text-moss">{inr(total)}</div></div>
      <div className="overflow-x-auto card-earth">
        <Table><TableHeader><TableRow className="bg-sidebar"><TableHead>Receipt</TableHead><TableHead>Donor</TableHead><TableHead>Amount</TableHead><TableHead>Mode</TableHead><TableHead>Collected by</TableHead><TableHead>Collected date</TableHead><TableHead>From month</TableHead><TableHead>To month</TableHead></TableRow></TableHeader>
          <TableBody>{loading ? <TableRow><TableCell colSpan={8} className="py-10 text-center">Loading...</TableCell></TableRow> : rows.length === 0 ? <TableRow><TableCell colSpan={8} className="py-10 text-center">No approved payments for this period.</TableCell></TableRow> : rows.map(row => <TableRow key={row.id}><TableCell className="font-mono text-xs text-copper">{row.receipt_no}</TableCell><TableCell>{row.donor?.name}<div className="text-xs text-[color:var(--text-muted)]">{row.donor?.serial || row.donor?.contact}</div></TableCell><TableCell className="font-semibold">{inr(row.total_amount)}</TableCell><TableCell className="text-xs uppercase">{row.payment_mode === "online" ? "ONLINE PAYMENT" : "CASH"}</TableCell><TableCell>{row.added_by_name || row.collected_by_name || "—"}</TableCell><TableCell>{row.collected_date || row.collection_date || "—"}</TableCell><TableCell>{row.from_month || "—"}</TableCell><TableCell>{row.to_month || "—"}</TableCell></TableRow>)}</TableBody>
        </Table>
      </div>
    </div>
  );
}