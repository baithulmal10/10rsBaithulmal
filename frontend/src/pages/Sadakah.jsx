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
import { toast } from "sonner";
import { Plus, MagnifyingGlass } from "@phosphor-icons/react";
import { isStaff, useAuth } from "@/context/AuthContext";

export default function Sadakah() {
  const { user } = useAuth();
  const canDelete = isStaff(user);
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState([]);
  const [filteredRows, setFilteredRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [beneficiary, setBeneficiary] = useState(null);
  const [amount, setAmount] = useState("");
  const [purposeType, setPurposeType] = useState("medical");
  const [purposeOther, setPurposeOther] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const load = () => {
    setLoading(true);
    api.get("/sadakah").then(r => { setRows(r.data); setFilteredRows(r.data); }).finally(() => setLoading(false));
  };
  useEffect(load, []);

  const handleSearch = (query) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setFilteredRows(rows);
      return;
    }
    const lowerQuery = query.toLowerCase();
    const filtered = rows.filter(s =>
      s.beneficiary?.name?.toLowerCase().includes(lowerQuery) ||
      s.beneficiary?.contact?.includes(query) ||
      s.note?.toLowerCase().includes(lowerQuery) ||
      s.purpose_type?.toLowerCase().includes(lowerQuery) ||
      s.purpose_other?.toLowerCase().includes(lowerQuery)
    );
    setFilteredRows(filtered);
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!beneficiary) return toast.error("Select a beneficiary");
    setSaving(true);
    try {
      await api.post("/sadakah", {
        beneficiary_id: beneficiary.id,
        amount: Number(amount),
        purpose_type: purposeType,
        purpose_other: purposeOther,
        note,
      });
      toast.success("Sadakah recorded");
      setOpen(false); setBeneficiary(null); setAmount(""); setPurposeType("medical"); setPurposeOther(""); setNote(""); load();
    } catch (e) { toast.error(formatDetail(e.response?.data?.detail)); }
    finally { setSaving(false); }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    try {
      await api.delete(`/sadakah/${deleteTarget.id}`);
      toast.success("Sadakah deleted");
      setRows(current => current.filter(s => s.id !== deleteTarget.id));
      setFilteredRows(current => current.filter(s => s.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (e) { toast.error(formatDetail(e.response?.data?.detail)); }
  };

  return (
    <div data-testid="sadakah-page">
      <PageHeader
        title="Sadakah"
        subtitle="Direct charitable gifts to beneficiaries. Recorded, remembered, rewarded."
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="btn-accent-copper rounded-full px-5 py-6" data-testid="add-sadakah-btn">
                <Plus size={16} weight="bold" className="mr-2" /> Give Sadakah
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle className="font-serif text-2xl">Give Sadakah</DialogTitle></DialogHeader>
              <div className="space-y-5">
                <div>
                  <div className="text-xs uppercase tracking-widest text-copper mb-2">Step 1 · Beneficiary</div>
                  <PersonLookupForm kind="beneficiaries" hideOnFound onSaved={setBeneficiary} />
                </div>
                {beneficiary && (
                  <form onSubmit={submit} className="space-y-4 border-t border-earth pt-5">
                    <div>
                      <Label>Amount (₹)</Label>
                      <Input type="number" required min="1" value={amount} onChange={e => setAmount(e.target.value)} data-testid="sadakah-amount" />
                    </div>
                    <div>
                      <Label>Purpose Type *</Label>
                      <Select value={purposeType} onValueChange={setPurposeType}>
                        <SelectTrigger data-testid="sadakah-purpose-type"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="medical">Medical</SelectItem>
                          <SelectItem value="education">Education</SelectItem>
                          <SelectItem value="economic">Economic</SelectItem>
                          <SelectItem value="others">Others</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {purposeType === "others" && (
                      <div><Label>Purpose Details *</Label><Input required value={purposeOther} onChange={e => setPurposeOther(e.target.value)} data-testid="sadakah-purpose-other" /></div>
                    )}
                    <div>
                      <Label>Purpose / Note</Label>
                      <Textarea value={note} onChange={e => setNote(e.target.value)} data-testid="sadakah-note" />
                    </div>
                    <Button disabled={saving} className="btn-primary-moss rounded-full" data-testid="sadakah-submit">
                      {saving ? "Saving…" : "Record Sadakah"}
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
            placeholder="Search by beneficiary name, contact, note..."
            value={searchQuery}
            onChange={e => handleSearch(e.target.value)}
            data-testid="search-sadakah"
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
              <TableHead>Amount</TableHead>
              <TableHead>Purpose</TableHead>
              <TableHead>Note</TableHead>
              <TableHead>Date</TableHead>
              {canDelete && <TableHead className="text-right">Action</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? <TableRow><TableCell colSpan={canDelete ? 6 : 5} className="py-10 text-center text-[color:var(--text-muted)]">Loading…</TableCell></TableRow>
              : filteredRows.length === 0 ? <TableRow><TableCell colSpan={canDelete ? 6 : 5} className="py-10 text-center text-[color:var(--text-muted)]" >{searchQuery ? "No matching sadakah." : "No sadakah recorded yet."}</TableCell></TableRow>
              : filteredRows.map(s => (
                <TableRow key={s.id} data-testid={`sadakah-row-${s.id}`}>
                  <TableCell><div className="font-medium">{s.beneficiary?.name}</div><div className="text-xs text-[color:var(--text-muted)]">{s.beneficiary?.contact}</div></TableCell>
                  <TableCell className="font-semibold text-copper">{inr(s.amount)}</TableCell>
                  <TableCell className="text-sm">{s.purpose_type === "others" ? `Others: ${s.purpose_other}` : s.purpose_type || "—"}</TableCell>
                  <TableCell className="text-sm">{s.note || "—"}</TableCell>
                  <TableCell className="text-xs text-[color:var(--text-muted)]">{formatDate(s.created_at)}</TableCell>
                  {canDelete && <TableCell className="text-right"><Button size="sm" variant="ghost" className="text-red-600" onClick={() => setDeleteTarget(s)} data-testid={`delete-sadakah-${s.id}`}>Delete</Button></TableCell>}
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>
      <AlertDialog open={!!deleteTarget} onOpenChange={open => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete This Sadakah?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
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
