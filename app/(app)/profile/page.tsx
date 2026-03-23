"use client";

import Image from "next/image";
import { createClient } from "@supabase/supabase-js";
import { type ChangeEvent, useEffect, useState } from "react";
import {
  InlineMessage,
  PageHero,
  SectionCard,
  StatusBadge,
} from "@/components/WorkspacePrimitives";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type AuthMeResponse = {
  user?: {
    companyId?: string | null;
    permissionMap?: {
      can_access_internal_admin?: boolean;
    };
  };
};

type ProfileResponse = {
  profile?: {
    fullName?: string;
    preferredName?: string;
    jobTitle?: string;
    tradeSpecialty?: string;
    yearsExperience?: number | null;
    phone?: string;
    city?: string;
    stateRegion?: string;
    readinessStatus?: string;
    certifications?: string[];
    specialties?: string[];
    equipment?: string[];
    bio?: string;
    photoUrl?: string;
    photoPath?: string;
    profileComplete?: boolean;
  };
};

const readinessOptions = [
  {
    value: "ready",
    label: "Ready for site",
    detail: "Available for normal project assignment and day-to-day field coordination.",
  },
  {
    value: "travel_ready",
    label: "Travel ready",
    detail: "Open to multi-site work, remote projects, and rapid deployment needs.",
  },
  {
    value: "limited",
    label: "Limited availability",
    detail: "Active profile, but current assignment or schedule limits deployment.",
  },
];

