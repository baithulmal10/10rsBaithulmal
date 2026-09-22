import { useEffect, useState } from "react";
import { api, formatDetail } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { MagnifyingGlass, CheckCircle } from "@phosphor-icons/react";

const singularKind = { donors: "donor", beneficiaries: "beneficiary", workers: "worker" };
const countryCodes = [
  ["+91", "India"], ["+1", "United States / Canada"], ["+44", "United Kingdom"],
  ["+61", "Australia"], ["+971", "UAE"], ["+974", "Qatar"], ["+966", "Saudi Arabia"],
  ["+94", "Sri Lanka"], ["+60", "Malaysia"], ["+65", "Singapore"], ["+49", "Germany"],
];

/**
 * PersonLookupForm
 * kind: 'donors' | 'beneficiaries' | 'workers'
 * onSaved(person)
 */
export default function PersonLookupForm({ kind, onSaved, hideOnFound = false, allowCreate = true, searchMode = false }) {
  const [contact, setContact] = useState("");
  const [countryCode, setCountryCode] = useState("+91");
  const [checking, setChecking] = useState(false);
  const [found, setFound] = useState(null); // record if exists
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", father_name: "", address: "", area: "", reference: "", aadhar_number: "" });
  const [saving, setSaving] = useState(false);
  const [contactError, setContactError] = useState("");
  const [aadharError, setAadharError] = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [searching, setSearching] = useState(false);

  const noun = singularKind[kind] || kind;

  useEffect(() => {
    if (!searchMode) return undefined;
    const query = contact.trim();
    if (query.length < 2) {
      setSuggestions([]);
      return undefined;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const { data } = await api.get(`/people/${kind}/search`, { params: { q: query } });
        if (!cancelled) setSuggestions(Array.isArray(data) ? data.slice(0, 8) : []);
      } catch (e) {
        if (!cancelled) setSuggestions([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 250);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [contact, kind, searchMode]);

  const validateContact = (val) => {
    if (!/^\d{6,15}$/.test(val.replace(/\D/g, ""))) {
      return "Enter a valid phone number";
    }
    return "";
  };

  const validateAadhar = (val) => {
    if (val && !/^\d{12}$/.test(val.replace(/\D/g, ''))) {
      return "Aadhar must be 12 digits";
    }
    return "";
  };

  const doLookup = async () => {
    const search = contact.trim();
    const err = search && /^\d/.test(search) ? validateContact(search) : "";
    if (err) { setContactError(err); toast.error(err); return; }
    setContactError("");
    setChecking(true); setFound(null); setShowForm(false);
    try {
      const { data } = await api.get(`/people/${kind}/lookup`, { params: { contact: search } });
      if (data.exists) {
        setFound(data.record);
        if (hideOnFound) onSaved?.(data.record);
      } else if (allowCreate) {
        setShowForm(true);
      } else {
        toast.error(`No ${noun} found. Ask an Account Assistant or Accountant Admin to register them.`);
      }
    } catch (e) {
      toast.error(formatDetail(e.response?.data?.detail));
    } finally { setChecking(false); }
  };

  const doSave = async (e) => {
    e.preventDefault();
    const contactErr = validateContact(contact);
    const aadharErr = validateAadhar(form.aadhar_number);
    if (contactErr || aadharErr) {
      toast.error(contactErr || aadharErr);
      return;
    }
    setSaving(true);
    try {
      const storedContact = kind === "donors" ? `${countryCode}${contact.replace(/\D/g, "")}` : contact.trim();
      const { data } = await api.post(`/people/${kind}`, { ...form, contact: storedContact });
      toast.success(`${noun} registered - ID: ${data.serial}`);
      console.log("✅ Registered:", data);
      setFound(data);
      setShowForm(false);
      onSaved?.(data);
    } catch (e) {
      toast.error(formatDetail(e.response?.data?.detail));
    } finally { setSaving(false); }
  };

  const reset = () => {
    setContact(""); setCountryCode("+91"); setFound(null); setShowForm(false);
    setSuggestions([]);
    setForm({ name: "", father_name: "", address: "", area: "", reference: "", aadhar_number: "" });
  };

  return (
    <div className="space-y-4" data-testid={`lookup-${kind}`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Label>{kind === "donors" ? "Find Donor by Contact Number, Name, or Father's Name" : "Contact Number"} <span className="text-red-500">*</span></Label>
          <div className="relative flex gap-2">
            <Input
              data-testid="lookup-contact"
              value={contact}
              onChange={e => setContact(e.target.value)}
              placeholder={kind === "donors" ? "Phone, name, or father's name" : "Enter contact number"}
              onKeyDown={e => e.key === "Enter" && doLookup()}
              className={contactError ? "border-red-500" : ""}
            />
            {searchMode && suggestions.length > 0 && (
              <div className="absolute left-0 right-0 z-20 mt-12 overflow-hidden bg-white border rounded-lg shadow-lg border-earth">
                {suggestions.map(person => (
                  <button
                    type="button"
                    key={person.id}
                    onClick={() => { setContact(person.contact || person.name); setFound(person); setSuggestions([]); onSaved?.(person); }}
                    className="block w-full px-3 py-2 text-left border-b last:border-b-0 border-earth hover:bg-sidebar"
                  >
                    <span className="block text-sm font-medium">{person.name} <span className="font-normal text-[color:var(--text-muted)]">#{person.serial}</span></span>
                    <span className="block text-xs text-[color:var(--text-muted)]">{person.contact}{person.father_name ? ` · Father: ${person.father_name}` : ""}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {contactError && <div className="mt-1 text-xs text-red-500">{contactError}</div>}
          {searchMode && searching && <div className="mt-1 text-xs text-[color:var(--text-muted)]">Searching…</div>}
        </div>
        <div className="flex gap-2">
          <Button
            type="button" onClick={doLookup} disabled={checking}
            data-testid="lookup-btn"
            className="flex-1 px-5 rounded-full btn-primary-moss sm:flex-none"
          >
            <MagnifyingGlass size={16} weight="bold" className="mr-2" /> {checking ? "Checking…" : "Lookup"}
          </Button>
          {(found || showForm) && (
            <Button type="button" variant="outline" onClick={reset} data-testid="lookup-reset" className="rounded-full">Reset</Button>
          )}
        </div>
      </div>

      {found && (
        <div className="p-5 space-y-3 card-earth" data-testid="lookup-found">
          <div className="flex items-start gap-4">
            <div className="coin-badge shrink-0">{found.serial?.charAt(0) || "•"}</div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <CheckCircle size={18} weight="fill" className="text-[#2D7A4D]" />
                <div className="font-semibold text-[color:var(--text-primary)]">{found.name}</div>
                <span className="text-xs text-[color:var(--text-muted)]">#{found.serial}</span>
              </div>
              <div className="mt-1 text-sm text-[color:var(--text-secondary)]">
                Father: {found.father_name} · {found.contact}
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 pt-3 text-sm border-t">
            <div><span className="font-medium">Address:</span> {found.address}</div>
            <div><span className="font-medium">Area:</span> {found.area || "—"}</div>
            <div><span className="font-medium">Reference:</span> {found.reference || "—"}</div>
            <div><span className="font-medium">Aadhar:</span> {found.aadhar_number || "—"}</div>
            <div><span className="font-medium">Reg. Date:</span> {found.registration_date || "—"}</div>
          </div>
        </div>
      )}

      {showForm && (
        <form onSubmit={doSave} className="p-6 space-y-4 card-earth" data-testid="lookup-new-form">
            <div className="text-sm font-medium tracking-widest uppercase text-copper">New {noun} Registration</div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label>Name <span className="text-red-500">*</span></Label>
              <Input required data-testid="new-name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label>Father&apos;s Name <span className="text-red-500">*</span></Label>
              <Input required data-testid="new-father" value={form.father_name} onChange={e => setForm({ ...form, father_name: e.target.value })} />
            </div>
            <div className="md:col-span-2">
              <Label>Address <span className="text-red-500">*</span></Label>
              <Input required data-testid="new-address" value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} />
            </div>
            <div>
              <Label>Area</Label>
              <Input data-testid="new-area" value={form.area} onChange={e => setForm({ ...form, area: e.target.value })} />
            </div>
            <div>
              <Label>Reference</Label>
              <Input data-testid="new-reference" value={form.reference} onChange={e => setForm({ ...form, reference: e.target.value })} />
            </div>
            <div>
              <Label>Aadhar Card (optional, 12 digits)</Label>
              <Input data-testid="new-aadhar" value={form.aadhar_number} onChange={e => { setForm({ ...form, aadhar_number: e.target.value }); setAadharError(validateAadhar(e.target.value)); }} placeholder="e.g. 123456789012" maxLength="12" className={aadharError ? "border-red-500" : ""} />
              {aadharError && <div className="mt-1 text-xs text-red-500">{aadharError}</div>}
            </div>
            {kind === "donors" && <div>
              <Label>Country Code</Label>
              <select value={countryCode} onChange={e => setCountryCode(e.target.value)} className="flex w-full h-10 px-3 text-sm bg-white border rounded-md border-earth" aria-label="Country code">
                {countryCodes.map(([code, country]) => <option value={code} key={code}>{code} {country}</option>)}
              </select>
            </div>}
          </div>
          <Button disabled={saving} className="rounded-full btn-accent-copper" data-testid="new-save-btn">
            {saving ? "Saving…" : `Register ${noun}`}
          </Button>
        </form>
      )}
    </div>
  );
}
