"use client";

import { useState } from "react";
import Link from "next/link";

export default function AdminSettingsPage() {
  const [companyName, setCompanyName] = useState("Safety Docs 360");
  const [defaultApprover, setDefaultApprover] = useState("John Haldemann");
  const [supportEmail, setSupportEmail] = useState("admin@safetydocs360.com");
  const [uploadsEnabled, setUploadsEnabled] = useState(true);
  const [searchEnabled, setSearchEnabled] = useState(true);
  const [libraryEditing, setLibraryEditing] = useState(true);
  const [approvalRequired, setApprovalRequired] = useState(true);

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-sky-700">
              Administration
            </p>
            <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-900">
              Admin Settings
            </h1>
            <p className="mt-3 max-w-2xl text-sm text-slate-600">
              Control workspace defaults, approvals, document behavior, and
              platform options from one place.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button className="rounded-xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-500">
              Save Changes
            </button>
            <Link
              href="/admin"
              className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Back to Admin
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">Organization Settings</h2>
            <p className="mt-1 text-sm text-slate-500">
              Configure the main organization details used across the platform.
            </p>

            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Company Name
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-800 outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Default Approver
                </label>
                <input
                  type="text"
                  value={defaultApprover}
                  onChange={(e) => setDefaultApprover(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-800 outline-none focus:border-sky-500"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Support Email
                </label>
                <input
                  type="email"
                  value={supportEmail}
                  onChange={(e) => setSupportEmail(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-800 outline-none focus:border-sky-500"
                />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">Workspace Controls</h2>
            <p className="mt-1 text-sm text-slate-500">
              Turn major workspace features on or off.
            </p>

            <div className="mt-6 space-y-4">
              <ToggleRow
                title="Enable uploads"
                description="Allow users to upload files and project documents."
                checked={uploadsEnabled}
                onChange={() => setUploadsEnabled(!uploadsEnabled)}
              />

              <ToggleRow
                title="Enable search"
                description="Allow search across reports, templates, and project files."
                checked={searchEnabled}
                onChange={() => setSearchEnabled(!searchEnabled)}
              />

              <ToggleRow
                title="Allow library editing"
                description="Permit editors and admins to update library content."
                checked={libraryEditing}
                onChange={() => setLibraryEditing(!libraryEditing)}
              />

              <ToggleRow
                title="Require approval before publish"
                description="Force admin or manager approval before documents go live."
                checked={approvalRequired}
                onChange={() => setApprovalRequired(!approvalRequired)}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">Document Defaults</h2>
            <p className="mt-1 text-sm text-slate-500">
              Standard behaviors for forms, reports, and plan generation.
            </p>

            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Default Status
                </label>
                <select className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-800 outline-none focus:border-sky-500">
                  <option>Draft</option>
                  <option>Pending Review</option>
                  <option>Approved</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Export Format
                </label>
                <select className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-800 outline-none focus:border-sky-500">
                  <option>PDF</option>
                  <option>DOCX</option>
                  <option>Both</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Retention Period
                </label>
                <select className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-800 outline-none focus:border-sky-500">
                  <option>1 Year</option>
                  <option>3 Years</option>
                  <option>5 Years</option>
                  <option>7 Years</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-slate-700">
                  Default Library Access
                </label>
                <select className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-800 outline-none focus:border-sky-500">
                  <option>View Only</option>
                  <option>Editor Access</option>
                  <option>Admin Only</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">System Status</h2>
            <p className="mt-1 text-sm text-slate-500">
              Quick view of workspace services.
            </p>

            <div className="mt-6 space-y-4">
              <StatusRow name="Dashboard" status="Online" color="green" />
              <StatusRow name="Admin Controls" status="Active" color="green" />
              <StatusRow name="Library" status="Ready" color="green" />
              <StatusRow name="Uploads" status="Monitoring" color="amber" />
              <StatusRow name="Search Index" status="Active" color="green" />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">Admin Notes</h2>
            <p className="mt-1 text-sm text-slate-500">
              Keep track of important configuration reminders.
            </p>

            <div className="mt-6 space-y-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                Review approval workflows before enabling live publishing.
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                Confirm support email routing for platform notifications.
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                Recheck retention settings before moving to production records.
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-red-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900">Danger Zone</h2>
            <p className="mt-1 text-sm text-slate-500">
              High-impact actions should be handled carefully.
            </p>

            <div className="mt-6 space-y-3">
              <button className="w-full rounded-xl border border-red-300 px-4 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-50">
                Reset Workspace Defaults
              </button>
              <button className="w-full rounded-xl border border-red-300 px-4 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-50">
                Disable User Invitations
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function ToggleRow({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 p-4">
      <div>
        <p className="text-sm font-semibold text-slate-900">{title}</p>
        <p className="mt-1 text-sm text-slate-500">{description}</p>
      </div>

      <button
        type="button"
        onClick={onChange}
        className={`relative h-7 w-12 rounded-full transition ${
          checked ? "bg-sky-600" : "bg-slate-300"
        }`}
      >
        <span
          className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${
            checked ? "left-6" : "left-1"
          }`}
        />
      </button>
    </div>
  );
}

function StatusRow({
  name,
  status,
  color,
}: {
  name: string;
  status: string;
  color: "green" | "amber";
}) {
  const statusClass =
    color === "green"
      ? "bg-emerald-100 text-emerald-700"
      : "bg-amber-100 text-amber-700";

  return (
    <div className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-4">
      <span className="text-sm font-medium text-slate-700">{name}</span>
      <span
        className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClass}`}
      >
        {status}
      </span>
    </div>
  );
}