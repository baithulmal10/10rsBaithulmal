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

export default function CollectorCollectionReport() {
  const [collectionDate, setCollectionDate] = useState(today);
  const [collectorId, setCollectorId] = useState("");
  const [collectors, setCollectors] = useState([]);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.get("/admin/users")
      .then(({ data }) => setCollectors(data.filter(user => user.role === "payment_collector" && user.is_active !== false)))
      .catch(error => toast.error(formatDetail(error.response?.data?.detail)));
  }, []);

  const applyFilter = async (date = collectionDate, collector = collectorId) => {
    if (!date) return toast.error("Select a collection date");
    setLoading(true);
    try {
      const { data } = await api.get("/reports/collector-collections", {
        params: { collection_date: date, ...(collector ? { collector_id: collector } : {}) },
      });
      setReport(data);
    } catch (error) {
      toast.error(formatDetail(error.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    const date = today();
    setCollectionDate(date);
    setCollectorId("");
    applyFilter(date, "");
  };

  const selectedCollector = collectors.find(collector => collector.id === collectorId);

  return (
    <div data-testid="collector-collection-report">
      <PageHeader title="Collector Collection Report" subtitle="Collection totals are based on actual payment records and their collected date." />

      <div className="card-earth p-4 mb-5 grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
        <div>
          <Label htmlFor="collector-report-date">Collection Date</Label>
          <Input id="collector-report-date" type="date" value={collectionDate} onChange={event => setCollectionDate(event.target.value)} data-testid="collector-report-date" />
        </div>
        <div>
          <Label htmlFor="collector-report-filter">Collector</Label>
          <select id="collector-report-filter" value={collectorId} onChange={event => setCollectorId(event.target.value)} className="flex h-10 w-full rounded-md border border-earth bg-white px-3 text-sm" data-testid="collector-report-filter">
            <option value="">All Collectors</option>
            {collectors.map(collector => <option key={collector.id} value={collector.id}>{collector.name}</option>)}
          </select>
        </div>
        <div className="flex gap-2">
          <Button type="button" onClick={() => applyFilter()} disabled={loading} className="btn-primary-moss rounded-full" data-testid="collector-report-apply">
            <ArrowClockwise size={14} className="mr-2" /> {loading ? "Loading..." : "Apply Filter"}
          </Button>
          <Button type="button" variant="outline" onClick={reset} disabled={loading} className="rounded-full" data-testid="collector-report-reset">Reset</Button>
        </div>
      </div>

      {report && (report.collections === 0 ? (
        <div className="card-earth p-8 text-center text-[color:var(--text-muted)]" data-testid="collector-report-empty">No collections found</div>
      ) : (
        <>
          <div className="card-earth p-4 mb-5">
            <div className="text-xs uppercase tracking-widest text-[color:var(--text-muted)]">Collection Date</div>
            <div className="mt-1 font-semibold">{formatDate(report.collection_date)}</div>
            {collectorId ? (
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Summary label="Collector" value={selectedCollector?.name || report.collectors[0]?.collector || "—"} />
                <Summary label="Collections" value={report.collections} />
                <Summary label="Total Collected" value={inr(report.total_amount)} />
              </div>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <Table>
                  <TableHeader><TableRow className="bg-sidebar"><TableHead>Collector</TableHead><TableHead>Collections</TableHead><TableHead>Total Collected</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {report.collectors.map((row, index) => (
                      <TableRow key={row.collector_id || `${row.collector}-${index}`}>
                        <TableCell className="font-medium">{row.collector || "—"}</TableCell>
                        <TableCell>{row.collections}</TableCell>
                        <TableCell className="font-semibold">{inr(row.total_amount)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          <div className="card-earth overflow-x-auto">
            <Table>
              <TableHeader><TableRow className="bg-sidebar"><TableHead>Collector</TableHead><TableHead>Date</TableHead><TableHead>Receipt</TableHead><TableHead>Donor</TableHead><TableHead>Amount</TableHead><TableHead>Method</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>
                {report.records.map(record => (
                  <TableRow key={record.id}>
                    <TableCell>{record.collected_by_name || "—"}</TableCell>
                    <TableCell>{formatDate(record.collected_date)}</TableCell>
                    <TableCell className="font-mono text-xs">{record.receipt_no || "—"}</TableCell>
                    <TableCell>{record.donor?.name || "—"}<div className="text-xs text-[color:var(--text-muted)]">{record.donor?.serial || record.donor?.contact || ""}</div></TableCell>
                    <TableCell className="font-semibold">{inr(record.total_amount)}</TableCell>
                    <TableCell>{record.payment_mode || "—"}</TableCell>
                    <TableCell>{record.status || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      ))}
    </div>
  );
}

function Summary({ label, value }) {
  return <div><div className="text-xs uppercase tracking-widest text-[color:var(--text-muted)]">{label}</div><div className="mt-1 font-semibold">{value}</div></div>;
}
