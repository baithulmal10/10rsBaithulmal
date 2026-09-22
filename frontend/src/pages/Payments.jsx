import { useCallback, useEffect, useRef, useState } from "react";
import jsPDF from "jspdf";
import html2canvas from "html2canvas";
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
import { shareWhatsApp } from "@/lib/pdf";
import ReceiptTemplate from "@/pages/Image";

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
  const currentMonth = today.slice(0, 7);
  const [dateFrom, setDateFrom] = useState(currentMonth);
  const [dateTo, setDateTo] = useState(currentMonth);
  const [collectedDate, setCollectedDate] = useState(today);
  const [amount, setAmount] = useState(300);
  const [donors, setDonors] = useState([]);
  const [showDonors, setShowDonors] = useState(false);
  const [paymentMode, setPaymentMode] = useState("cash");
  const [collectorId, setCollectorId] = useState("");
  const [collectors, setCollectors] = useState([]);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [receiptPayment, setReceiptPayment] = useState(null);
  const receiptRef = useRef(null);

  const monthStart = (month) => `${month}-01`;
  const monthEnd = (month) => {
    const [year, value] = month.split("-").map(Number);
    return new Date(Date.UTC(year, value, 0)).toISOString().slice(0, 10);
  };

  const chooseDonor = (selectedDonor) => {
    setDonor(selectedDonor);
    setShowDonors(false);
  };

  useEffect(() => {
    api.get("/payments/collectors", { params: { status: "pending" } }).then(r => setCollectors(Array.isArray(r.data) ? r.data : [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (!receiptPayment || !receiptRef.current) return undefined;
    let cancelled = false;
    const exportReceipt = async () => {
      try {
        if (document.fonts?.ready) await document.fonts.ready;
        const canvas = await html2canvas(receiptRef.current.querySelector(".receipt"), { scale: 2, useCORS: true, backgroundColor: "#f8fff8" });
        if (cancelled) return;
        const doc = new jsPDF({ unit: "pt", format: "a4" });
        doc.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", 0, 0, doc.internal.pageSize.getWidth(), doc.internal.pageSize.getHeight());
        doc.save(`${receiptPayment.receipt_no}.pdf`);
      } catch (error) {
        toast.error("Could not generate the receipt.");
      } finally {
        if (!cancelled) setReceiptPayment(null);
      }
    };
    exportReceipt();
    return () => { cancelled = true; };
  }, [receiptPayment]);

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
    if (collectorId) params.collector_id = collectorId;
    params.status = "pending";
    try {
      const r = await api.get("/payments", { params });
      const nextRows = Array.isArray(r.data) ? r.data : [];
      setRows(nextRows);
      setFilteredRows(applySearch(nextRows, searchQuery));
    } finally {
      setLoading(false);
    }
  }, [applySearch, collectorId, filterFrom, filterTo, rows.length, searchQuery]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(true); }, [filterFrom, filterTo, collectorId]);

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
      const fromMonth = dateFrom || currentMonth;
      const toMonth = dateTo || fromMonth;
      const payload = {
        donor_id: donor.id,
        date_from: monthStart(fromMonth),
        date_to: monthEnd(toMonth),
        from_month: fromMonth,
        to_month: toMonth,
        collection_date: collectedDate || today,
        collected_date: collectedDate || today,
        amount: Number(amount),
        payment_mode: paymentMode,
        note,
      };
      const { data } = await api.post("/payments", payload);
      toast.success(`Receipt ${data.receipt_no} · ${inr(data.total_amount)} · Pending review`);
      setOpen(false); setDonor(null); setNote(""); setPaymentMode("cash"); setDateFrom(currentMonth); setDateTo(currentMonth); setCollectedDate(today); setAmount(300); load();
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
    setReceiptPayment(p);
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
        title={isCollector(user) ? "Payment Collection" : "Payment Collection"}
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
                  <PersonLookupForm kind="donors" hideOnFound onSaved={setDonor} allowCreate={!isCollector(user)} searchMode />
                  <Button type="button" variant="outline" className="mt-3 rounded-full" onClick={async () => { try { const { data } = await api.get("/people/donors"); setDonors(data); setShowDonors(true); } catch (e) { toast.error(formatDetail(e.response?.data?.detail)); } }} data-testid="pay-donor-list-btn">
                    Pay · Select Donor
                  </Button>
                  {showDonors && (
                    <div className="grid gap-2 mt-3 overflow-y-auto max-h-56">
                      {donors.map(d => <button type="button" key={d.id} onClick={() => chooseDonor(d)} className="p-3 text-left border rounded-lg border-earth hover:bg-sidebar" data-testid={`pay-donor-${d.id}`}>
                        <span className="font-medium">{d.name}</span><span className="block text-xs text-[color:var(--text-muted)]">{d.serial} · {d.contact}</span>
                      </button>)}
                      {donors.length === 0 && <div className="p-3 text-sm text-[color:var(--text-muted)]">No donors found.</div>}
                    </div>
                  )}
                </div>
                {donor && (
                  <form onSubmit={submit} className="pt-5 space-y-4 border-t border-earth">
                    <div className="text-xs tracking-widest uppercase text-copper">Step 2 · Payment Details</div>
                    <div className="grid grid-cols-1 gap-3 p-3 text-sm rounded-lg bg-sidebar md:grid-cols-2">
                      <div><span className="font-medium">Donor Name:</span> {donor.name}</div>
                      <div><span className="font-medium">Donor Number:</span> {donor.serial || donor.contact}</div>
                    </div>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <div>
                        <Label>From Month</Label>
                        <Input type="month" required value={dateFrom} onChange={e => setDateFrom(e.target.value)} data-testid="pay-month-from" />
                      </div>
                      <div>
                        <Label>To Month</Label>
                        <Input type="month" required value={dateTo} onChange={e => setDateTo(e.target.value)} data-testid="pay-month-to" />
                      </div>
                    </div>
                    <div>
                      <Label>₹ Total Amount</Label>
                      <Input type="number" min="1" value={amount} onChange={e => setAmount(e.target.value)} data-testid="pay-amount" />
                    </div>
                    <div>
                      <Label>Mode of Payment</Label>
                      <select value={paymentMode} onChange={e => setPaymentMode(e.target.value)} className="flex w-full h-10 px-3 text-sm bg-white border rounded-md border-earth" data-testid="pay-mode">
                        <option value="cash">CASH</option>
                        <option value="online">ONLINE PAYMENT</option>
                      </select>
                    </div>
                    <div>
                      <Label>Collected Date</Label>
                      <Input type="date" required value={collectedDate} onChange={e => setCollectedDate(e.target.value)} data-testid="pay-collected-date" />
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
          <div className="flex items-center gap-2 text-sm">
            <Label className="whitespace-nowrap">Collected by</Label>
            <select value={collectorId} onChange={e => setCollectorId(e.target.value)} className="h-10 px-3 bg-white border rounded-md border-earth" data-testid="payment-user-filter">
              <option value="">All users</option>
              {collectors.map(c => <option key={c.id} value={c.id}>{c.name} · {inr(c.total)}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto card-earth">
        <Table>
          <TableHeader>
            <TableRow className="bg-sidebar">
              <TableHead>Receipt</TableHead>
              <TableHead>Donor</TableHead>
              <TableHead>From Month</TableHead>
              <TableHead>To Month</TableHead>
              <TableHead>Total</TableHead>
              <TableHead>Mode</TableHead>
              <TableHead>Payment Added By</TableHead>
              <TableHead>Collected Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? <TableRow><TableCell colSpan={10} className="text-center py-10 text-[color:var(--text-muted)]">Loading…</TableCell></TableRow>
              : filteredRows.length === 0 ? <TableRow><TableCell colSpan={10} className="text-center py-10 text-[color:var(--text-muted)]">{searchQuery ? "No matching payments." : "No payments yet."}</TableCell></TableRow>
              : filteredRows.map(p => (
                <TableRow key={p.id} data-testid={`payment-row-${p.id}`}>
                  <TableCell className="font-mono text-xs text-copper">{p.receipt_no}</TableCell>
                  <TableCell><div className="font-medium">{p.donor?.name}</div><div className="text-xs text-[color:var(--text-muted)]">{p.donor?.contact}</div></TableCell>
                  <TableCell className="text-sm">{p.from_month || (p.date_from || p.collection_date || "—").slice(0, 7)}</TableCell>
                  <TableCell className="text-sm">{p.to_month || (p.date_to || p.date_from || p.collection_date || "—").slice(0, 7)}</TableCell>
                  <TableCell className="font-semibold">{inr(p.total_amount)}</TableCell>
                  <TableCell className="text-xs uppercase">{p.payment_mode === "online" ? "ONLINE PAYMENT" : "CASH"}</TableCell>
                  <TableCell className="text-sm">{p.added_by_name || p.collected_by_name || "—"}</TableCell>
                  <TableCell className="text-sm">{p.collected_date || p.collection_date || "—"}</TableCell>
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
      {receiptPayment && (
        <div ref={receiptRef} style={{ position: "fixed", left: "-1100px", top: 0, width: "1024px", zIndex: -1 }} aria-hidden="true">
          <ReceiptTemplate
            receiptNo={receiptPayment.receipt_no}
            donor={receiptPayment.donor?.name}
            paymentDate={receiptPayment.collected_date || receiptPayment.collection_date}
            forMonth={`${receiptPayment.from_month || (receiptPayment.date_from || "").slice(0, 7)} to ${receiptPayment.to_month || (receiptPayment.date_to || "").slice(0, 7)}`}
            amount={Number(receiptPayment.total_amount || 0).toLocaleString("en-IN")}
          />
        </div>
      )}
    </div>
  );
}
