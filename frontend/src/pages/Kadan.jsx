import { useEffect, useState } from "react";
import { api, formatDate, inr, formatDetail } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import PersonLookupForm from "@/components/PersonLookupForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import StatusBadge from "@/components/StatusBadge";
import { toast } from "sonner";
import { Plus, MagnifyingGlass } from "@phosphor-icons/react";
import { canApproveVattiyillaFirstHead, isAccountantAdmin, isStaff, useAuth } from "@/context/AuthContext";

const CATEGORIES = ["Medical", "Education", "Economic"];
const outstanding = (loan) => Math.max(0, Number(loan.amount || 0) - Number(loan.total_paid || 0));

export default function Kadan({ variant }) {
  const { user } = useAuth();
  const isAdmin = isStaff(user);
  const canApproveFirstHead = canApproveVattiyillaFirstHead(user);
  const canApproveAdmin = isAccountantAdmin(user);
  const isVatti = variant === "vattiyilla";
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState([]);
  const [filteredRows, setFilteredRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [beneficiary, setBeneficiary] = useState(null);
  const [category, setCategory] = useState("Medical");
  const [amount, setAmount] = useState("");
  const [months, setMonths] = useState(isVatti ? 3 : 6);
  const [area, setArea] = useState("");
  const [notes, setNotes] = useState("");
  const [security, setSecurity] = useState({ name: "", father_name: "", address: "", contact: "", member_id: "" });
  const [members, setMembers] = useState([]);
  const [saving, setSaving] = useState(false);
  const [detail, setDetail] = useState(null);
  const [repayAmt, setRepayAmt] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = () => {
    setLoading(true);
    api.get("/loans", { params: { kadan_type: isVatti ? "vattiyilla" : "kadan" } })
      .then(r => { setRows(r.data); setFilteredRows(r.data); }).finally(() => setLoading(false));
  };
  useEffect(load, [isVatti]);
  useEffect(() => {
    api.get("/ymsk-members")
      .then(r => setMembers(Array.isArray(r.data) ? r.data : []))
      .catch(e => toast.error(formatDetail(e.response?.data?.detail)));
  }, []);

  const handleSearch = (query) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setFilteredRows(rows);
      return;
    }
    const lowerQuery = query.toLowerCase();
    const filtered = rows.filter(l =>
      l.beneficiary?.name?.toLowerCase().includes(lowerQuery) ||
      l.beneficiary?.contact?.includes(query) ||
      l.category?.toLowerCase().includes(lowerQuery) ||
      l.status?.toLowerCase().includes(lowerQuery)
    );
    setFilteredRows(filtered);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!beneficiary) return toast.error("Select a beneficiary");
    if (!/^\d{12}$/.test(String(beneficiary.aadhar_number || "").replace(/\D/g, ""))) return toast.error("Beneficiary must have a valid 12-digit Aadhaar");
    if (!security.member_id) return toast.error("Select a YMSK security member");
    setSaving(true);
    try {
      await api.post("/loans", {
        beneficiary_id: beneficiary.id,
        kadan_type: isVatti ? "vattiyilla" : "kadan",
        category, amount: Number(amount), repayment_months: Number(months),
        area, security, notes,
      });
      toast.success("Loan created");
      setOpen(false); load();
      setBeneficiary(null); setAmount(""); setNotes(""); setSecurity({ name: "", father_name: "", address: "", contact: "", member_id: "" });
    } catch (e) { toast.error(formatDetail(e.response?.data?.detail)); }
    finally { setSaving(false); }
  };

  const approve = async (loan, approved) => {
    const endpoint = loan.approval_stage === "first_head"
      ? `/loans/${loan.id}/first-head-approve`
      : `/loans/${loan.id}/approve`;
    try {
      await api.post(endpoint, { approve: approved, note: "" });
      toast.success(approved ? "Kadan Approved" : "Kadan Rejected");
      if (detail?.id === loan.id) setDetail(null);
      load();
    } catch (e) { toast.error(formatDetail(e.response?.data?.detail)); }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/loans/${deleteTarget.id}`);
      toast.success("Kadan Deleted");
      if (detail?.id === deleteTarget.id) setDetail(null);
      setDeleteTarget(null);
      load();
    } catch (e) { toast.error(formatDetail(e.response?.data?.detail)); }
  };

  const repay = async () => {
    const amountToPay = Number(repayAmt);
    const remaining = outstanding(detail);
    if (!Number.isFinite(amountToPay) || amountToPay <= 0) {
      return toast.error("Enter a repayment amount greater than zero");
    }
    if (amountToPay > remaining) {
      return toast.error(`Repayment cannot exceed the outstanding balance of ${inr(remaining)}`);
    }
    try {
      const { data } = await api.post(`/loans/${detail.id}/repay`, { amount: amountToPay });
      setDetail(data);
      setRepayAmt("");
      toast.success("Repayment recorded");
      load();
    } catch (e) { toast.error(formatDetail(e.response?.data?.detail)); }
  };

  const extend = async () => {
    const months = prompt("EXTEND BY HOW MANY MONTHS?", "3");
    if (!months) return;
    const note = prompt("REASON / NOTE:", "") || "";
    try {
      const { data } = await api.post(`/loans/${detail.id}/extend`, { additional_months: Number(months), note });
      setDetail(data); toast.success("Loan extended"); load();
    } catch (e) { toast.error(formatDetail(e.response?.data?.detail)); }
  };

  const block = async () => {
    const reason = prompt("REASON FOR BLOCK:");
    if (!reason) return;
    const bm = prompt("BLOCK FOR HOW MANY MONTHS?", "6");
    if (!bm) return;
    try {
      const { data } = await api.post(`/loans/${detail.id}/block`, { reason, block_months: Number(bm) });
      setDetail(data); toast.success("Beneficiary blocked"); load();
    } catch (e) { toast.error(formatDetail(e.response?.data?.detail)); }
  };

  const unblock = async () => {
    try {
      const { data } = await api.post(`/loans/${detail.id}/unblock`);
      setDetail(data); toast.success("Unblocked"); load();
    } catch (e) { toast.error(formatDetail(e.response?.data?.detail)); }
  };

  const repayAmount = Number(repayAmt);
  const repayBalance = detail ? outstanding(detail) : 0;
  const repaymentInvalid = Boolean(repayAmt) && !Number.isFinite(repayAmount);
  const repaymentExceedsBalance = Boolean(repayAmt) && Number.isFinite(repayAmount) && repayAmount > repayBalance;

  return (
    <div data-testid={`kadan-page-${variant}`}>
      <PageHeader
        title={isVatti ? "VI" : "Kadan (Loan)"}
        subtitle={isVatti ? "Interest-free short-term loans — typically 3 months, with security details." : "Community loans across Medical, Education & Economic categories with repayment tracking."}
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="btn-accent-copper rounded-full px-5 py-6" data-testid={`add-${variant}-btn`}>
                <Plus size={16} weight="bold" className="mr-2" /> New {isVatti ? "VI" : "Kadan"}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle className="font-serif text-2xl">New {isVatti ? "VI" : "Kadan"}</DialogTitle></DialogHeader>
              <div className="space-y-5">
                <div>
                  <div className="text-xs uppercase tracking-widest text-copper mb-2">Step 1 · Beneficiary</div>
                  <PersonLookupForm kind="beneficiaries" hideOnFound onSaved={setBeneficiary} />
                </div>

                {beneficiary && (
                  <form onSubmit={submit} className="space-y-5 border-t border-earth pt-5">
                    <div className="text-xs uppercase tracking-widest text-copper">Step 2 · Loan & Security</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label>Category</Label>
                        <Select value={category} onValueChange={setCategory}>
                          <SelectTrigger data-testid="loan-category"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Amount (₹)</Label>
                        <Input type="number" required min="1" value={amount} onChange={e => setAmount(e.target.value)} data-testid="loan-amount" />
                      </div>
                      <div>
                        <Label>Repayment (months)</Label>
                        <Input type="number" required min="1" value={months} onChange={e => setMonths(e.target.value)} data-testid="loan-months" />
                      </div>
                      <div>
                        <Label>Area</Label>
                        <Input value={area} onChange={e => setArea(e.target.value)} data-testid="loan-area" />
                      </div>
                    </div>

                    <div className="card-earth p-5 bg-sidebar">
                      <div className="text-sm font-semibold text-moss mb-3">Security Details</div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="md:col-span-2">
                          <Label>YMSK Security Member *</Label>
                          <Select value={security.member_id} onValueChange={memberId => {
                            const member = members.find(item => item.id === memberId);
                            setSecurity(member ? { name: member.name, father_name: member.father_name, address: member.address, contact: member.contact, member_id: member.id } : { name: "", father_name: "", address: "", contact: "", member_id: "" });
                          }}>
                            <SelectTrigger data-testid="sec-member"><SelectValue placeholder={members.length ? "Select YMSK Member" : "No YMSK Members Available"} /></SelectTrigger>
                            <SelectContent>
                              {members.map(member => <SelectItem key={member.id} value={member.id}>{member.name} · {member.contact}</SelectItem>)}
                            </SelectContent>
                          </Select>
                          {security.member_id && <div className="mt-2 text-sm">{security.name} · {security.father_name} · {security.contact}<br />{security.address}</div>}
                        </div>
                      </div>
                    </div>

                    <div>
                      <Label>Notes</Label>
                      <Textarea value={notes} onChange={e => setNotes(e.target.value)} />
                    </div>

                    <Button disabled={saving} className="btn-primary-moss rounded-full" data-testid="loan-submit">
                      {saving ? "Saving…" : "Create Loan"}
                    </Button>
                  </form>
                )}
              </div>
            </DialogContent>
          </Dialog>
        }
      />
      
      <div className="card-earth mb-4 p-4">
        <div className="flex gap-2 items-center">
          <MagnifyingGlass size={18} className="text-[color:var(--text-muted)]" />
          <Input
            placeholder="Search by beneficiary name, contact, category, status..."
            value={searchQuery}
            onChange={e => handleSearch(e.target.value)}
            data-testid="search-loans"
            className="flex-1"
          />
          {searchQuery && <span className="text-xs text-[color:var(--text-muted)]">Found: {filteredRows.length}</span>}
        </div>
      </div>

      <div className="card-earth overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-sidebar">
              <TableHead>Beneficiary</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Paid</TableHead>
              <TableHead>Balance</TableHead>
              <TableHead>Security</TableHead>
              <TableHead>Given Date</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? <TableRow><TableCell colSpan={10} className="py-10 text-center text-[color:var(--text-muted)]">Loading…</TableCell></TableRow>
              : filteredRows.length === 0 ? <TableRow><TableCell colSpan={10} className="py-10 text-center text-[color:var(--text-muted)]">No loans yet.</TableCell></TableRow>
              : filteredRows.map(l => (
                <TableRow key={l.id} data-testid={`loan-row-${l.id}`}>
                  <TableCell><div className="font-medium">{l.beneficiary?.name}</div><div className="text-xs text-[color:var(--text-muted)]">{l.beneficiary?.aadhar_number || "—"} · {l.beneficiary?.contact}</div></TableCell>
                  <TableCell>{l.category}</TableCell>
                  <TableCell className="font-semibold">{inr(l.amount)}</TableCell>
                  <TableCell>{inr(l.total_paid)}</TableCell>
                  <TableCell className="font-semibold">{inr(outstanding(l))}</TableCell>
                  <TableCell><div>{l.security?.name}</div><div className="text-xs text-[color:var(--text-muted)]">{l.security?.contact}</div></TableCell>
                  <TableCell className="text-xs">{formatDate(l.given_date || (l.status === "pending" ? null : l.created_at))}</TableCell>
                  <TableCell className="text-xs">{formatDate(l.due_date)}</TableCell>
                  <TableCell><StatusBadge status={l.status} /></TableCell>
                  <TableCell className="text-right">
                    <div className="inline-flex flex-wrap justify-end gap-1">
                      <Button size="sm" variant="outline" className="rounded-full" onClick={() => setDetail(l)} data-testid={`view-loan-${l.id}`}>{isVatti && ["active", "time_limit_exceed"].includes(l.status) ? "Collect Payment" : "Manage"}</Button>
                      {l.status === "pending" && l.approval_stage === "first_head" && canApproveFirstHead && <>
                        <Button size="sm" className="btn-primary-moss rounded-full" onClick={() => approve(l, true)} data-testid={`first-head-approve-${l.id}`}>Approve</Button>
                        <Button size="sm" variant="outline" onClick={() => approve(l, false)} data-testid={`first-head-reject-${l.id}`}>Reject</Button>
                      </>}
                      {l.status === "pending" && l.approval_stage === "admin" && canApproveAdmin && <>
                        <Button size="sm" className="btn-primary-moss rounded-full" onClick={() => approve(l, true)} data-testid={`admin-approve-${l.id}`}>Approve</Button>
                        <Button size="sm" variant="outline" onClick={() => approve(l, false)} data-testid={`admin-reject-${l.id}`}>Reject</Button>
                      </>}
                      {isAdmin && <Button size="sm" variant="ghost" className="text-red-600" onClick={() => setDeleteTarget(l)} data-testid={`delete-loan-${l.id}`}>Delete</Button>}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {detail && (
            <>
              <DialogHeader>
                <DialogTitle className="font-serif text-2xl">
                  {detail.beneficiary?.name} · {detail.category}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-5">
                <div className="flex items-center gap-3"><StatusBadge status={detail.status} />
                  <span className="text-sm text-[color:var(--text-muted)]">Given {formatDate(detail.given_date || (detail.status === "pending" ? null : detail.created_at))} · Due {formatDate(detail.due_date)}</span>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="card-earth p-4"><div className="text-[10px] uppercase tracking-widest text-[color:var(--text-muted)]">Amount</div><div className="font-serif text-2xl">{inr(detail.amount)}</div></div>
                  <div className="card-earth p-4"><div className="text-[10px] uppercase tracking-widest text-[color:var(--text-muted)]">Paid</div><div className="font-serif text-2xl text-moss">{inr(detail.total_paid)}</div></div>
                  <div className="card-earth p-4"><div className="text-[10px] uppercase tracking-widest text-[color:var(--text-muted)]">Balance</div><div className="font-serif text-2xl">{inr(outstanding(detail))}</div></div>
                  <div className="card-earth p-4"><div className="text-[10px] uppercase tracking-widest text-[color:var(--text-muted)]">Beneficiary</div><div className="font-semibold">{detail.beneficiary?.name}</div><div>Aadhaar: {detail.beneficiary?.aadhar_number || "—"}</div><div>Contact: {detail.beneficiary?.contact || "—"}</div><div>{detail.beneficiary?.address}</div></div>
                </div>

                <div className="card-earth p-4 bg-sidebar text-sm">
                  <div className="font-semibold text-moss mb-1">Security</div>
                  <div>{detail.security?.name} · {detail.security?.father_name}</div>
                  <div className="text-[color:var(--text-secondary)]">{detail.security?.address} · {detail.security?.contact}</div>
                </div>

                {detail.block_info && (
                  <div className="card-earth p-4 border-l-4 border-[#A93F35]">
                    <div className="font-semibold text-[#A93F35]">Blocked — {detail.block_info.reason}</div>
                    <div className="text-sm text-[color:var(--text-secondary)]">
                      For {detail.block_info.block_months} months · until {formatDate(detail.block_info.unblock_at)}
                    </div>
                  </div>
                )}

                {detail.status !== "blocked" && detail.status !== "closed" && (
                  <div className="card-earth p-4">
                    <div className="text-sm font-semibold mb-3">Record Repayment</div>
                    <div className="mb-2 text-xs text-[color:var(--text-muted)]">Outstanding balance: {inr(outstanding(detail))}</div>
                    <div className="flex gap-2">
                      <Input placeholder="Amount" type="number" min="0.01" max={outstanding(detail)} step="0.01" value={repayAmt} onChange={e => setRepayAmt(e.target.value)} data-testid="repay-amount" />
                      <Button className="btn-primary-moss rounded-full" onClick={repay} disabled={!repayAmt || !Number.isFinite(repayAmount) || repayAmount <= 0 || repaymentExceedsBalance} data-testid="repay-btn">Add</Button>
                    </div>
                    {repaymentInvalid && <div role="alert" className="mt-2 text-sm text-red-600">Enter a valid repayment amount.</div>}
                    {repaymentExceedsBalance && <div role="alert" className="mt-2 text-sm text-red-600">Payment cannot exceed the outstanding balance of {inr(repayBalance)}.</div>}
                  </div>
                )}

                {detail.repayments?.length > 0 && (
                  <div>
                    <div className="text-xs uppercase tracking-widest text-[color:var(--text-muted)] mb-2">Repayment history</div>
                    <ul className="space-y-1">
                      {detail.repayments.map(r => (
                        <li key={r.id} className="flex justify-between text-sm border-b border-earth py-1">
                          <span>{formatDate(r.at)}</span>
                          <span className="font-medium">{inr(r.amount)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {isAdmin && (
                  <div className="flex gap-2 flex-wrap">
                    {detail.status === "time_limit_exceed" && (
                      <Button variant="outline" onClick={extend} data-testid="extend-btn" className="rounded-full">Extend Period</Button>
                    )}
                    {detail.status !== "blocked" && (
                      <Button variant="outline" onClick={block} data-testid="block-btn" className="rounded-full border-[#A93F35] text-[#A93F35]">Block Beneficiary</Button>
                    )}
                    {detail.status === "blocked" && (
                      <Button onClick={unblock} className="btn-primary-moss rounded-full" data-testid="unblock-btn">Unblock</Button>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete This Kadan?</AlertDialogTitle>
            <AlertDialogDescription>This Action Cannot Be Undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>No</AlertDialogCancel>
            <AlertDialogAction onClick={remove}>Yes, Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
