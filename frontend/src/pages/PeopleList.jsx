import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import PersonLookupForm from "@/components/PersonLookupForm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, MagnifyingGlass, Pencil } from "@phosphor-icons/react";
import { isAccountantAdmin, isStaff, useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import { formatDetail } from "@/lib/api";

const singular = { donors: "donor", beneficiaries: "beneficiary", workers: "worker" };

export default function PeopleList({ kind, title, subtitle }) {
  const noun = singular[kind] || kind;
  const [items, setItems] = useState([]);
  const [filteredItems, setFilteredItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [editing, setEditing] = useState(null);
  const [editForm, setEditForm] = useState(null);
  const [editSaving, setEditSaving] = useState(false);
  const { user } = useAuth();

  const load = () => {
    setLoading(true);
    api.get(`/people/${kind}`).then(r => { setItems(r.data); setFilteredItems(r.data); }).finally(() => setLoading(false));
  };
  useEffect(load, [kind]);

  const handleSearch = (query) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setFilteredItems(items);
      return;
    }
    const lowerQuery = query.toLowerCase();
    const filtered = items.filter(i =>
      i.name?.toLowerCase().includes(lowerQuery) ||
      i.contact?.includes(query) ||
      i.father_name?.toLowerCase().includes(lowerQuery) ||
      i.reference?.toLowerCase().includes(lowerQuery) ||
      i.aadhar_number?.includes(query) ||
      i.serial?.toLowerCase().includes(lowerQuery) ||
      i.address?.toLowerCase().includes(lowerQuery) ||
      i.area?.toLowerCase().includes(lowerQuery)
    );
    setFilteredItems(filtered);
  };

  const remove = async (id) => {
    if (!window.confirm("Delete this record?")) return;
    try {
      await api.delete(`/people/${kind}/${id}`);
      toast.success("Deleted");
      load();
    } catch (e) { toast.error(formatDetail(e.response?.data?.detail)); }
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    setEditSaving(true);
    try {
      await api.patch(`/people/${kind}/${editing.id}`, editForm);
      toast.success("Updated");
      setEditing(null);
      load();
    } catch (e) { toast.error(formatDetail(e.response?.data?.detail)); }
    finally { setEditSaving(false); }
  };

  return (
    <div data-testid={`people-${kind}`}>
      <PageHeader
        title={title}
        subtitle={subtitle}
        action={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="btn-accent-copper rounded-full px-5 py-6" data-testid={`add-${kind}-btn`}>
                <Plus size={16} weight="bold" className="mr-2" /> Add {noun}
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle className="font-serif text-2xl">Register {noun}</DialogTitle></DialogHeader>
              <PersonLookupForm kind={kind} onSaved={() => { setOpen(false); load(); }} />
            </DialogContent>
          </Dialog>
        }
      />

      <div className="card-earth mb-4 p-4">
        <div className="flex gap-2 items-center">
          <MagnifyingGlass size={18} className="text-[color:var(--text-muted)]" />
          <Input
            placeholder={`Search by name, contact, reference, ID...`}
            value={searchQuery}
            onChange={e => handleSearch(e.target.value)}
            data-testid="search-bar"
            className="flex-1"
          />
          {searchQuery && <span className="text-xs text-[color:var(--text-muted)]">Found: {filteredItems.length}</span>}
        </div>
      </div>

      <div className="card-earth overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-sidebar">
              <TableHead className="w-24">ID</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Father&apos;s Name</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead>Aadhar</TableHead>
              <TableHead>Address</TableHead>
              <TableHead>Area</TableHead>
              {(isAccountantAdmin(user) || (kind === "donors" && isStaff(user))) && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={9} className="text-center text-[color:var(--text-muted)] py-10">Loading…</TableCell></TableRow>
            ) : filteredItems.length === 0 ? (
              <TableRow><TableCell colSpan={9} className="text-center text-[color:var(--text-muted)] py-10">{searchQuery ? "No matching records." : "No records yet."}</TableCell></TableRow>
            ) : filteredItems.map(i => (
              <TableRow key={i.id} data-testid={`row-${i.id}`}>
                <TableCell className="font-mono text-xs text-copper">{i.serial}</TableCell>
                <TableCell className="font-medium">{i.name}</TableCell>
                <TableCell>{i.father_name}</TableCell>
                <TableCell>{i.contact}</TableCell>
                <TableCell>{i.reference || "—"}</TableCell>
                <TableCell>{i.aadhar_number || "—"}</TableCell>
                <TableCell className="max-w-xs truncate">{i.address}</TableCell>
                <TableCell>{i.area || "—"}</TableCell>
                {(isAccountantAdmin(user) || (kind === "donors" && isStaff(user))) && (
                  <TableCell className="text-right">
                    {kind === "donors" && <Button size="sm" variant="ghost" onClick={() => { setEditing(i); setEditForm({ name: i.name || "", father_name: i.father_name || "", address: i.address || "", contact: i.contact || "", area: i.area || "", reference: i.reference || "", aadhar_number: i.aadhar_number || "" }); }} data-testid={`edit-${i.id}`}><Pencil size={15} /></Button>}
                    {isAccountantAdmin(user) && <Button size="sm" variant="ghost" onClick={() => remove(i.id)} data-testid={`delete-${i.id}`}>Delete</Button>}
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!editing} onOpenChange={open => !open && setEditing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle className="font-serif text-2xl">Edit Donor</DialogTitle></DialogHeader>
          {editForm && <form onSubmit={saveEdit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {[["name", "Name"], ["father_name", "Father's Name"], ["contact", "Contact"], ["address", "Address"], ["area", "Area"], ["reference", "Reference"], ["aadhar_number", "Aadhar"]].map(([key, label]) => <div key={key} className={key === "address" ? "md:col-span-2" : ""}><Label>{label}</Label><Input value={editForm[key] || ""} onChange={e => setEditForm({ ...editForm, [key]: e.target.value })} required={key === "name" || key === "father_name" || key === "contact" || key === "address"} /></div>)}
            <Button disabled={editSaving} className="rounded-full btn-primary-moss md:col-span-2">{editSaving ? "Saving…" : "Save Changes"}</Button>
          </form>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
