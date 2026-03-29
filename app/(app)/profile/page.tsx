"use client";

import Image from "next/image";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";
import { type ChangeEvent, useEffect, useState } from "react";
import {
  InlineMessage,
  PageHero,
  SectionCard,
  StatusBadge,
} from "@/components/WorkspacePrimitives";
import {
  PROFILE_CERTIFICATION_GROUPS,
  PROFILE_CERTIFICATION_SET,
} from "@/lib/constructionProfileCertifications";
import {
  CONSTRUCTION_POSITIONS,
  CONSTRUCTION_TRADES,
} from "@/lib/constructionProfileOptions";

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
  targetUser?: {
    id?: string;
    managed?: boolean;
    fullName?: string;
    email?: string;
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

function splitList(value: string, limit = 20) {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, limit);
}

function joinList(items: string[] | undefined) {
  return (items ?? []).join(", ");
}

function dedupeList(items: string[], limit: number) {
  return Array.from(new Set(items.map((item) => item.trim()).filter(Boolean))).slice(0, limit);
}

function splitKnownCertifications(items: string[] | undefined) {
  const selected: string[] = [];
  const custom: string[] = [];

  for (const item of items ?? []) {
    if (PROFILE_CERTIFICATION_SET.has(item)) {
      selected.push(item);
    } else {
      custom.push(item);
    }
  }

  return {
    selected: dedupeList(selected, 60),
    custom: dedupeList(custom, 20),
  };
}

