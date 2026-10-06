import { useEffect, useState } from "react";
import { api, formatDate, inr, formatDetail } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { generatePdf, downloadPdf, shareWhatsApp } from "@/lib/pdf";
import { FilePdf, WhatsappLogo, ArrowClockwise } from "@phosphor-icons/react";

export default function Reports() {
  const [range, setRange] = useState("monthly");
  const [start, setStart] = useState(new Date().toISOString().slice(0, 10));
  const [end, setEnd] = useState(new Date().toISOString().slice(0, 10));
  const [donorId, setDonorId] = useState("");
  const [donors, setDonors] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { api.get("/people/donors").then(r => setDonors(r.data)); }, []);

  const run = async () => {
    setLoading(true);
    try {
      const params = { range };
      if (range === "custom") { params.start = start; params.end = end; }
      if (range === "individual") { params.donor_id = donorId; }
      const { data } = await api.get("/reports", { params });
      setData(data);
    } catch (e) { toast.error(formatDetail(e.response?.data?.detail)); }
    finally { setLoading(false); }
  };

  useEffect(() => { run(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const buildPdf = () => {
    if (!data) return null;
    if (range === "individual") {
      return generatePdf({
        title: `Individual Donor Report`,
        subtitle: `${data.donor?.name || ""} · ${data.donor?.contact || ""}`,
        sections: [{
          heading: "Payments",
          columns: ["Receipt", "Collection Date", "Amount"],
          rows: data.payments.map(p => [p.receipt_no, formatDate(p.collection_date), inr(p.total_amount)]),
          total: data.total,
        }],
      });
    }
    return generatePdf({
      title: `${range.charAt(0).toUpperCase() + range.slice(1)} Report`,
      subtitle: `${formatDate(data.start)} → ${formatDate(data.end)}`,
      sections: [
        {
          heading: "Payments (Approved)",
          columns: ["Date", "Receipt", "Donor", "Total"],
          rows: data.payments.map(p => [formatDate(p.created_at), p.receipt_no, p.donor?.name || "", inr(p.total_amount)]),
          total: data.totals.income,
        },
        {
          heading: "Expenses",
          columns: ["Date", "Kind", "Detail", "Amount"],
          rows: data.expenses.map(e => [formatDate(e.created_at), e.kind, e.kind === "salary" ? e.worker?.name || "" : e.category, inr(e.amount)]),
          total: data.totals.expense,
        },
        {
          heading: "Sadakah",
          columns: ["Date", "Beneficiary", "Amount"],
          rows: data.sadakah.map(s => [formatDate(s.created_at), s.beneficiary?.name || "", inr(s.amount)]),
          total: data.totals.sadakah,
        },
        {
          heading: "Loans Issued",
          columns: ["Date", "Beneficiary", "Category", "Amount"],
          rows: data.loans.map(l => [formatDate(l.created_at), l.beneficiary?.name || "", l.category, inr(l.amount)]),
        },
      ],
    });
  };

  const doDownload = () => { const d = buildPdf(); if (d) downloadPdf(d, `baithulmal-${range}.pdf`); };
  const doWhatsapp = () => {
    if (!data) return;
    if (range === "individual") {
      shareWhatsApp(`Donor Report: ${data.donor?.name}\nTotal contributed: ${inr(data.total)}`.toLocaleUpperCase());
    } else {
      const t = data.totals;
      shareWhatsApp(`10Rs Baithulmal — ${range} report\nIncome: ${inr(t.income)}\nExpenses: ${inr(t.expense)}\nSadakah: ${inr(t.sadakah)}\nNet: ${inr(t.net)}`.toLocaleUpperCase());
    }
  };

  return (
    <div data-testid="reports-page">
      <PageHeader
        title="Reports"
        subtitle="Daily, monthly, yearly summaries · individual donor reports · print as PDF or share via WhatsApp."
      />

      <div className="card-earth p-6 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4 items-end">
          <div>
            <Label>Range</Label>
            <Select value={range} onValueChange={setRange}>
              <SelectTrigger data-testid="report-range"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="yearly">Yearly</SelectItem>
                <SelectItem value="custom">Custom (from-to)</SelectItem>
                <SelectItem value="individual">Individual Donor</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {range === "custom" && (
            <>
              <div><Label>From</Label><Input type="date" value={start} onChange={e => setStart(e.target.value)} data-testid="report-from" /></div>
              <div><Label>To</Label><Input type="date" value={end} onChange={e => setEnd(e.target.value)} data-testid="report-to" /></div>
            </>
          )}
          {range === "individual" && (
            <div className="md:col-span-2">
              <Label>Donor</Label>
              <Select value={donorId} onValueChange={setDonorId}>
                <SelectTrigger data-testid="report-donor"><SelectValue placeholder="Select donor" /></SelectTrigger>
                <SelectContent>
                  {donors.map(d => <SelectItem key={d.id} value={d.id}>{d.name} · {d.contact}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex gap-2">
            <Button onClick={run} disabled={loading} className="btn-primary-moss rounded-full" data-testid="report-run">
              <ArrowClockwise size={14} className="mr-2" /> {loading ? "Loading…" : "Run"}
            </Button>
          </div>
        </div>
      </div>

      {data && (
        <>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h2 className="font-serif text-3xl font-semibold">
                {range === "individual" ? `Report · ${data.donor?.name || ""}` : `${range.charAt(0).toUpperCase() + range.slice(1)} Report`}
              </h2>
              {range !== "individual" && <div className="text-sm text-[color:var(--text-secondary)]">{formatDate(data.start)} → {formatDate(data.end)}</div>}
            </div>
            <div className="flex gap-2">
              <Button onClick={doDownload} className="btn-accent-copper rounded-full" data-testid="report-pdf"><FilePdf size={14} weight="duotone" className="mr-2" /> PDF</Button>
              <Button onClick={doWhatsapp} variant="outline" className="rounded-full" data-testid="report-whatsapp"><WhatsappLogo size={14} weight="duotone" className="mr-2" /> WhatsApp</Button>
            </div>
          </div>

          {range === "individual" ? (
            <div className="card-earth p-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div><div className="text-xs uppercase text-[color:var(--text-muted)] tracking-widest">Donor</div><div className="font-medium mt-1">{data.donor?.name}</div></div>
                <div><div className="text-xs uppercase text-[color:var(--text-muted)] tracking-widest">Contact</div><div className="font-medium mt-1">{data.donor?.contact}</div></div>
                <div><div className="text-xs uppercase text-[color:var(--text-muted)] tracking-widest">Payments</div><div className="font-medium mt-1">{data.payments.length}</div></div>
                <div><div className="text-xs uppercase text-[color:var(--text-muted)] tracking-widest">Total</div><div className="font-serif text-2xl text-copper mt-1">{inr(data.total)}</div></div>
              </div>
              <Table className="mt-6">
                <TableHeader><TableRow className="bg-sidebar"><TableHead>Receipt</TableHead><TableHead>Collection Date</TableHead><TableHead>Amount</TableHead></TableRow></TableHeader>
                <TableBody>
                  {data.payments.map(p => (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-xs text-copper">{p.receipt_no}</TableCell>
                      <TableCell>{formatDate(p.collection_date)}</TableCell>
                      <TableCell className="font-semibold">{inr(p.total_amount)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-5">
              <SummaryCard label="Income" value={inr(data.totals.income)} tone="moss" />
              <SummaryCard label="Expenses" value={inr(data.totals.expense)} tone="copper" />
              <SummaryCard label="Sadakah" value={inr(data.totals.sadakah)} tone="copper" />
              <SummaryCard label="Net" value={inr(data.totals.net)} tone="moss" />
            </div>
          )}
        </>
      )}
    </div>
  );
}

const SummaryCard = ({ label, value, tone }) => (
  <div className="card-earth p-6">
    <div className="text-xs uppercase tracking-widest text-[color:var(--text-muted)]">{label}</div>
    <div className={`font-serif text-3xl font-semibold mt-1 ${tone === "copper" ? "text-copper" : "text-moss"}`}>{value}</div>
  </div>
);
