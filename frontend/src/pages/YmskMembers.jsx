import { useEffect, useState } from "react";
import { api, formatDate, formatDetail } from "@/lib/api";
import PageHeader from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus } from "@phosphor-icons/react";
import { isStaff, useAuth } from "@/context/AuthContext";

const today = () => new Date().toISOString().slice(0, 10);
const initialForm = () => ({
  name: "",
  father_name: "",
  date_of_birth: "",
  address: "",
  contact: "",
  member_type: "member",
  join_date: today(),
});

export default function YmskMembers() {
  const { user } = useAuth();
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(initialForm);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get("/ymsk-members");
      setMembers(Array.isArray(data) ? data : []);
    } catch (error) {
      toast.error(formatDetail(error.response?.data?.detail));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      await api.post("/ymsk-members", form);
      toast.success("YMSK MEMBER ADDED");
      setForm(initialForm());
      setOpen(false);
      load();
    } catch (error) {
      toast.error(formatDetail(error.response?.data?.detail));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div data-testid="ymsk-members-page">
      <PageHeader
        title="YMSK Members"
        subtitle="Register and view YMSK members. Members can be selected as VI security."
        action={isStaff(user) && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="btn-accent-copper rounded-full px-5 py-6" data-testid="add-ymsk-member">
                <Plus size={16} weight="bold" className="mr-2" /> Add Member
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader><DialogTitle className="font-serif text-2xl">New YMSK Member</DialogTitle></DialogHeader>
              <form onSubmit={submit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div><Label>Name *</Label><Input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} data-testid="ymsk-name" /></div>
                <div><Label>Father Name *</Label><Input required value={form.father_name} onChange={e => setForm({ ...form, father_name: e.target.value })} data-testid="ymsk-father-name" /></div>
                <div><Label>Date Of Birth *</Label><Input type="date" required value={form.date_of_birth} onChange={e => setForm({ ...form, date_of_birth: e.target.value })} data-testid="ymsk-date-of-birth" /></div>
                <div><Label>Contact Number *</Label><Input type="tel" required value={form.contact} onChange={e => setForm({ ...form, contact: e.target.value })} data-testid="ymsk-contact" /></div>
                <div className="md:col-span-2"><Label>Address *</Label><Input required value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} data-testid="ymsk-address" /></div>
                <div>
                  <Label>Member Type *</Label>
                  <Select value={form.member_type} onValueChange={value => setForm({ ...form, member_type: value })}>
                    <SelectTrigger data-testid="ymsk-member-type"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="member">Member</SelectItem>
                      <SelectItem value="honour_member">Honour Member</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Join Date</Label><Input readOnly value={formatDate(form.join_date)} data-testid="ymsk-join-date" /></div>
                <Button disabled={saving} className="btn-primary-moss rounded-full md:col-span-2" data-testid="ymsk-submit">
                  {saving ? "Saving…" : "Save Member"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      />

      <div className="card-earth overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-sidebar">
              <TableHead>Name</TableHead><TableHead>Father Name</TableHead><TableHead>Date Of Birth</TableHead>
              <TableHead>Address</TableHead><TableHead>Contact</TableHead><TableHead>Member Type</TableHead><TableHead>Join Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow><TableCell colSpan={7} className="py-10 text-center">Loading…</TableCell></TableRow>
            ) : members.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="py-10 text-center">No YMSK Members Yet.</TableCell></TableRow>
            ) : members.map(member => (
              <TableRow key={member.id}>
                <TableCell className="font-medium">{member.name}</TableCell>
                <TableCell>{member.father_name}</TableCell>
                <TableCell>{formatDate(member.date_of_birth)}</TableCell>
                <TableCell>{member.address}</TableCell>
                <TableCell>{member.contact}</TableCell>
                <TableCell>{member.member_type === "honour_member" ? "Honour Member" : "Member"}</TableCell>
                <TableCell>{formatDate(member.join_date)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