function mergeCertifications(selected: string[], customText: string) {
  return dedupeList([...selected, ...splitList(customText, 20)], 60);
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

const OTHER_SELECT = "__other__";

function initProfileSelect(
  saved: string | undefined,
  options: readonly string[]
): { select: string; other: string } {
  const t = (saved ?? "").trim();
  if (!t) return { select: "", other: "" };
  if ((options as readonly string[]).includes(t)) return { select: t, other: "" };
  return { select: OTHER_SELECT, other: t };
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
  const [managedUserId, setManagedUserId] = useState("");
  const [returnTo, setReturnTo] = useState("/company-users");
  const [managedProfile, setManagedProfile] = useState(false);
  const [targetDisplayName, setTargetDisplayName] = useState("");
  const [targetEmail, setTargetEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [preferredName, setPreferredName] = useState("");
  const [positionSelect, setPositionSelect] = useState("");
  const [positionOther, setPositionOther] = useState("");
  const [tradeSelect, setTradeSelect] = useState("");
  const [tradeOther, setTradeOther] = useState("");
  const [yearsExperience, setYearsExperience] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [stateRegion, setStateRegion] = useState("");
  const [readinessStatus, setReadinessStatus] = useState("ready");
  const [selectedCertifications, setSelectedCertifications] = useState<string[]>([]);
  const [customCertificationsText, setCustomCertificationsText] = useState("");
  const [specialtiesText, setSpecialtiesText] = useState("");
  const [equipmentText, setEquipmentText] = useState("");
  const [bio, setBio] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [photoPath, setPhotoPath] = useState("");
  const [photoPreview, setPhotoPreview] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);

  useEffect(() => {
    void (async () => {
      const params =
        typeof window === "undefined"
          ? new URLSearchParams()
          : new URLSearchParams(window.location.search);
      const requestedUserId = params.get("userId")?.trim() ?? "";
      const nextReturnTo = params.get("returnTo")?.trim() || "/company-users";
      setManagedUserId(requestedUserId);
      setReturnTo(nextReturnTo);

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
          fetch(
            requestedUserId
              ? `/api/profile?userId=${encodeURIComponent(requestedUserId)}`
              : "/api/profile",
            {
              headers: {
                Authorization: `Bearer ${session.access_token}`,
              },
            }
          ),
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
          setManagedProfile(Boolean(profileData?.targetUser?.managed));
          setTargetDisplayName(profileData?.targetUser?.fullName ?? "");
          setTargetEmail(profileData?.targetUser?.email ?? "");
          setFullName(profile.fullName ?? "");
          setPreferredName(profile.preferredName ?? "");
          const pos = initProfileSelect(profile.jobTitle, CONSTRUCTION_POSITIONS);
          setPositionSelect(pos.select);
          setPositionOther(pos.other);
          const tr = initProfileSelect(profile.tradeSpecialty, CONSTRUCTION_TRADES);
          setTradeSelect(tr.select);
          setTradeOther(tr.other);
          setYearsExperience(
            profile.yearsExperience === null || profile.yearsExperience === undefined
              ? ""
              : String(profile.yearsExperience)
          );
          setPhone(profile.phone ?? "");
          setCity(profile.city ?? "");
          setStateRegion(profile.stateRegion ?? "");
          setReadinessStatus(profile.readinessStatus ?? "ready");
          const { selected, custom } = splitKnownCertifications(profile.certifications);
          setSelectedCertifications(selected);
          setCustomCertificationsText(joinList(custom));
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
        setMessage("Failed to load your construction profile.");
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

    const jobTitle =
      positionSelect === OTHER_SELECT ? positionOther.trim() : positionSelect.trim();
    const tradeSpecialty =
      tradeSelect === OTHER_SELECT ? tradeOther.trim() : tradeSelect.trim();

    if (!positionSelect) {
      setMessageTone("error");
      setMessage("Select your site position.");
      setSaving(false);
      return;
    }
    if (positionSelect === OTHER_SELECT && !jobTitle) {
      setMessageTone("error");
      setMessage("Enter your site position when using Other.");
      setSaving(false);
      return;
    }
    if (!tradeSelect) {
      setMessageTone("error");
      setMessage("Select your primary trade.");
      setSaving(false);
      return;
    }
    if (tradeSelect === OTHER_SELECT && !tradeSpecialty) {
      setMessageTone("error");
      setMessage("Enter your trade when using Other.");
      setSaving(false);
      return;
    }

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
          userId: managedUserId || undefined,
          fullName,
          preferredName,
          jobTitle,
          tradeSpecialty,
          yearsExperience,
          phone,
          city,
          stateRegion,
          readinessStatus,
          certifications: allCertifications,
          specialties: splitList(specialtiesText, 20),
          equipment: splitList(equipmentText, 20),
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
        throw new Error(data?.error || "Failed to save your construction profile.");
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
            ? "Construction profile saved."
            : "Profile saved. Add the remaining required details to continue.")
      );

      if (profileComplete && !initialProfileComplete && !managedProfile) {
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
        error instanceof Error ? error.message : "Failed to save your construction profile."
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

  function toggleCertification(certification: string) {
    setSelectedCertifications((current) =>
      current.includes(certification)
        ? current.filter((item) => item !== certification)
        : dedupeList([...current, certification], 60)
    );
  }

  const displayName = getDisplayName(fullName, preferredName);
  const managedProfileLabel = targetDisplayName || targetEmail || "Employee";
  const resolvedJobTitle =
    positionSelect === OTHER_SELECT ? positionOther.trim() : positionSelect.trim();
  const resolvedTrade =
    tradeSelect === OTHER_SELECT ? tradeOther.trim() : tradeSelect.trim();
  const allCertifications = mergeCertifications(selectedCertifications, customCertificationsText);
  const previewTags = splitList(specialtiesText, 20).slice(0, 4);
  const previewCertifications = allCertifications.slice(0, 6);
  const previewEquipment = splitList(equipmentText, 20).slice(0, 4);
  const profileChecklist = [
    { label: "Identity and profile photo", done: Boolean(fullName.trim() && (photoPreview || photoUrl)) },
    {
      label: "Site position and trade",
      done: Boolean(resolvedJobTitle && resolvedTrade),
    },
    { label: "Field location and experience", done: Boolean(city.trim() && stateRegion.trim() && yearsExperience.trim()) },
    { label: "Construction experience summary", done: Boolean(bio.trim()) },
  ];

  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center text-sm font-semibold text-slate-500 shadow-sm">
        Loading construction profile...
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHero
        eyebrow={managedProfile ? "Employee Profile" : "Construction Profile"}
        title={
          managedProfile
            ? `Manage ${managedProfileLabel}'s construction profile`
            : "Build your construction profile"
        }
        description={
          managedProfile
            ? "Review and update the construction details that matter on a real jobsite: crew role, trade specialty, certifications, equipment experience, work region, and site readiness."
            : "Capture the construction details that matter on a real jobsite: crew role, trade specialty, certifications, equipment experience, work region, and site readiness."
        }
        actions={
          managedProfile ? (
            <Link
              href={returnTo}
              className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Back to Team Access
            </Link>
          ) : undefined
        }
      />

      {managedProfile ? (
        <InlineMessage tone="neutral">
          You are editing the construction profile for <strong>{managedProfileLabel}</strong>.
          Company admins can only manage employee profiles inside their own company workspace.
        </InlineMessage>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-4">
        {[
          {
            label: "Identity",
            detail: "Photo, full name, and the crew role people recognize you by on a jobsite.",
          },
          {
            label: "Trade",
            detail: "Your primary trade, years in the field, and where you are ready to deploy.",
          },
          {
            label: "Credentials",
            detail: "Certifications, site strengths, and equipment or systems you know well.",
          },
          {
            label: "Readiness",
            detail: "A clean construction summary that company admins can trust before granting access.",
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
            title="Field identity card"
            description="Set the name, crew role, and photo that should represent you across company access and project records."
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
                    Use a clear headshot or field-ready portrait. This becomes the visible identity card for your construction profile.
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
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-600">
                      Site position <span className="text-red-600">*</span>
                    </label>
                    <select
                      value={positionSelect}
                      onChange={(e) => {
                        const v = e.target.value;
                        setPositionSelect(v);
                        if (v !== OTHER_SELECT) setPositionOther("");
                      }}
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-sky-500"
                    >
                      <option value="">Select position…</option>
                      {CONSTRUCTION_POSITIONS.map((p) => (
                        <option key={p} value={p}>
                          {p}
                        </option>
                      ))}
                      <option value={OTHER_SELECT}>Other (specify)</option>
                    </select>
                    {positionSelect === OTHER_SELECT ? (
                      <input
                        type="text"
                        placeholder="Describe your position"
                        value={positionOther}
                        onChange={(e) => setPositionOther(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-sky-500"
                      />
                    ) : null}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="block text-xs font-semibold text-slate-600">
                      Primary trade <span className="text-red-600">*</span>
                    </label>
                    <select
                      value={tradeSelect}
                      onChange={(e) => {
                        const v = e.target.value;
                        setTradeSelect(v);
                        if (v !== OTHER_SELECT) setTradeOther("");
                      }}
                      className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700 outline-none focus:border-sky-500"
                    >
                      <option value="">Select trade…</option>
                      {CONSTRUCTION_TRADES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                      <option value={OTHER_SELECT}>Other (specify)</option>
                    </select>
                    {tradeSelect === OTHER_SELECT ? (
                      <input
                        type="text"
                        placeholder="Describe your trade"
                        value={tradeOther}
                        onChange={(e) => setTradeOther(e.target.value)}
                        className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-sky-500"
                      />
                    ) : null}
                  </div>
                  <input
                    type="number"
                    min="0"
                    placeholder="Years in the field"
                    value={yearsExperience}
                    onChange={(event) => setYearsExperience(event.target.value)}
                    className="rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-sky-500"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <input
                    type="tel"
                    placeholder="Work mobile"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    className="rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-sky-500"
                  />
                  <input
                    type="text"
                    placeholder="Primary work city"
                    value={city}
                    onChange={(event) => setCity(event.target.value)}
                    className="rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-sky-500"
                  />
                </div>

                <input
                  type="text"
                  placeholder="State / region"
                  value={stateRegion}
                  onChange={(event) => setStateRegion(event.target.value)}
                  className="rounded-xl border border-slate-300 px-4 py-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-sky-500"
                />
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Site readiness"
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
            title="Certifications and jobsite strengths"
            description="Select the certifications that apply, then add jobsite strengths and equipment experience that define this person's construction capability."
          >
            <div className="space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">
                      Certification library
                    </div>
                    <p className="mt-1 text-sm leading-6 text-slate-500">
                      Choose every certification, license, and safety training item that applies to this construction profile.
                    </p>
                  </div>
                  <StatusBadge
                    label={`${allCertifications.length} selected`}
                    tone={allCertifications.length > 0 ? "success" : "warning"}
                  />
                </div>

                {allCertifications.length > 0 ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {allCertifications.slice(0, 12).map((item) => (
                      <span
                        key={item}
                        className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
                      >
                        {item}
                      </span>
                    ))}
                    {allCertifications.length > 12 ? (
                      <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700">
                        +{allCertifications.length - 12} more
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>

              <div className="grid gap-4 xl:grid-cols-2">
                {PROFILE_CERTIFICATION_GROUPS.map((group) => {
                  const groupSelectedCount = group.items.filter((item) =>
                    selectedCertifications.includes(item)
                  ).length;

                  return (
                    <div
                      key={group.title}
                      className="rounded-2xl border border-slate-200 bg-white p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-slate-900">{group.title}</div>
                          <p className="mt-1 text-xs leading-5 text-slate-500">
                            Select all certifications that apply.
                          </p>
                        </div>
                        <StatusBadge
                          label={`${groupSelectedCount} selected`}
                          tone={groupSelectedCount > 0 ? "success" : "neutral"}
                        />
                      </div>

                      <div className="mt-4 space-y-2">
                        {group.items.map((item) => {
                          const checked = selectedCertifications.includes(item);
                          return (
                            <label
                              key={item}
                              className={[
                                "flex cursor-pointer items-start gap-3 rounded-xl border px-3 py-3 text-sm transition",
                                checked
                                  ? "border-sky-200 bg-sky-50"
                                  : "border-slate-200 bg-slate-50 hover:border-sky-200 hover:bg-sky-50/70",
                              ].join(" ")}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={() => toggleCertification(item)}
                                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                              />
                              <span className="leading-6 text-slate-700">{item}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              <textarea
                rows={3}
                placeholder="Other certifications not listed above (comma separated)"
                value={customCertificationsText}
                onChange={(event) => setCustomCertificationsText(event.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm leading-6 text-slate-700 outline-none placeholder:text-slate-400 focus:border-sky-500"
              />
              <textarea
                rows={3}
                placeholder="Site specialties (comma separated) - excavation, confined space, crane planning, scaffold oversight..."
                value={specialtiesText}
                onChange={(event) => setSpecialtiesText(event.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm leading-6 text-slate-700 outline-none placeholder:text-slate-400 focus:border-sky-500"
              />
              <textarea
                rows={3}
                placeholder="Equipment and systems (comma separated) - skid steer, telehandler, trench box systems, aerial lift..."
                value={equipmentText}
                onChange={(event) => setEquipmentText(event.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 text-sm leading-6 text-slate-700 outline-none placeholder:text-slate-400 focus:border-sky-500"
              />
            </div>
          </SectionCard>

          <SectionCard
            title="Construction experience summary"
            description="Write the short summary that should frame this person's field background, project exposure, and safety responsibility."
          >
            <textarea
              rows={6}
              placeholder="Summarize project types, safety leadership, crew responsibility, and the site work this person is trusted to handle."
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
                  ? "Save Construction Profile"
                  : "Save Profile & Continue"}
            </button>
          </div>
        </div>

        <div className="space-y-5">
          <section className="rounded-[1.9rem] border border-slate-800 bg-[linear-gradient(180deg,_#0f1f39_0%,_#13284b_100%)] p-6 text-white shadow-[0_16px_35px_rgba(15,23,42,0.24)]">
            <div className="text-[11px] font-bold uppercase tracking-[0.3em] text-sky-200">
              Construction Profile
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
                  {resolvedJobTitle || "Job title"}
                  {resolvedJobTitle && resolvedTrade ? " - " : ""}
                  {resolvedTrade || ""}
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
                  Work Region
                </div>
                <div className="mt-2 text-sm font-semibold text-white">
                  {[city, stateRegion].filter(Boolean).join(", ") || "Set location"}
                </div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/6 px-4 py-3">
                <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-300">
                  Work Mobile
                </div>
                <div className="mt-2 text-sm font-semibold text-white">
                  {phone || "Add phone"}
                </div>
              </div>
            </div>

            <div className="mt-6 rounded-2xl border border-white/10 bg-white/6 p-4">
              <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-slate-300">
                Experience Summary
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-200">
                {bio ||
                  "Add a concise construction summary covering project types, field leadership, safety habits, and what this person is trusted to lead or support."}
              </p>
            </div>
          </section>

          <SectionCard
            title="Jobsite profile readiness"
            description="These are the construction onboarding items the platform uses to decide whether your profile is complete."
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
            title="Site qualification snapshot"
            description="Preview the construction credentials and jobsite strengths that will be visible once your profile is live."
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
