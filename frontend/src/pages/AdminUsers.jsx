import { useEffect, useState } from "react";
import { api, formatDetail } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, MagnifyingGlass } from "@phosphor-icons/react";
import { ROLES, roleLabel, useAuth } from "@/context/AuthContext";

const PERMISSIONS = ["donors.write", "beneficiaries.write", "payments.write", "loans.write", "vattiyilla.first_head", "sadakah.write", "expenses.write"];

export default function AdminUsers() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [filteredRows, setFilteredRows] = useState([]);
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [form, setForm] = useState({ email: "", password: "", name: "", role: ROLES.PAYMENT_COLLECTOR, permissions: [], is_active: true });
  const [editing, setEditing] = useState(null);

  const load = () => api.get("/admin/users").then(r => { setRows(r.data); setFilteredRows(r.data); });
  useEffect(() => { load(); }, []);

  const handleSearch = (query) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setFilteredRows(rows);
      return;
    }
    const lowerQuery = query.toLowerCase();
    const filtered = rows.filter(u =>
      u.name?.toLowerCase().includes(lowerQuery) ||
      u.email?.toLowerCase().includes(lowerQuery) ||
      u.role?.toLowerCase().includes(lowerQuery)
    );
    setFilteredRows(filtered);
  };

  const save = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        const payload = { name: form.name, role: form.role, permissions: form.permissions, is_active: form.is_active };
        if (form.password) payload.password = form.password;
        await api.patch(`/admin/users/${editing.id}`, payload);
        toast.success("Updated");
      } else {
        await api.post("/admin/users", form);
        toast.success("User created");
      }
      setOpen(false); setEditing(null);
      setForm({ email: "", password: "", name: "", role: ROLES.PAYMENT_COLLECTOR, permissions: [], is_active: true });
      load();
    } catch (e) { toast.error(formatDetail(e.response?.data?.detail)); }
  };

  const remove = async (id) => {
    if (!window.confirm("DELETE THIS USER?")) return;
    try { await api.delete(`/admin/users/${id}`); toast.success("Deleted"); load(); }
    catch (e) { toast.error(formatDetail(e.response?.data?.detail)); }
  };

  const editUser = (u) => {
    setEditing(u);
    setForm({ email: u.email, password: "", name: u.name, role: u.role, permissions: u.permissions || [], is_active: u.is_active !== false });
    setOpen(true);
  };

  const toggleActive = async (u) => {
    try {
      await api.patch(`/admin/users/${u.id}`, { is_active: u.is_active === false });
      toast.success(u.is_active === false ? "User activated" : "User deactivated");
      load();
    } catch (e) { toast.error(formatDetail(e.response?.data?.detail)); }
  };

  const togglePerm = (p) => setForm(f => ({ ...f, permissions: f.permissions.includes(p) ? f.permissions.filter(x => x !== p) : [...f.permissions, p] }));

  return (
    <div data-testid="admin-page">
      <PageHeader
        title="Admin · Users"
        subtitle="Create Accountant Admin, Account Assistant, and Payment Collector logins."
        action={
          <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setEditing(null); setForm({ email: "", password: "", name: "", role: ROLES.PAYMENT_COLLECTOR, permissions: [], is_active: true }); } }}>
            <DialogTrigger asChild>
              <Button className="btn-accent-copper rounded-full px-5 py-6" data-testid="add-user-btn">
                <Plus size={16} weight="bold" className="mr-2" /> Add User
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle className="font-serif text-2xl">{editing ? "Edit User" : "New User"}</DialogTitle></DialogHeader>
              <form onSubmit={save} className="space-y-4">
                <div>
                  <Label>Email</Label>
                  <Input type="email" required disabled={!!editing} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} data-testid="user-email" />
                </div>
                <div>
                  <Label>Name</Label>
                  <Input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} data-testid="user-name" />
                </div>
                <div>
                  <Label>Password {editing && <span className="text-xs text-[color:var(--text-muted)]">(leave blank to keep current)</span>}</Label>
                  <Input type="password" required={!editing} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} data-testid="user-password" />
                </div>
                <div>
                  <Label>Role</Label>
                  <Select value={form.role} onValueChange={v => setForm({ ...form, role: v })}>
                    <SelectTrigger data-testid="user-role"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ROLES.ACCOUNTANT_ADMIN}>Accountant – Admin</SelectItem>
                      <SelectItem value={ROLES.ACCOUNT_ASSISTANT}>Account Assistant</SelectItem>
                      <SelectItem value={ROLES.PAYMENT_COLLECTOR}>Payment Collector</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} data-testid="user-active" />
                    <span>Active (can log in)</span>
                  </label>
                </div>
                <div>
                  <Label>Permissions</Label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {PERMISSIONS.map(p => (
                      <label key={p} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="checkbox" checked={form.permissions.includes(p)} onChange={() => togglePerm(p)} />
                        <span>{p === "vattiyilla.first_head" ? "VI First Head Approval" : p}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <Button className="btn-primary-moss rounded-full" data-testid="user-submit">{editing ? "Save Changes" : "Create User"}</Button>
              </form>
            </DialogContent>
          </Dialog>
        }
      />
      <div className="card-earth mb-4 p-4">
        <div className="flex gap-2 items-center">
          <MagnifyingGlass size={18} className="text-[color:var(--text-muted)]" />
          <Input
            placeholder="Search by name, email, role..."
            value={searchQuery}
            onChange={e => handleSearch(e.target.value)}
            data-testid="search-users"
            className="flex-1"
          />
          {searchQuery && <span className="text-xs text-[color:var(--text-muted)]">Found: {filteredRows.length}</span>}
        </div>
      </div>
      <div className="card-earth overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-sidebar">
              <TableHead>Name</TableHead><TableHead>Email</TableHead><TableHead>Role</TableHead><TableHead>Status</TableHead><TableHead>Permissions</TableHead><TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRows.map(u => (
              <TableRow key={u.id} data-testid={`user-row-${u.id}`}>
                <TableCell className="font-medium">{u.name}</TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell>{roleLabel(u.role)}</TableCell>
                <TableCell>{u.is_active === false ? "Disabled" : "Active"}</TableCell>
                <TableCell className="text-xs text-[color:var(--text-muted)]">{(u.permissions || []).join(", ") || "—"}</TableCell>
                <TableCell className="text-right space-x-1">
                  <Button size="sm" variant="ghost" onClick={() => editUser(u)} data-testid={`edit-${u.id}`}>Edit</Button>
                  {u.id !== user.id && (
                    <Button size="sm" variant="ghost" onClick={() => toggleActive(u)} data-testid={`toggle-active-${u.id}`}>
                      {u.is_active === false ? "Activate" : "Deactivate"}
                    </Button>
                  )}
                  {u.id !== user.id && <Button size="sm" variant="ghost" onClick={() => remove(u.id)} data-testid={`del-${u.id}`}>Delete</Button>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