function splitList(value: string) {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function joinList(items: string[] | undefined) {
  return (items ?? []).join(", ");
}

function getReadinessLabel(value: string) {
  return readinessOptions.find((option) => option.value === value)?.label || "Ready for site";
}

function getReadinessTone(value: string): "success" | "warning" | "info" {
  if (value === "limited") {
    return "warning";
  }

  if (value === "travel_ready") {
    return "info";
  }

  return "success";
}

function getDisplayName(fullName: string, preferredName: string) {
  return preferredName.trim() || fullName.trim() || "Your Name";
}

function getInitials(name: string) {
  const parts = name
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  return ((parts[0]?.[0] ?? "Y") + (parts[1]?.[0] ?? "")).toUpperCase();
}

export default function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState<
    "neutral" | "success" | "warning" | "error"
  >("neutral");
  const [initialProfileComplete, setInitialProfileComplete] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [canAccessInternalAdmin, setCanAccessInternalAdmin] = useState(false);
  const [fullName, setFullName] = useState("");
  const [preferredName, setPreferredName] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [tradeSpecialty, setTradeSpecialty] = useState("");
  const [yearsExperience, setYearsExperience] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [stateRegion, setStateRegion] = useState("");
  const [readinessStatus, setReadinessStatus] = useState("ready");
  const [certificationsText, setCertificationsText] = useState("");
  const [specialtiesText, setSpecialtiesText] = useState("");
  const [equipmentText, setEquipmentText] = useState("");
  const [bio, setBio] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [photoPath, setPhotoPath] = useState("");
  const [photoPreview, setPhotoPreview] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  useEffect(() => {
    void (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        setLoading(false);
        return;
      }

      try {
        const [meResponse, profileResponse] = await Promise.all([
          fetch("/api/auth/me", {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          }),
          fetch("/api/profile", {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          }),
        ]);

        const meData = (await meResponse.json().catch(() => null)) as AuthMeResponse | null;
        const profileData = (await profileResponse.json().catch(() => null)) as
          | ProfileResponse
          | null;

        if (meResponse.ok) {
          setCompanyId(meData?.user?.companyId ?? null);
          setCanAccessInternalAdmin(Boolean(meData?.user?.permissionMap?.can_access_internal_admin));
        }

        if (profileResponse.ok && profileData?.profile) {
          const profile = profileData.profile;
          setFullName(profile.fullName ?? "");
          setPreferredName(profile.preferredName ?? "");
          setJobTitle(profile.jobTitle ?? "");
          setTradeSpecialty(profile.tradeSpecialty ?? "");
          setYearsExperience(
            profile.yearsExperience === null || profile.yearsExperience === undefined
              ? ""
              : String(profile.yearsExperience)
          );
          setPhone(profile.phone ?? "");
          setCity(profile.city ?? "");
          setStateRegion(profile.stateRegion ?? "");
          setReadinessStatus(profile.readinessStatus ?? "ready");
          setCertificationsText(joinList(profile.certifications));
          setSpecialtiesText(joinList(profile.specialties));
          setEquipmentText(joinList(profile.equipment));
          setBio(profile.bio ?? "");
          setPhotoUrl(profile.photoUrl ?? "");
          setPhotoPath(profile.photoPath ?? "");
          setPhotoPreview(profile.photoUrl ?? "");
          setInitialProfileComplete(Boolean(profile.profileComplete));
        }
      } catch (error) {
        console.error("Failed to load profile:", error);
        setMessageTone("error");
        setMessage("Failed to load your field talent profile.");
      }

      setLoading(false);
    })();
  }, []);

  async function uploadPhoto() {
    if (!photoFile) {
      return { nextPhotoUrl: photoUrl, nextPhotoPath: photoPath };
    }

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user?.id) {
      throw new Error("Please sign in again before uploading a profile picture.");
    }

    const nextPhotoPath = `${session.user.id}/profile-photo`;
    const uploadResult = await supabase.storage
      .from("profile-photos")
      .upload(nextPhotoPath, photoFile, {
        upsert: true,
        contentType: photoFile.type || "image/jpeg",
      });

    if (uploadResult.error) {
      throw new Error(uploadResult.error.message || "Failed to upload profile picture.");
    }

    const publicUrl = supabase.storage.from("profile-photos").getPublicUrl(nextPhotoPath).data
      .publicUrl;

    return {
      nextPhotoUrl: `${publicUrl}?v=${Date.now()}`,
      nextPhotoPath,
    };
  }

  async function handleSaveProfile() {
    setSaving(true);
    setMessage("");
    setMessageTone("neutral");

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("Please sign in before saving your profile.");
      }

      const { nextPhotoUrl, nextPhotoPath } = await uploadPhoto();

      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          fullName,
          preferredName,
          jobTitle,
          tradeSpecialty,
          yearsExperience,
          phone,
          city,
          stateRegion,
          readinessStatus,
          certifications: splitList(certificationsText),
          specialties: splitList(specialtiesText),
          equipment: splitList(equipmentText),
          bio,
          photoUrl: nextPhotoUrl,
          photoPath: nextPhotoPath,
        }),
      });

      const data = (await res.json().catch(() => null)) as
        | {
            error?: string;
            message?: string;
            profile?: { profileComplete?: boolean; photoUrl?: string; photoPath?: string };
          }
        | null;

      if (!res.ok) {
        throw new Error(data?.error || "Failed to save your field talent profile.");
      }

      if (data?.profile?.photoUrl) {
        setPhotoUrl(data.profile.photoUrl);
        setPhotoPreview(data.profile.photoUrl);
      }
      if (data?.profile?.photoPath) {
        setPhotoPath(data.profile.photoPath);
      }

      const profileComplete = Boolean(data?.profile?.profileComplete);
      setInitialProfileComplete(profileComplete || initialProfileComplete);
      setPhotoFile(null);
      setMessageTone(profileComplete ? "success" : "warning");
      setMessage(
        data?.message ||
          (profileComplete
            ? "Field talent profile saved."
            : "Profile saved. Add the remaining required details to continue.")
      );

      if (profileComplete && !initialProfileComplete) {
        const nextHref = canAccessInternalAdmin
          ? "/dashboard"
          : companyId
            ? "/dashboard"
            : "/company-setup";
        window.location.href = nextHref;
        return;
      }
    } catch (error) {
      setMessageTone("error");
      setMessage(
        error instanceof Error ? error.message : "Failed to save your field talent profile."
      );
    } finally {
      setSaving(false);
    }
  }

  function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;

    if (!file) {
      return;
    }

    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      setPhotoPreview(typeof reader.result === "string" ? reader.result : "");
    };
    reader.readAsDataURL(file);
  }

  const displayName = getDisplayName(fullName, preferredName);
  const previewTags = splitList(specialtiesText).slice(0, 4);
  const previewCertifications = splitList(certificationsText).slice(0, 4);
  const previewEquipment = splitList(equipmentText).slice(0, 4);
  const profileChecklist = [
    { label: "Identity and profile photo", done: Boolean(fullName.trim() && (photoPreview || photoUrl)) },
    { label: "Trade role and job title", done: Boolean(jobTitle.trim() && tradeSpecialty.trim()) },
    { label: "Field location and experience", done: Boolean(city.trim() && stateRegion.trim() && yearsExperience.trim()) },
    { label: "Capability summary", done: Boolean(bio.trim()) },
  ];

  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-sm font-semibold text-slate-500 shadow-sm">
        Loading field talent profile...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHero
        eyebrow="Talent Profile"
        title="Build your field talent profile"
        description="Create the construction profile that follows you across company setup, team access, site readiness, and document ownership. Think of it as your field capability card, not just an account form."
      />

      <section className="grid gap-4 lg:grid-cols-4">
        {[
          {
            label: "Identity",
            detail: "Photo, full name, and the role people recognize you by on a jobsite.",
          },
          {
            label: "Trade",
            detail: "Your core specialty, years in the field, and where you are ready to deploy.",
          },
          {
            label: "Credentials",
            detail: "Certifications, site strengths, and equipment or systems you know well.",
          },
          {
            label: "Readiness",
            detail: "A clean capability summary that company admins and internal teams can trust.",
          },
        ].map((item, index) => (
          <div
            key={item.label}
            className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-sm font-black text-sky-700">
                0{index + 1}
              </div>
              <div>
                <div className="text-base font-bold text-slate-950">{item.label}</div>
                <p className="mt-1 text-sm leading-6 text-slate-500">{item.detail}</p>
              </div>
            </div>
          </div>
        ))}
      </section>

      <div className="grid gap-5 xl:grid-cols-[1.08fr_0.92fr]">
        <div className="space-y-5">
          <SectionCard
            title="Identity and headshot"
            description="Set the name, title, and photo that should represent you across company access and project records."
          >
            <div className="grid gap-5 lg:grid-cols-[0.78fr_1.22fr]">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Profile Picture
                </div>
                <div className="mt-4 flex flex-col items-center text-center">
                  {photoPreview || photoUrl ? (
                    <Image
                      src={photoPreview || photoUrl}
                      alt={displayName}
                      width={144}
                      height={144}
                      className="h-36 w-36 rounded-[2rem] border border-slate-200 object-cover shadow-sm"
                    />
                  ) : (
                    <div className="flex h-36 w-36 items-center justify-center rounded-[2rem] bg-[linear-gradient(135deg,_#dbeafe_0%,_#bfdbfe_100%)] text-4xl font-black text-sky-700 shadow-sm">
                      {getInitials(displayName)}
                    </div>
                  )}
                  <label className="mt-5 inline-flex cursor-pointer rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-500">
                    Upload Photo
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoChange}
                      className="hidden"
                    />
                  </label>
                  <p className="mt-3 text-xs leading-5 text-slate-500">
                    Use a clear headshot or field-ready portrait. This becomes the visible identity card for your profile.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <input
                    type="text"
                    placeholder="Full name"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    className="rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-sky-500"
                  />
                  <input
                    type="text"
                    placeholder="Preferred name (optional)"
                    value={preferredName}
                    onChange={(event) => setPreferredName(event.target.value)}
                    className="rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-sky-500"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <input
                    type="text"
                    placeholder="Job title"
                    value={jobTitle}
                    onChange={(event) => setJobTitle(event.target.value)}
                    className="rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-sky-500"
                  />
                  <input
                    type="text"
                    placeholder="Primary trade specialty"
                    value={tradeSpecialty}
                    onChange={(event) => setTradeSpecialty(event.target.value)}
                    className="rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-sky-500"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <input
                    type="number"
                    min="0"
                    placeholder="Years in the field"
                    value={yearsExperience}
                    onChange={(event) => setYearsExperience(event.target.value)}
                    className="rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-sky-500"
                  />
                  <input
                    type="tel"
                    placeholder="Mobile phone"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    className="rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-sky-500"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <input
                    type="text"
                    placeholder="City"
                    value={city}
                    onChange={(event) => setCity(event.target.value)}
                    className="rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-sky-500"
                  />
                  <input
                    type="text"
                    placeholder="State / Region"
                    value={stateRegion}
                    onChange={(event) => setStateRegion(event.target.value)}
                    className="rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-sky-500"
                  />
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Field readiness"
            description="Frame how this person should be understood operationally across projects, travel, and workforce planning."
          >
            <div className="grid gap-3">
              {readinessOptions.map((option) => {
                const active = readinessStatus === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setReadinessStatus(option.value)}
                    className={[
                      "rounded-2xl border px-4 py-4 text-left transition",
                      active
                        ? "border-sky-300 bg-sky-50 shadow-sm"
                        : "border-slate-200 bg-white hover:border-sky-200 hover:bg-sky-50/60",
                    ].join(" ")}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-slate-900">{option.label}</div>
                      <StatusBadge
                        label={option.label}
                        tone={
                          option.value === "limited"
                            ? "warning"
                            : option.value === "travel_ready"
                              ? "info"
                              : "success"
                        }
                      />
                    </div>
                    <div className="mt-2 text-sm leading-6 text-slate-500">{option.detail}</div>
                  </button>
                );
              })}
            </div>
          </SectionCard>

          <SectionCard
            title="Certifications and field strengths"
            description="List the credentials, specialties, and equipment experience that define this person’s construction capability."
          >
            <div className="space-y-4">
              <textarea
                rows={3}
                placeholder="Certifications and licenses (comma separated) — OSHA 30, First Aid/CPR, NCCER, Fall Protection..."
                value={certificationsText}
                onChange={(event) => setCertificationsText(event.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm leading-6 text-slate-700 outline-none placeholder:text-slate-400 focus:border-sky-500"
              />
              <textarea
                rows={3}
                placeholder="Site specialties (comma separated) — excavation, confined space, crane planning, scaffold oversight..."
                value={specialtiesText}
                onChange={(event) => setSpecialtiesText(event.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm leading-6 text-slate-700 outline-none placeholder:text-slate-400 focus:border-sky-500"
              />
              <textarea
                rows={3}
                placeholder="Equipment and systems (comma separated) — skid steer, telehandler, trench box systems, aerial lift..."
                value={equipmentText}
                onChange={(event) => setEquipmentText(event.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm leading-6 text-slate-700 outline-none placeholder:text-slate-400 focus:border-sky-500"
              />
            </div>
          </SectionCard>

          <SectionCard
            title="Capability summary"
            description="Write the short professional summary that should frame this person’s construction profile."
          >
            <textarea
              rows={6}
              placeholder="Summarize field background, leadership level, safety mindset, project types, and what this person is trusted to handle on a site."
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm leading-6 text-slate-700 outline-none placeholder:text-slate-400 focus:border-sky-500"
            />
          </SectionCard>

          {message ? <InlineMessage tone={messageTone}>{message}</InlineMessage> : null}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void handleSaveProfile()}
              disabled={saving}
              className="rounded-2xl bg-sky-600 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-sky-500 disabled:opacity-60"
            >
              {saving
                ? "Saving profile..."
                : initialProfileComplete
                  ? "Save Talent Profile"
                  : "Save Profile & Continue"}
            </button>
          </div>
        </div>

        <div className="space-y-5">
          <section className="rounded-[1.9rem] border border-slate-800 bg-[linear-gradient(180deg,_#0f1f39_0%,_#13284b_100%)] p-6 text-white shadow-[0_16px_35px_rgba(15,23,42,0.24)]">
            <div className="text-[11px] font-bold uppercase tracking-[0.3em] text-sky-200">
              Construction Talent Profile
            </div>

            <div className="mt-5 flex items-start gap-4">
              {photoPreview || photoUrl ? (
                <Image
                  src={photoPreview || photoUrl}
                  alt={displayName}
                  width={96}
                  height={96}
                  className="h-24 w-24 rounded-[1.8rem] border border-white/10 object-cover"
                />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-[1.8rem] bg-sky-400/15 text-2xl font-black text-sky-100">
                  {getInitials(displayName)}
                </div>
              )}

              <div className="min-w-0 flex-1">
                <div className="text-2xl font-black tracking-tight text-white">{displayName}</div>
                <div className="mt-1 text-sm font-semibold text-sky-100">
                  {jobTitle || "Job title"}{jobTitle && tradeSpecialty ? " - " : ""}
                  {tradeSpecialty || ""}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <StatusBadge
                    label={getReadinessLabel(readinessStatus)}
                    tone={getReadinessTone(readinessStatus)}
                  />
                  {yearsExperience ? (
                    <StatusBadge
                      label={`${yearsExperience} years field experience`}
                      tone="info"
                    />
                  ) : null}
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3">
                <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-300">
                  Home Base
                </div>
                <div className="mt-2 text-sm font-semibold text-white">
                  {[city, stateRegion].filter(Boolean).join(", ") || "Set location"}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3">
                <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-300">
                  Contact
                </div>
                <div className="mt-2 text-sm font-semibold text-white">
                  {phone || "Add phone"}
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-white/10 bg-white/6 p-4">
              <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-300">
                Capability Summary
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-200">
                {bio ||
                  "Add a concise field summary covering site leadership, safety habits, project exposure, and what this person is trusted to lead or support."}
              </p>
            </div>
          </section>

          <SectionCard
            title="Profile readiness"
            description="These are the onboarding items the platform uses to decide whether your profile is complete."
          >
            <div className="space-y-3">
              {profileChecklist.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                >
                  <span className="text-sm font-medium text-slate-700">{item.label}</span>
                  <StatusBadge label={item.done ? "Ready" : "Missing"} tone={item.done ? "success" : "warning"} />
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard
            title="Credential snapshot"
            description="Preview the credentials and jobsite strengths that will be visible once your profile is live."
          >
            <div className="space-y-4">
              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">
                  Certifications
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {previewCertifications.length > 0 ? (
                    previewCertifications.map((item) => (
                      <span
                        key={item}
                        className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700"
                      >
                        {item}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-slate-500">Add certifications to complete this section.</span>
                  )}
                </div>
              </div>

              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">
                  Site strengths
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {previewTags.length > 0 ? (
                    previewTags.map((item) => (
                      <span
                        key={item}
                        className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700"
                      >
                        {item}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-slate-500">Add site strengths to define the profile.</span>
                  )}
                </div>
              </div>

              <div>
                <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-500">
                  Equipment and systems
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {previewEquipment.length > 0 ? (
                    previewEquipment.map((item) => (
                      <span
                        key={item}
                        className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700"
                      >
                        {item}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm text-slate-500">Add equipment experience to round out the profile.</span>
                  )}
                </div>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
