"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Building2, CheckCircle2, MapPin, Plus, RefreshCw, Search, Users } from "lucide-react";
import {
  EmptyState,
  InlineMessage,
  PageHero,
  SectionCard,
  appButtonPrimaryClassName,
  appButtonSecondaryClassName,
} from "@/components/WorkspacePrimitives";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";

const supabase = getSupabaseBrowserClient();

type MessageTone = "neutral" | "success" | "warning" | "error";

type AuditCustomer = {
  id: string;
  name: string;
  report_email?: string | null;
  contact_name?: string | null;
  phone?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  state_region?: string | null;
  postal_code?: string | null;
  country?: string | null;
  notes?: string | null;
  status?: string | null;
};

type AuditLocation = {
  id: string;
  audit_customer_id: string;
  name: string;
  project_number?: string | null;
  location?: string | null;
  report_email?: string | null;
  status?: string | null;
  project_manager?: string | null;
  safety_lead?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  notes?: string | null;
};

type CustomerForm = {
  id: string;
  name: string;
  reportEmail: string;
  contactName: string;
  phone: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  stateRegion: string;
  postalCode: string;
  country: string;
  notes: string;
};

type JobForm = {
  name: string;
  projectNumber: string;
  location: string;
  status: "planned" | "active" | "completed" | "archived";
  projectManager: string;
  safetyLead: string;
  customerReportEmail: string;
  startDate: string;
  endDate: string;
  notes: string;
};

const EMPTY_CUSTOMER_FORM: CustomerForm = {
  id: "",
  name: "",
  reportEmail: "",
  contactName: "",
  phone: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  stateRegion: "",
  postalCode: "",
  country: "USA",
  notes: "",
};

const EMPTY_JOB_FORM: JobForm = {
  name: "",
  projectNumber: "",
  location: "",
  status: "active",
  projectManager: "",
  safetyLead: "",
  customerReportEmail: "",
  startDate: "",
  endDate: "",
  notes: "",
};

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function customerToForm(customer: AuditCustomer): CustomerForm {
  return {
    id: customer.id,
    name: customer.name,
    reportEmail: customer.report_email ?? "",
    contactName: customer.contact_name ?? "",
    phone: customer.phone ?? "",
    addressLine1: customer.address_line1 ?? "",
    addressLine2: customer.address_line2 ?? "",
    city: customer.city ?? "",
    stateRegion: customer.state_region ?? "",
    postalCode: customer.postal_code ?? "",
    country: customer.country ?? "USA",
    notes: customer.notes ?? "",
  };
}

function formatCustomerAddress(customer: AuditCustomer) {
  const cityLine = [customer.city, customer.state_region, customer.postal_code].filter(Boolean).join(", ");
  return [customer.address_line1, customer.address_line2, cityLine, customer.country].filter(Boolean).join(" | ");
}

