import { useCallback, useEffect, useMemo, useState } from "react";
import { api, formatDate, inr } from "@/lib/api";
import { shareWhatsApp } from "@/lib/pdf";
import PageHeader from "@/components/PageHeader";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { WhatsappLogo } from "@phosphor-icons/react";

const formatISODate = (date) => date.toISOString().slice(0, 10);

function rangeFor(value) {
  const end = new Date();
  const start = new Date(end);

  if (value === "week") {
    start.setDate(end.getDate() - 6);
  }

  if (value === "month") {
    start.setMonth(end.getMonth() - 1);
  }

  if (value === "year") {
    start.setFullYear(end.getFullYear() - 1);
  }

  return {
    date_from: formatISODate(start),
    date_to: formatISODate(end),
  };
}

export default function ApprovedPayments() {
  const [rows, setRows] = useState([]);
  const [period, setPeriod] = useState("month");
  const [donorId, setDonorId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);

    const range =
      period === "custom"
        ? {
            date_from: dateFrom,
            date_to: dateTo,
          }
        : rangeFor(period);

    try {
      // Load all approved payments for the selected period.
      // Donor filtering is handled on the frontend.
      const payments = await api.get("/payments/approved", {
        params: range,
      });

      setRows(Array.isArray(payments.data) ? payments.data : []);
    } catch (error) {
      console.error("Failed to load approved payments:", error);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [period, dateFrom, dateTo]);

  useEffect(() => {
    load();
  }, [load]);

  /*
   * Create the donor dropdown from the approved payment rows.
   *
   * Example:
   * Ajith Raja
   * ₹600 + ₹300
   * = ₹900
   */
  const donors = useMemo(() => {
    const donorMap = new Map();

    rows.forEach((row) => {
      const donor = row.donor;

      if (!donor) return;

      const id = donor.id || row.donor_id;

      if (!id) return;

      const name = donor.name || "Unknown Donor";
      const serial = donor.serial || donor.contact || "—";
      const amount = Number(row.total_amount || 0);

      if (!donorMap.has(id)) {
        donorMap.set(id, {
          id,
          name,
          serial,
          amount,
        });
      } else {
        const existing = donorMap.get(id);
        existing.amount += amount;
      }
    });

    return Array.from(donorMap.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, [rows]);

  /*
   * Filter payments when a donor is selected.
   */
  const filteredRows = useMemo(() => {
    if (!donorId) {
      return rows;
    }

    return rows.filter((row) => {
      const rowDonorId = row.donor?.id || row.donor_id;

      return String(rowDonorId) === String(donorId);
    });
  }, [rows, donorId]);

  /*
   * Total approved amount.
   */
  const total = useMemo(() => {
    return filteredRows.reduce(
      (sum, row) => sum + Number(row.total_amount || 0),
      0
    );
  }, [filteredRows]);

  const sendReceipt = (payment) => {
    const donor = payment.donor || {};
    const periodStart = payment.from_month || payment.date_from?.slice(0, 7);
    const periodEnd = payment.to_month || payment.date_to?.slice(0, 7);
    const donorId = donor.serial || donor.id || payment.donor_id;
    const message = [
      "10RS BAITHULMAL",
      payment.receipt_no && `RECEIPT NUMBER: ${payment.receipt_no}`,
      donor.name && `DONOR: ${donor.name}`,
      donorId && `DONOR ID: ${donorId}`,
      donor.contact && `CONTACT: ${donor.contact}`,
      `AMOUNT: ${inr(payment.total_amount || 0)}`,
      (payment.collected_date || payment.collection_date) && `PAYMENT DATE: ${formatDate(payment.collected_date || payment.collection_date)}`,
      payment.payment_mode && `PAYMENT METHOD: ${payment.payment_mode.toUpperCase()}`,
      periodStart && `FROM MONTH: ${periodStart}`,
      periodEnd && `TO MONTH: ${periodEnd}`,
      payment.collected_by_name && `COLLECTED BY: ${payment.collected_by_name}`,
      payment.note && `NOTE: ${payment.note}`,
    ].filter(Boolean).join("\n");
    shareWhatsApp(message);
  };

  return (
    <div data-testid="approved-payments-page">
      <PageHeader
        title="Approved Payments"
        subtitle="Approved collections, grouped by collection date and donor."
      />

      {/* Filters */}
      <div className="grid items-end grid-cols-1 gap-3 p-4 mb-4 card-earth md:grid-cols-4">
        {/* Period */}
        <div>
          <Label>Period</Label>

          <select
            value={period}
            onChange={(e) => {
              setPeriod(e.target.value);
              setDonorId("");
            }}
            className="flex w-full h-10 px-3 text-sm bg-white border rounded-md border-earth"
            data-testid="approved-period"
          >
            <option value="week">Last Week</option>
            <option value="month">Last Month</option>
            <option value="year">Last Year</option>
            <option value="custom">Custom</option>
          </select>
        </div>

        {/* Custom From */}
        {period === "custom" && (
          <div>
            <Label>From</Label>

            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setDonorId("");
              }}
            />
          </div>
        )}

        {/* Custom To */}
        {period === "custom" && (
          <div>
            <Label>To</Label>

            <Input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setDonorId("");
              }}
            />
          </div>
        )}

        {/* Donor */}
        <div>
          <Label>Donor</Label>

          <select
            value={donorId}
            onChange={(e) => setDonorId(e.target.value)}
            className="flex w-full h-10 px-3 text-sm bg-white border rounded-md border-earth"
            data-testid="approved-donor-filter"
          >
            <option value="">All donors</option>

            {donors.map((donor) => (
              <option
                value={donor.id}
                key={donor.id}
              >
                {donor.name} · {inr(donor.amount)}
              </option>
            ))}
          </select>
        </div>

        {/* Refresh */}
        <Button
          type="button"
          variant="outline"
          onClick={load}
        >
          Refresh
        </Button>
      </div>

      {/* Total */}
      <div className="p-4 mb-4 card-earth">
        <span className="text-sm text-[color:var(--text-muted)]">
          Total approved
        </span>

        <div className="text-3xl font-bold text-moss">
          {inr(total)}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto card-earth">
        <Table>
          <TableHeader>
            <TableRow className="bg-sidebar">
              <TableHead>Receipt</TableHead>
              <TableHead>Donor</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Mode</TableHead>
              <TableHead>Collected By</TableHead>
              <TableHead>Collected date</TableHead>
              <TableHead>From month</TableHead>
              <TableHead>To month</TableHead>
              <TableHead>Action</TableHead>
            </TableRow>
          </TableHeader>

          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className="py-10 text-center"
                >
                  Loading...
                </TableCell>
              </TableRow>
            ) : filteredRows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={9}
                  className="py-10 text-center"
                >
                  No approved payments for this period.
                </TableCell>
              </TableRow>
            ) : (
              filteredRows.map((row) => (
                <TableRow key={row.id}>
                  {/* Receipt */}
                  <TableCell className="font-mono text-xs text-copper">
                    {row.receipt_no || "—"}
                  </TableCell>

                  {/* Donor */}
                  <TableCell>
                    <div>
                      {row.donor?.name || "—"}
                    </div>

                    <div className="text-xs text-[color:var(--text-muted)]">
                      {row.donor?.serial ||
                        row.donor?.contact ||
                        "—"}
                    </div>
                  </TableCell>

                  {/* Amount */}
                  <TableCell className="font-semibold">
                    {inr(row.total_amount || 0)}
                  </TableCell>

                  {/* Mode */}
                  <TableCell className="text-xs uppercase">
                    {row.payment_mode === "online"
                      ? "ONLINE PAYMENT"
                      : "CASH"}
                  </TableCell>

                  {/* Collected By */}
                  <TableCell>
                    {row.collected_by?.name ||
                      row.collector?.name ||
                      row.collected_by_name ||
                      row.user?.name ||
                      "—"}
                  </TableCell>

                  {/* Collected Date */}
                  <TableCell>{formatDate(row.collected_date || row.collection_date)}</TableCell>

                  {/* From Month */}
                  <TableCell>
                    {row.from_month || "—"}
                  </TableCell>

                  {/* To Month */}
                  <TableCell>
                    {row.to_month || "—"}
                  </TableCell>
                  <TableCell>
                    <Button type="button" size="sm" variant="outline" className="rounded-full"
                      onClick={() => sendReceipt(row)} data-testid={`approved-receipt-${row.id}`}>
                      <WhatsappLogo size={14} weight="duotone" className="mr-2" /> 
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}