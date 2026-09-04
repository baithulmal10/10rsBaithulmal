import { useCallback, useEffect, useState } from "react";
import { api, inr, formatDetail } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import PersonLookupForm from "@/components/PersonLookupForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import StatusBadge from "@/components/StatusBadge";
import { toast } from "sonner";
import { Plus, Receipt as ReceiptIcon, WhatsappLogo, MagnifyingGlass } from "@phosphor-icons/react";
import { canApprovePayments, isCollector, isStaff, useAuth } from "@/context/AuthContext";
import { generatePdf, downloadPdf, shareWhatsApp } from "@/lib/pdf";

export default function Payments() {
  const { user } = useAuth();
  const canApprove = canApprovePayments(user);
  const canDelete = isStaff(user);
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState([]);
  const [filteredRows, setFilteredRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [donor, setDonor] = useState(null);
  const today = new Date().toISOString().slice(0, 10);
  const [dateFrom, setDateFrom] = useState(today);
  const [dateTo, setDateTo] = useState(today);
  const [amount, setAmount] = useState(10);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const formatDateRange = useCallback((p) => {
    const from = p.date_from || p.collection_date || "";
    const to = p.date_to || from;
    if (!from && !to) return "—";
    return from === to ? from : `${from} → ${to}`;
  }, []);

  const isPendingStatus = (status) => {
    const value = String(status || "").trim().toLowerCase();
    return value === "pending" || value === "in_review" || value === "in review" || value === "review";
  };

  const applySearch = useCallback((records, query) => {
    if (!query.trim()) return records;
    const lowerQuery = query.toLowerCase();
    return records.filter(p =>
      p.receipt_no?.toLowerCase().includes(lowerQuery) ||
      p.donor?.name?.toLowerCase().includes(lowerQuery) ||
      p.donor?.contact?.includes(query) ||
      p.collected_by_name?.toLowerCase().includes(lowerQuery) ||
      p.status?.toLowerCase().includes(lowerQuery) ||
      (p.date_from || p.date_to || p.collection_date || "").toLowerCase().includes(lowerQuery) ||
      formatDateRange(p).toLowerCase().includes(lowerQuery)
    );
  }, [formatDateRange]);

  const load = useCallback(async (showLoader = false) => {
    if (showLoader || rows.length === 0) setLoading(true);
    const params = {};
    if (filterFrom) params.date_from = filterFrom;
    if (filterTo) params.date_to = filterTo;
    try {
      const r = await api.get("/payments", { params });
      const nextRows = Array.isArray(r.data) ? r.data : [];
      setRows(nextRows);
      setFilteredRows(applySearch(nextRows, searchQuery));
    } finally {
      setLoading(false);
    }
  }, [applySearch, filterFrom, filterTo, rows.length, searchQuery]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(true); }, [filterFrom, filterTo]);

  const handleSearch = (query) => {
    setSearchQuery(query);
    setFilteredRows(applySearch(rows, query));
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!donor || !donor.id) return toast.error("Select a donor first");
    if (dateTo && dateFrom && dateTo < dateFrom) {
      toast.error("To date must be on or after the from date.");
      return;
    }
    setSaving(true);
    try {
      const from = dateFrom || today;
      const to = dateTo || from;
      const payload = {
        donor_id: donor.id,
        date_from: from,
        date_to: to,
        collection_date: from,
        amount: Number(amount),
        note,
      };
      const { data } = await api.post("/payments", payload);
      toast.success(`Receipt ${data.receipt_no} · ${inr(data.total_amount)} · Pending review`);
      setOpen(false); setDonor(null); setNote(""); setDateFrom(today); setDateTo(today); load();
    } catch (e) { toast.error(formatDetail(e.response?.data?.detail)); }
    finally { setSaving(false); }
  };

  const approve = async (id, ok) => {
    try {
      await api.post(`/payments/${id}/approve`, { approve: ok, note: "" });
      toast.success(ok ? "Approved" : "Rejected");
      load();
    } catch (e) { toast.error(formatDetail(e.response?.data?.detail)); }
  };

  const receipt = (p) => {
    const doc = generatePdf({
      title: `Donation Receipt · ${p.receipt_no}`,
      subtitle: `Donor: ${p.donor.name} (${p.donor.serial}) · ${p.donor.contact}`,
      sections: [{
        heading: "Payment Details",
        columns: ["Date Range", "Amount"],
        rows: [[formatDateRange(p), inr(p.total_amount)]],
        total: p.total_amount,
      }],
    });
    downloadPdf(doc, `${p.receipt_no}.pdf`);
  };

  const whatsappShare = (p) => {
    const msg = `10Rs Baithulmal Receipt #${p.receipt_no}\nDonor: ${p.donor.name}\nDate: ${formatDateRange(p)}\nTotal: ${inr(p.total_amount)}\n*ஜஸாகல்லாஹ் ஹைரன்* 

10ரூபாய் பைத்துல்மாலுக்கு நிதி உதவி செய்த தங்ங்களுக்கும், உங்களுடைய குடும்பத்தார்கள்  மற்றும் முன்னோர்கள் அனைவர்களுக்கும் *அல்லாஹுத்தஆலா* இம்மை,மறுமை ஈருலகத்திலும் வெற்றியை தந்தருள்வானாக...

 உங்ககளுடைய *பொருளாதாரத்தில், வியாபாரத்தில் பரக்கத் செய்வானாக* ...

 ஜென்னத்துல் பிரதௌஸ் என்னும் உயரிய சொர்க்கத்தை உங்களுக்கும், உங்களுடைய மனைவி, பிள்ளைகள், உங்களுடைய உறவினர்கள், சந்ததியினர் மற்றும் முன்னோர்கள் அனைவருக்கும் தந்தருள்வானாக...

 *ஆமீன்*`;
    shareWhatsApp(msg);
  };

  return (
    <div data-testid="payments-page">
      <PageHeader
        title={isCollector(user) ? "My Collections" : "Payment Collection"}
        subtitle={isCollector(user)
          ? "Record collections and review only your own history."
          : "Record donations against a date range; they stay pending until approval."}
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="px-5 py-6 rounded-full btn-accent-copper" data-testid="add-payment-btn">
                <Plus size={16} weight="bold" className="mr-2" /> Collect Payment
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle className="font-serif text-2xl">Collect Payment</DialogTitle></DialogHeader>
              <div className="space-y-5">
                <div>
                  <div className="mb-2 text-xs tracking-widest uppercase text-copper">Step 1 · Find Donor</div>
                  <PersonLookupForm kind="donors" hideOnFound onSaved={setDonor} allowCreate={!isCollector(user)} />
                </div>
                {donor && (
                  <form onSubmit={submit} className="pt-5 space-y-4 border-t border-earth">
                    <div className="text-xs tracking-widest uppercase text-copper">Step 2 · Payment Details</div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <Label>From Date</Label>
                        <Input type="date" required value={dateFrom} onChange={e => setDateFrom(e.target.value)} data-testid="pay-date-from" />
                      </div>
                      <div>
                        <Label>To Date</Label>
                        <Input type="date" required value={dateTo} onChange={e => setDateTo(e.target.value)} data-testid="pay-date-to" />
                      </div>
                    </div>
                    <div>
                      <Label>₹ Total Amount</Label>
                      <Input type="number" min="1" value={amount} onChange={e => setAmount(e.target.value)} data-testid="pay-amount" />
                    </div>
                    <div>
                      <Label>Note (optional)</Label>
                      <Input value={note} onChange={e => setNote(e.target.value)} data-testid="pay-note" />
                    </div>
                    <Button disabled={saving} className="rounded-full btn-primary-moss" data-testid="pay-submit">
                      {saving ? "Saving…" : "Record Payment"}
                    </Button>
                  </form>
                )}
              </div>
            </DialogContent>
          </Dialog>
        }
      />

      <div className="p-4 mb-4 card-earth">
        <div className="flex flex-col gap-3 md:flex-row md:items-end">
          <div className="flex items-center flex-1 gap-2">
            <MagnifyingGlass size={18} className="text-[color:var(--text-muted)]" />
            <Input
              placeholder="Search by receipt, donor name, contact, collector..."
              value={searchQuery}
              onChange={e => handleSearch(e.target.value)}
              data-testid="search-payments"
              className="flex-1"
            />
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div>
              <Label className="text-xs">From</Label>
              <Input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)} data-testid="filter-date-from" />
            </div>
            <div>
              <Label className="text-xs">To</Label>
              <Input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)} data-testid="filter-date-to" />
            </div>
            {(filterFrom || filterTo) && (
              <Button type="button" variant="outline" className="mt-5 rounded-full" onClick={() => { setFilterFrom(""); setFilterTo(""); }}>Clear dates</Button>
            )}
          </div>
          {searchQuery && <span className="text-xs text-[color:var(--text-muted)]">Found: {filteredRows.length}</span>}
        </div>
      </div>

      <div className="overflow-x-auto card-earth">
        <Table>
          <TableHeader>
            <TableRow className="bg-sidebar">
              <TableHead>Receipt</TableHead>
              <TableHead>Donor</TableHead>
              <TableHead>From</TableHead>
              <TableHead>To</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Collected by</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? <TableRow><TableCell colSpan={7} className="text-center py-10 text-[color:var(--text-muted)]">Loading…</TableCell></TableRow>
              : filteredRows.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center py-10 text-[color:var(--text-muted)]">{searchQuery ? "No matching payments." : "No payments yet."}</TableCell></TableRow>
              : filteredRows.map(p => (
                <TableRow key={p.id} data-testid={`payment-row-${p.id}`}>
                  <TableCell className="font-mono text-xs text-copper">{p.receipt_no}</TableCell>
                  <TableCell><div className="font-medium">{p.donor?.name}</div><div className="text-xs text-[color:var(--text-muted)]">{p.donor?.contact}</div></TableCell>
                  <TableCell className="text-sm">{p.date_from || p.collection_date || "—"}</TableCell>
                  <TableCell className="text-sm">{p.date_to || p.date_from || p.collection_date || "—"}</TableCell>
                  <TableCell className="font-semibold">{inr(p.total_amount)}</TableCell>
                  <TableCell className="text-sm">{p.collected_by_name || "—"}</TableCell>
                  <TableCell><StatusBadge status={p.status} /></TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => receipt(p)} data-testid={`pdf-${p.id}`}><ReceiptIcon size={14} weight="duotone" /></Button>
                      <Button size="sm" variant="ghost" onClick={() => whatsappShare(p)} data-testid={`whatsapp-${p.id}`}><WhatsappLogo size={14} weight="duotone" /></Button>
                      {canApprove && isPendingStatus(p.status) && (
                        <>
                          <Button size="sm" className="text-xs rounded-full btn-primary-moss" onClick={() => approve(p.id, true)} data-testid={`approve-${p.id}`}>Approve</Button>
                          <Button size="sm" variant="outline" onClick={() => approve(p.id, false)} data-testid={`reject-${p.id}`}>Reject</Button>
                        </>
                      )}
                      {canDelete && (
                        <Button size="sm" variant="ghost" className="text-red-600" onClick={() => api.delete(`/payments/${p.id}`).then(() => load()).catch(e => toast.error(formatDetail(e.response?.data?.detail)))} data-testid={`delete-payment-${p.id}`}>Delete</Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