function formatStatus(status?: string | null) {
  const normalized = (status ?? "active").replaceAll("_", " ");
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export default function AuditCustomersPage() {
  const [customers, setCustomers] = useState<AuditCustomer[]>([]);
  const [locations, setLocations] = useState<AuditLocation[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [customerForm, setCustomerForm] = useState<CustomerForm>(EMPTY_CUSTOMER_FORM);
  const [jobForm, setJobForm] = useState<JobForm>(EMPTY_JOB_FORM);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [savingJob, setSavingJob] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<MessageTone>("neutral");
  const selectedCustomerIdRef = useRef("");

  useEffect(() => {
    selectedCustomerIdRef.current = selectedCustomerId;
  }, [selectedCustomerId]);

  const loadData = useCallback(async () => {
    setLoading(true);
    setMessage("");
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) throw new Error("You need to be signed in to load audit customers.");
      const [customersRes, locationsRes] = await Promise.all([
        fetchWithTimeout("/api/company/audit-customers", {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
        fetchWithTimeout("/api/company/audit-customer-locations", {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
      ]);
      const customersPayload = (await customersRes.json().catch(() => null)) as
        | { customers?: AuditCustomer[]; error?: string; warning?: string }
        | null;
      const locationsPayload = (await locationsRes.json().catch(() => null)) as
        | { locations?: AuditLocation[]; error?: string; warning?: string }
        | null;
      if (!customersRes.ok) throw new Error(customersPayload?.error || customersPayload?.warning || "Could not load customers.");
      if (!locationsRes.ok) throw new Error(locationsPayload?.error || locationsPayload?.warning || "Could not load audit locations.");
      const nextCustomers = customersPayload?.customers ?? [];
      setCustomers(nextCustomers);
      setLocations(locationsPayload?.locations ?? []);
      const nextSelected = selectedCustomerIdRef.current || nextCustomers[0]?.id || "";
      setSelectedCustomerId(nextSelected);
      const selected = nextCustomers.find((customer) => customer.id === nextSelected);
      if (selected) {
        setCustomerForm(customerToForm(selected));
        setJobForm((current) => ({
          ...current,
          customerReportEmail: current.customerReportEmail || selected.report_email || "",
        }));
      }
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "Could not load audit customer directory.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadData();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadData]);

  const selectedCustomer = customers.find((customer) => customer.id === selectedCustomerId) ?? null;
  const normalizedQuery = query.trim().toLowerCase();
  const locationsByCustomer = useMemo(() => {
    const counts = new Map<string, number>();
    for (const location of locations) {
      counts.set(location.audit_customer_id, (counts.get(location.audit_customer_id) ?? 0) + 1);
    }
    return counts;
  }, [locations]);
  const filteredCustomers = useMemo(() => {
    if (!normalizedQuery) return customers;
    return customers.filter((customer) =>
      [
        customer.name,
        customer.report_email ?? "",
        customer.contact_name ?? "",
        customer.phone ?? "",
        formatCustomerAddress(customer),
      ].some((value) => value.toLowerCase().includes(normalizedQuery))
    );
  }, [customers, normalizedQuery]);
  const selectedCustomerLocations = useMemo(
    () => locations.filter((location) => location.audit_customer_id === selectedCustomerId),
    [locations, selectedCustomerId]
  );

  function updateCustomerForm<K extends keyof CustomerForm>(key: K, value: CustomerForm[K]) {
    setCustomerForm((current) => ({ ...current, [key]: value }));
  }

  function updateJobForm<K extends keyof JobForm>(key: K, value: JobForm[K]) {
    setJobForm((current) => ({ ...current, [key]: value }));
  }

  function selectCustomer(customer: AuditCustomer) {
    setSelectedCustomerId(customer.id);
    setCustomerForm(customerToForm(customer));
    setJobForm({ ...EMPTY_JOB_FORM, customerReportEmail: customer.report_email ?? "" });
    setMessage("");
  }

  function startNewCustomer() {
    setSelectedCustomerId("");
    setCustomerForm(EMPTY_CUSTOMER_FORM);
    setJobForm(EMPTY_JOB_FORM);
    setMessage("");
  }

  async function saveCustomer() {
    if (!customerForm.name.trim()) {
      setMessageTone("error");
      setMessage("Customer company name is required.");
      return;
    }
    setSavingCustomer(true);
    setMessage("");
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) throw new Error("You need to be signed in to save customers.");
      const isUpdate = Boolean(customerForm.id);
      const response = await fetchWithTimeout(
        isUpdate ? `/api/company/audit-customers/${customerForm.id}` : "/api/company/audit-customers",
        {
          method: isUpdate ? "PATCH" : "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(customerForm),
        }
      );
      const payload = (await response.json().catch(() => null)) as
        | { customer?: AuditCustomer; error?: string; message?: string }
        | null;
      if (!response.ok) throw new Error(payload?.error || "Could not save the customer.");
      const savedCustomer = payload?.customer;
      if (savedCustomer) {
        setCustomers((current) =>
          [...current.filter((customer) => customer.id !== savedCustomer.id), savedCustomer].sort((a, b) =>
            a.name.localeCompare(b.name)
          )
        );
        setSelectedCustomerId(savedCustomer.id);
        setCustomerForm(customerToForm(savedCustomer));
        setJobForm((current) => ({ ...current, customerReportEmail: current.customerReportEmail || savedCustomer.report_email || "" }));
      }
      setMessageTone("success");
      setMessage(payload?.message || "Audit customer saved.");
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "Could not save the customer.");
    } finally {
      setSavingCustomer(false);
    }
  }

  async function saveJobsiteForCustomer() {
    if (!selectedCustomer) {
      setMessageTone("error");
      setMessage("Select or save a customer before adding a job.");
      return;
    }
    if (!jobForm.name.trim()) {
      setMessageTone("error");
      setMessage("Job name is required.");
      return;
    }
    setSavingJob(true);
    setMessage("");
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const accessToken = session?.access_token;
      if (!accessToken) throw new Error("You need to be signed in to save jobs.");
      const response = await fetchWithTimeout("/api/company/audit-customer-locations", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...jobForm,
          auditCustomerId: selectedCustomer.id,
          reportEmail: jobForm.customerReportEmail || selectedCustomer.report_email || "",
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | { location?: AuditLocation; error?: string; message?: string }
        | null;
      if (!response.ok) throw new Error(payload?.error || "Could not save the job.");
      if (payload?.location) {
        setLocations((current) => [
          payload.location as AuditLocation,
          ...current.filter((location) => location.id !== payload.location?.id),
        ]);
      }
      setJobForm({ ...EMPTY_JOB_FORM, customerReportEmail: selectedCustomer.report_email ?? "" });
      setMessageTone("success");
      setMessage(payload?.message || "Job added to this customer.");
    } catch (error) {
      setMessageTone("error");
      setMessage(error instanceof Error ? error.message : "Could not save the job.");
    } finally {
      setSavingJob(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHero
        eyebrow="Field audits"
        title="Audit customers"
        description="Manage customer companies, addresses, report emails, and audit-only jobs or locations. These are separate from platform Jobsites."
        actions={
          <>
            <button type="button" onClick={() => void loadData()} className={appButtonSecondaryClassName}>
              <RefreshCw className="h-4 w-4" />
              {loading ? "Refreshing..." : "Refresh"}
            </button>
            <button type="button" onClick={startNewCustomer} className={appButtonPrimaryClassName}>
              <Plus className="h-4 w-4" />
              New Customer
            </button>
          </>
        }
      />

      {message ? <InlineMessage tone={messageTone}>{message}</InlineMessage> : null}

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          { title: "Customers", value: customers.length, icon: Building2 },
          { title: "Audit Locations", value: locations.length, icon: MapPin },
          { title: "Customers With Jobs", value: [...locationsByCustomer.keys()].length, icon: Users },
        ].map((item) => (
          <div key={item.title} className="rounded-2xl border border-[var(--app-border-strong)] bg-white/95 p-5 shadow-[var(--app-shadow-soft)]">
            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--app-muted)]">{item.title}</p>
              <item.icon className="h-5 w-5 text-[var(--app-accent-primary)]" />
            </div>
            <p className="mt-3 text-3xl font-black text-[var(--app-text-strong)]">{loading ? "-" : item.value}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
        <SectionCard title="Customer directory" description="Search and select the company being audited.">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[var(--app-muted)]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search company, email, contact, address"
              className="w-full rounded-xl border border-[var(--app-border-strong)] bg-white px-9 py-2.5 text-sm text-[var(--app-text-strong)] outline-none focus:border-[var(--app-accent-primary)] focus:ring-2 focus:ring-[var(--app-accent-surface-18)]"
            />
          </label>

          {filteredCustomers.length === 0 ? (
            <EmptyState
              align="left"
              icon={Building2}
              title="No audit customers yet"
              description="Add the customer company first, then add jobs or locations under that company."
              primaryAction={{ label: "New Customer", onClick: startNewCustomer }}
            />
          ) : (
            <div className="max-h-[640px] space-y-2 overflow-y-auto pr-1">
              {filteredCustomers.map((customer) => {
                const selected = customer.id === selectedCustomerId;
                return (
                  <button
                    key={customer.id}
                    type="button"
                    onClick={() => selectCustomer(customer)}
                    className={`w-full rounded-2xl border p-4 text-left transition ${
                      selected
                        ? "border-[var(--app-accent-primary)] bg-[var(--app-accent-primary-soft)]"
                        : "border-[var(--app-border-strong)] bg-white hover:border-[var(--app-accent-border-24)]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-bold text-[var(--app-text-strong)]">{customer.name}</p>
                        <p className="mt-1 truncate text-xs text-[var(--app-text)]">
                          {customer.report_email || "No report email saved"}
                        </p>
                      </div>
                      <span className="rounded-full bg-white/70 px-2.5 py-1 text-xs font-bold text-[var(--app-accent-primary)]">
                        {locationsByCustomer.get(customer.id) ?? 0} jobs
                      </span>
                    </div>
                    <p className="mt-3 line-clamp-2 text-xs leading-5 text-[var(--app-muted)]">
                      {formatCustomerAddress(customer) || "No address saved"}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </SectionCard>

        <div className="space-y-6">
          <SectionCard
            title={customerForm.id ? "Customer profile" : "New customer"}
            description="Save the customer company, address, contact, and default audit report email."
            aside={
              selectedCustomer ? (
                <span className="inline-flex items-center gap-2 rounded-full border border-[var(--app-border)] bg-white/80 px-3 py-1.5 text-xs font-bold text-[var(--app-text)]">
                  <CheckCircle2 className="h-4 w-4 text-[var(--semantic-success)]" />
                  {selectedCustomerLocations.length} audit job{selectedCustomerLocations.length === 1 ? "" : "s"}
                </span>
              ) : null
            }
          >
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block text-sm font-semibold text-[var(--app-text-strong)] md:col-span-2">
                Company
                <input
                  value={customerForm.name}
                  onChange={(event) => updateCustomerForm("name", event.target.value)}
                  placeholder="Customer company name"
                  className="mt-1.5 w-full rounded-xl border border-[var(--app-border-strong)] bg-white px-3 py-2.5 text-sm"
                />
              </label>
              <label className="block text-sm font-semibold text-[var(--app-text-strong)]">
                Report email
                <input
                  value={customerForm.reportEmail}
                  onChange={(event) => updateCustomerForm("reportEmail", event.target.value)}
                  placeholder="customer@example.com"
                  className="mt-1.5 w-full rounded-xl border border-[var(--app-border-strong)] bg-white px-3 py-2.5 text-sm"
                />
              </label>
              <label className="block text-sm font-semibold text-[var(--app-text-strong)]">
                Contact name
                <input
                  value={customerForm.contactName}
                  onChange={(event) => updateCustomerForm("contactName", event.target.value)}
                  placeholder="Customer contact"
                  className="mt-1.5 w-full rounded-xl border border-[var(--app-border-strong)] bg-white px-3 py-2.5 text-sm"
                />
              </label>
              <label className="block text-sm font-semibold text-[var(--app-text-strong)]">
                Phone
                <input
                  value={customerForm.phone}
                  onChange={(event) => updateCustomerForm("phone", event.target.value)}
                  placeholder="Phone number"
                  className="mt-1.5 w-full rounded-xl border border-[var(--app-border-strong)] bg-white px-3 py-2.5 text-sm"
                />
              </label>
              <label className="block text-sm font-semibold text-[var(--app-text-strong)]">
                Address
                <input
                  value={customerForm.addressLine1}
                  onChange={(event) => updateCustomerForm("addressLine1", event.target.value)}
                  placeholder="Street address"
                  className="mt-1.5 w-full rounded-xl border border-[var(--app-border-strong)] bg-white px-3 py-2.5 text-sm"
                />
              </label>
              <label className="block text-sm font-semibold text-[var(--app-text-strong)]">
                Address line 2
                <input
                  value={customerForm.addressLine2}
                  onChange={(event) => updateCustomerForm("addressLine2", event.target.value)}
                  placeholder="Suite, unit, floor"
                  className="mt-1.5 w-full rounded-xl border border-[var(--app-border-strong)] bg-white px-3 py-2.5 text-sm"
                />
              </label>
              <label className="block text-sm font-semibold text-[var(--app-text-strong)]">
                City
                <input
                  value={customerForm.city}
                  onChange={(event) => updateCustomerForm("city", event.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-[var(--app-border-strong)] bg-white px-3 py-2.5 text-sm"
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="block text-sm font-semibold text-[var(--app-text-strong)]">
                  State
                  <input
                    value={customerForm.stateRegion}
                    onChange={(event) => updateCustomerForm("stateRegion", event.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-[var(--app-border-strong)] bg-white px-3 py-2.5 text-sm"
                  />
                </label>
                <label className="block text-sm font-semibold text-[var(--app-text-strong)]">
                  ZIP
                  <input
                    value={customerForm.postalCode}
                    onChange={(event) => updateCustomerForm("postalCode", event.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-[var(--app-border-strong)] bg-white px-3 py-2.5 text-sm"
                  />
                </label>
              </div>
              <label className="block text-sm font-semibold text-[var(--app-text-strong)]">
                Country
                <input
                  value={customerForm.country}
                  onChange={(event) => updateCustomerForm("country", event.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-[var(--app-border-strong)] bg-white px-3 py-2.5 text-sm"
                />
              </label>
              <label className="block text-sm font-semibold text-[var(--app-text-strong)] md:col-span-2">
                Notes
                <textarea
                  value={customerForm.notes}
                  onChange={(event) => updateCustomerForm("notes", event.target.value)}
                  rows={3}
                  placeholder="Billing notes, preferred report contact, site access notes"
                  className="mt-1.5 w-full rounded-xl border border-[var(--app-border-strong)] bg-white px-3 py-2.5 text-sm"
                />
              </label>
            </div>
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={() => void saveCustomer()} disabled={savingCustomer} className={appButtonPrimaryClassName}>
                {savingCustomer ? "Saving..." : customerForm.id ? "Save Customer" : "Add Customer"}
              </button>
              <button type="button" onClick={startNewCustomer} className={appButtonSecondaryClassName}>
                Clear
              </button>
            </div>
          </SectionCard>

          <SectionCard
            title="Jobs and locations"
            description={selectedCustomer ? `Audit-only jobs connected to ${selectedCustomer.name}.` : "Save or select a customer to add audit jobs."}
          >
            {!selectedCustomer ? (
              <EmptyState
                align="left"
                icon={MapPin}
                title="Select a customer first"
                description="Jobs and audit locations are stored under the customer company."
              />
            ) : (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <label className="block text-sm font-semibold text-[var(--app-text-strong)]">
                    Job / location name
                    <input
                      value={jobForm.name}
                      onChange={(event) => updateJobForm("name", event.target.value)}
                      placeholder="Lilly Jobsite"
                      className="mt-1.5 w-full rounded-xl border border-[var(--app-border-strong)] bg-white px-3 py-2.5 text-sm"
                    />
                  </label>
                  <label className="block text-sm font-semibold text-[var(--app-text-strong)]">
                    Project number
                    <input
                      value={jobForm.projectNumber}
                      onChange={(event) => updateJobForm("projectNumber", event.target.value)}
                      placeholder="Optional"
                      className="mt-1.5 w-full rounded-xl border border-[var(--app-border-strong)] bg-white px-3 py-2.5 text-sm"
                    />
                  </label>
                  <label className="block text-sm font-semibold text-[var(--app-text-strong)] md:col-span-2">
                    Address / location
                    <input
                      value={jobForm.location}
                      onChange={(event) => updateJobForm("location", event.target.value)}
                      placeholder="Street address or site location"
                      className="mt-1.5 w-full rounded-xl border border-[var(--app-border-strong)] bg-white px-3 py-2.5 text-sm"
                    />
                  </label>
                  <label className="block text-sm font-semibold text-[var(--app-text-strong)]">
                    Status
                    <select
                      value={jobForm.status}
                      onChange={(event) => updateJobForm("status", event.target.value as JobForm["status"])}
                      className="mt-1.5 w-full rounded-xl border border-[var(--app-border-strong)] bg-white px-3 py-2.5 text-sm"
                    >
                      <option value="planned">Planned</option>
                      <option value="active">Active</option>
                      <option value="completed">Completed</option>
                      <option value="archived">Archived</option>
                    </select>
                  </label>
                  <label className="block text-sm font-semibold text-[var(--app-text-strong)]">
                    Job report email
                    <input
                      value={jobForm.customerReportEmail}
                      onChange={(event) => updateJobForm("customerReportEmail", event.target.value)}
                      placeholder={selectedCustomer.report_email || "Optional override"}
                      className="mt-1.5 w-full rounded-xl border border-[var(--app-border-strong)] bg-white px-3 py-2.5 text-sm"
                    />
                  </label>
                  <label className="block text-sm font-semibold text-[var(--app-text-strong)]">
                    Project manager
                    <input
                      value={jobForm.projectManager}
                      onChange={(event) => updateJobForm("projectManager", event.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-[var(--app-border-strong)] bg-white px-3 py-2.5 text-sm"
                    />
                  </label>
                  <label className="block text-sm font-semibold text-[var(--app-text-strong)]">
                    Safety lead
                    <input
                      value={jobForm.safetyLead}
                      onChange={(event) => updateJobForm("safetyLead", event.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-[var(--app-border-strong)] bg-white px-3 py-2.5 text-sm"
                    />
                  </label>
                  <label className="block text-sm font-semibold text-[var(--app-text-strong)]">
                    Start date
                    <input
                      type="date"
                      value={jobForm.startDate}
                      onChange={(event) => updateJobForm("startDate", event.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-[var(--app-border-strong)] bg-white px-3 py-2.5 text-sm"
                    />
                  </label>
                  <label className="block text-sm font-semibold text-[var(--app-text-strong)]">
                    End date
                    <input
                      type="date"
                      value={jobForm.endDate}
                      onChange={(event) => updateJobForm("endDate", event.target.value)}
                      className="mt-1.5 w-full rounded-xl border border-[var(--app-border-strong)] bg-white px-3 py-2.5 text-sm"
                    />
                  </label>
                  <label className="block text-sm font-semibold text-[var(--app-text-strong)] md:col-span-2">
                    Job notes
                    <textarea
                      value={jobForm.notes}
                      onChange={(event) => updateJobForm("notes", event.target.value)}
                      rows={3}
                      className="mt-1.5 w-full rounded-xl border border-[var(--app-border-strong)] bg-white px-3 py-2.5 text-sm"
                    />
                  </label>
                </div>
                <button type="button" onClick={() => void saveJobsiteForCustomer()} disabled={savingJob} className={appButtonPrimaryClassName}>
                  <Plus className="h-4 w-4" />
                  {savingJob ? "Saving Job..." : "Add Job To Customer"}
                </button>

                <InlineMessage tone="neutral">
                  These audit jobs are not platform Jobsites. Use the Jobsites feature for your internal project operations.
                </InlineMessage>

                {selectedCustomerLocations.length === 0 ? (
                  <EmptyState
                    align="left"
                    icon={MapPin}
                    title="No jobs yet"
                    description="Add the first job or location for this customer. Audits will use these jobs in the location dropdown."
                  />
                ) : (
                  <div className="overflow-hidden rounded-2xl border border-[var(--app-border-strong)] bg-white">
                    <div className="grid grid-cols-[1.2fr_1fr_0.7fr_0.9fr] gap-3 border-b border-[var(--app-border)] bg-[var(--app-panel-soft)] px-4 py-3 text-[11px] font-bold uppercase tracking-[0.16em] text-[var(--app-muted)]">
                      <div>Job</div>
                      <div>Location</div>
                      <div>Status</div>
                      <div>Report Email</div>
                    </div>
                    {selectedCustomerLocations.map((jobsite) => (
                      <div key={jobsite.id} className="grid grid-cols-[1.2fr_1fr_0.7fr_0.9fr] gap-3 border-b border-[var(--app-border)] px-4 py-3 text-sm last:border-b-0">
                        <div>
                          <p className="font-semibold text-[var(--app-text-strong)]">{jobsite.name}</p>
                          <p className="text-xs text-[var(--app-muted)]">{jobsite.project_number || "No project number"}</p>
                        </div>
                        <div className="text-[var(--app-text)]">{jobsite.location || "No address saved"}</div>
                        <div className="font-semibold text-[var(--app-text)]">{formatStatus(jobsite.status)}</div>
                        <div className="truncate text-[var(--app-text)]">{jobsite.report_email || selectedCustomer.report_email || "Not set"}</div>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
