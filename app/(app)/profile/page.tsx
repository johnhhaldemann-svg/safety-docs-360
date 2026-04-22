"use client";

import Image from "next/image";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabaseBrowser";
import { type ChangeEvent, useEffect, useState } from "react";
import { toast } from "sonner";
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
import { isCertificationExpired } from "@/lib/certificationExpirations";
import {
  CONSTRUCTION_POSITIONS,
  CONSTRUCTION_TRADES,
} from "@/lib/constructionProfileOptions";

const supabase = getSupabaseBrowserClient();

type AuthMeResponse = {
  user?: {
    companyId?: string | null;
    role?: string;
    roleLabel?: string;
    team?: string;
    permissionMap?: {
      can_access_internal_admin?: boolean;
      can_manage_company_users?: boolean;
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
    certificationExpirations?: Record<string, string>;
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
  const [workspaceRoleLabel, setWorkspaceRoleLabel] = useState("");
  const [workspaceTeam, setWorkspaceTeam] = useState("");
  const [canManageTeamUsers, setCanManageTeamUsers] = useState(false);
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
  const [certExpirations, setCertExpirations] = useState<Record<string, string>>({});
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
          setWorkspaceRoleLabel((meData?.user?.roleLabel ?? "").trim());
          setWorkspaceTeam((meData?.user?.team ?? "").trim());
          setCanManageTeamUsers(Boolean(meData?.user?.permissionMap?.can_manage_company_users));
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
          setCertExpirations({ ...(profile.certificationExpirations ?? {}) });
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
      const msg = "Select your jobsite title.";
      setMessageTone("error");
      setMessage(msg);
      toast.error(msg);
      setSaving(false);
      return;
    }
    if (positionSelect === OTHER_SELECT && !jobTitle) {
      const msg = "Enter your jobsite title when using Other.";
      setMessageTone("error");
      setMessage(msg);
      toast.error(msg);
      setSaving(false);
      return;
    }
    if (!tradeSelect) {
      const msg = "Select your primary trade.";
      setMessageTone("error");
      setMessage(msg);
      toast.error(msg);
      setSaving(false);
      return;
    }
    if (tradeSelect === OTHER_SELECT && !tradeSpecialty) {
      const msg = "Enter your trade when using Other.";
      setMessageTone("error");
      setMessage(msg);
      toast.error(msg);
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

      const allowedCertNames = new Set(allCertifications);
      const certificationExpirationsPayload = Object.fromEntries(
        Object.entries(certExpirations).filter(([name]) => allowedCertNames.has(name))
      );

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
          certificationExpirations: certificationExpirationsPayload,
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

      const savedProfile = data?.profile as
        | { certificationExpirations?: Record<string, string> }
        | undefined;
      if (savedProfile?.certificationExpirations) {
        setCertExpirations(savedProfile.certificationExpirations);
      }

      const profileComplete = Boolean(data?.profile?.profileComplete);
      setInitialProfileComplete(profileComplete || initialProfileComplete);
      setPhotoFile(null);
      setMessageTone(profileComplete ? "success" : "warning");
      const successMsg =
        data?.message ||
        (profileComplete
          ? "Construction profile saved."
          : "Profile saved. Add the remaining required details to continue.");
      setMessage(successMsg);
      if (profileComplete) {
        toast.success(successMsg);
      } else {
        toast.warning(successMsg);
      }

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
      const msg =
        error instanceof Error ? error.message : "Failed to save your construction profile.";
      setMessageTone("error");
      setMessage(msg);
      toast.error(msg);
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
    setSelectedCertifications((current) => {
      if (current.includes(certification)) {
        setCertExpirations((exp) => {
          const next = { ...exp };
          delete next[certification];
          return next;
        });
        return current.filter((item) => item !== certification);
      }
      return dedupeList([...current, certification], 60);
    });
  }

  function setExpirationForCert(certification: string, isoDate: string) {
    setCertExpirations((prev) => {
      const next = { ...prev };
      if (!isoDate) {
        delete next[certification];
      } else {
        next[certification] = isoDate;
      }
      return next;
    });
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
      label: "Jobsite title and trade",
      done: Boolean(resolvedJobTitle && resolvedTrade),
    },
    { label: "Field location and experience", done: Boolean(city.trim() && stateRegion.trim() && yearsExperience.trim()) },
    { label: "Construction experience summary", done: Boolean(bio.trim()) },
  ];

  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-700/80 bg-slate-900/90 p-8 text-center text-sm font-semibold text-slate-500 shadow-sm">
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
            ? "Update this employee’s jobsite-facing profile (title, trade, credentials). This is separate from their workspace role, which is set under Team access."
            : "Your app role (Company Admin, Company User, etc.) is shown below. The form fields are your public jobsite title and trade—used on your construction card, not for permissions."
        }
        actions={
          managedProfile ? (
            <Link
              href={returnTo}
              className="inline-flex items-center justify-center rounded-xl border border-slate-600 px-4 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-slate-950/50"
            >
              Back to Team Access
            </Link>
          ) : undefined
        }
      />

      {managedProfile ? (
        <InlineMessage tone="neutral">
          You are editing the construction profile for <strong>{managedProfileLabel}</strong> (jobsite title, trade, photo—what others see in the field). Workspace permissions are managed under{" "}
          <Link href="/company-users" className="font-semibold text-sky-300 underline-offset-2 hover:underline">
            Team access
          </Link>
          .
        </InlineMessage>
      ) : null}

      {!managedProfile && workspaceRoleLabel ? (
        <SectionCard
          title="Workspace access"
          description="Who you are in the platform (permissions). This is not the same as jobsite title in the form below."
        >
          <div className="grid gap-6 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                App role
              </p>
              <p className="mt-2 text-xl font-bold tracking-tight text-slate-100">{workspaceRoleLabel}</p>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Controls what you can do (documents, CSEP, billing, team management). Only a company admin can change this under Team access.
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                Company team
              </p>
              <p className="mt-2 text-xl font-bold tracking-tight text-slate-100">
                {workspaceTeam || "—"}
              </p>
              {canManageTeamUsers ? (
                <Link
                  href="/company-users"
                  className="mt-4 inline-flex items-center rounded-xl border border-sky-500/40 bg-sky-950/30 px-4 py-2.5 text-sm font-semibold text-sky-200 transition hover:bg-sky-950/50"
                >
                  Open team &amp; roles
                </Link>
              ) : (
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Ask your company admin if this role should be updated.
                </p>
              )}
            </div>
          </div>
        </SectionCard>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-4">
        {[
          {
            label: "Identity",
            detail: "Photo, full name, and the jobsite title shown on your construction card (not your app role above).",
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
            detail: "A clear field summary so your company can trust this profile before jobsite use.",
          },
        ].map((item, index) => (
          <div
            key={item.label}
            className="rounded-3xl border border-slate-700/80 bg-slate-900/90 p-5 shadow-sm"
          >
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-100 text-sm font-black text-sky-300">
                0{index + 1}
              </div>
              <div>
                <div className="text-base font-bold text-white">{item.label}</div>
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
            description={
              managedProfile
                ? "Public jobsite identity: name, photo, and jobsite title/trade shown on the construction card. Permissions are not edited here—use Team access."
                : "Public jobsite identity: name, photo, and jobsite title/trade on your construction profile. This does not change your app role in Workspace access above."
            }
          >
            <div className="grid gap-5 lg:grid-cols-[0.78fr_1.22fr]">
              <div className="app-soft-field rounded-3xl p-5">
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--app-muted)]">
                  Profile Picture
                </div>
                <div className="mt-4 flex flex-col items-center text-center">
                  {photoPreview || photoUrl ? (
                    <Image
                      src={photoPreview || photoUrl}
                      alt={displayName}
                      width={144}
                      height={144}
                      className="app-photo-frame h-36 w-36 rounded-[2rem] object-cover"
                    />
                  ) : (
                    <div className="app-photo-placeholder flex h-36 w-36 items-center justify-center rounded-[2rem] text-4xl font-black text-[var(--app-accent-primary)]">
                      {getInitials(displayName)}
                    </div>
                  )}
                  <label className="app-btn-primary app-shadow-action mt-5 inline-flex cursor-pointer px-4 py-2.5 text-sm">
                    Upload Photo
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoChange}
                      className="hidden"
                    />
                  </label>
                  <p className="mt-3 text-xs leading-5 text-[var(--app-muted)]">
                    Use a clear headshot or field-ready portrait. This becomes the visible identity card for your construction profile.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <input
                    type="text"
                    aria-label="Full name"
                    placeholder="Full name"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    className="rounded-xl border border-slate-600 px-4 py-3 text-sm text-slate-300 outline-none placeholder:text-slate-400 focus:border-sky-500"
                  />
                  <div className="space-y-1.5">
                    <label
                      htmlFor="profile-jobsite-title"
                      className="block text-xs font-semibold text-slate-400"
                    >
                      Jobsite title <span className="text-red-600">*</span>
                    </label>
                    <p className="text-xs leading-5 text-slate-500">
                      Shown on your construction card (e.g. Site Safety Manager). Not the same as your app role.
                    </p>
                    <select
                      id="profile-jobsite-title"
                      value={positionSelect}
                      onChange={(e) => {
                        const v = e.target.value;
                        setPositionSelect(v);
                        if (v !== OTHER_SELECT) setPositionOther("");
                      }}
                      className="app-dark-input mt-1.5"
                    >
                      <option value="">Select jobsite title…</option>
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
                        aria-label="Describe your jobsite title"
                        placeholder="Describe your jobsite title"
                        value={positionOther}
                        onChange={(e) => setPositionOther(e.target.value)}
                        className="w-full rounded-xl border border-slate-600 px-4 py-3 text-sm text-slate-300 outline-none placeholder:text-slate-400 focus:border-sky-500"
                      />
                    ) : null}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label
                      htmlFor="profile-primary-trade"
                      className="block text-xs font-semibold text-slate-400"
                    >
                      Primary trade <span className="text-red-600">*</span>
                    </label>
                    <select
                      id="profile-primary-trade"
                      value={tradeSelect}
                      onChange={(e) => {
                        const v = e.target.value;
                        setTradeSelect(v);
                        if (v !== OTHER_SELECT) setTradeOther("");
                      }}
                      className="app-dark-input"
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
                        aria-label="Describe your trade"
                        placeholder="Describe your trade"
                        value={tradeOther}
                        onChange={(e) => setTradeOther(e.target.value)}
                        className="w-full rounded-xl border border-slate-600 px-4 py-3 text-sm text-slate-300 outline-none placeholder:text-slate-400 focus:border-sky-500"
                      />
                    ) : null}
                  </div>
                  <input
                    type="number"
                    min="0"
                    aria-label="Years in the field"
                    placeholder="Years in the field"
                    value={yearsExperience}
                    onChange={(event) => setYearsExperience(event.target.value)}
                    className="rounded-xl border border-slate-600 px-4 py-3 text-sm text-slate-300 outline-none placeholder:text-slate-400 focus:border-sky-500"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <input
                    type="tel"
                    aria-label="Work mobile"
                    placeholder="Work mobile"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    className="rounded-xl border border-slate-600 px-4 py-3 text-sm text-slate-300 outline-none placeholder:text-slate-400 focus:border-sky-500"
                  />
                  <input
                    type="text"
                    aria-label="Primary work city"
                    placeholder="Primary work city"
                    value={city}
                    onChange={(event) => setCity(event.target.value)}
                    className="rounded-xl border border-slate-600 px-4 py-3 text-sm text-slate-300 outline-none placeholder:text-slate-400 focus:border-sky-500"
                  />
                </div>

                <input
                  type="text"
                  aria-label="State or region"
                  placeholder="State / region"
                  value={stateRegion}
                  onChange={(event) => setStateRegion(event.target.value)}
                  className="rounded-xl border border-slate-600 px-4 py-3 text-sm text-slate-300 outline-none placeholder:text-slate-400 focus:border-sky-500"
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
                        ? "border-sky-300 bg-sky-950/35 shadow-sm"
                        : "border-slate-700/80 bg-slate-900/90 hover:border-sky-500/35 hover:bg-sky-800/50",
                    ].join(" ")}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-slate-100">{option.label}</div>
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
              <div className="rounded-2xl border border-slate-700/80 bg-slate-950/50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-100">
                      Certification library
                    </div>
                    <p className="mt-1 text-sm leading-6 text-slate-500">
                      Choose every certification, license, and safety training item that applies to this construction
                      profile. Optional expiration dates keep the training matrix accurate when credentials lapse.
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
                        className="rounded-full border border-slate-700/80 bg-slate-900/90 px-3 py-1.5 text-xs font-semibold text-slate-300"
                      >
                        {item}
                      </span>
                    ))}
                    {allCertifications.length > 12 ? (
                      <span className="rounded-full border border-sky-500/35 bg-sky-950/35 px-3 py-1.5 text-xs font-semibold text-sky-300">
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
                      className="rounded-2xl border border-slate-700/80 bg-slate-900/90 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-slate-100">{group.title}</div>
                          <p className="mt-1 text-xs leading-5 text-slate-500">
                            Select all that apply. When checked, you can record an expiration date (YYYY-MM-DD).
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
                          const exp = certExpirations[item] ?? "";
                          const expired = exp ? isCertificationExpired(exp, new Date()) : false;
                          return (
                            <div
                              key={item}
                              className={[
                                "rounded-xl border px-3 py-3 text-sm transition",
                                checked
                                  ? expired
                                    ? "border-amber-300 bg-amber-950/40"
                                    : "border-sky-500/35 bg-sky-950/35"
                                  : "border-slate-700/80 bg-slate-950/50",
                              ].join(" ")}
                            >
                              <label className="flex cursor-pointer items-start gap-3">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleCertification(item)}
                                  className="mt-0.5 h-4 w-4 rounded border-slate-600 text-sky-600 focus:ring-sky-500"
                                />
                                <span className="flex-1 leading-6 text-slate-300">{item}</span>
                              </label>
                              {checked ? (
                                <div className="mt-2 flex flex-col gap-1 pl-7 sm:flex-row sm:items-center sm:gap-3">
                                  <label className="text-xs font-medium text-slate-400">
                                    Expires
                                    <input
                                      type="date"
                                      value={exp}
                                      onChange={(e) => setExpirationForCert(item, e.target.value)}
                                      className="ml-2 mt-1 block w-full rounded-lg border border-slate-600 bg-slate-900/90 px-2 py-1.5 text-xs text-slate-200 sm:mt-0 sm:inline-block sm:w-auto"
                                    />
                                  </label>
                                  {expired ? (
                                    <span className="text-xs font-semibold text-amber-100">
                                      Expired — renew to count toward training requirements
                                    </span>
                                  ) : exp ? (
                                    <span className="text-xs text-slate-500">Counts until this date (UTC)</span>
                                  ) : (
                                    <span className="text-xs text-slate-500">
                                      Leave blank if no expiry (counts as current)
                                    </span>
                                  )}
                                </div>
                              ) : null}
                            </div>
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
                className="w-full rounded-xl border border-slate-600 px-4 py-3 text-sm leading-6 text-slate-300 outline-none placeholder:text-slate-400 focus:border-sky-500"
              />
              <p className="text-xs text-slate-500">
                Expiration dates apply to items selected from the certification library above. Custom entries here are
                treated as current until you move them into the library list with a date.
              </p>
              <textarea
                rows={3}
                placeholder="Site specialties (comma separated) - excavation, confined space, crane planning, scaffold oversight..."
                value={specialtiesText}
                onChange={(event) => setSpecialtiesText(event.target.value)}
                className="w-full rounded-xl border border-slate-600 px-4 py-3 text-sm leading-6 text-slate-300 outline-none placeholder:text-slate-400 focus:border-sky-500"
              />
              <textarea
                rows={3}
                placeholder="Equipment and systems (comma separated) - skid steer, telehandler, trench box systems, aerial lift..."
                value={equipmentText}
                onChange={(event) => setEquipmentText(event.target.value)}
                className="w-full rounded-xl border border-slate-600 px-4 py-3 text-sm leading-6 text-slate-300 outline-none placeholder:text-slate-400 focus:border-sky-500"
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
              className="w-full rounded-xl border border-slate-600 px-4 py-3 text-sm leading-6 text-slate-300 outline-none placeholder:text-slate-400 focus:border-sky-500"
            />
          </SectionCard>

          {message ? <InlineMessage tone={messageTone}>{message}</InlineMessage> : null}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void handleSaveProfile()}
              disabled={saving}
              className="rounded-2xl bg-sky-600 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-sky-700 disabled:opacity-60"
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
          <section className="app-profile-card app-radius-panel p-6">
            <div className="text-[11px] font-bold uppercase tracking-[0.3em] text-[var(--app-accent-primary)]">
              Construction Profile
            </div>

            <div className="mt-5 flex items-start gap-4">
              {photoPreview || photoUrl ? (
                <Image
                  src={photoPreview || photoUrl}
                  alt={displayName}
                  width={96}
                  height={96}
                  className="app-photo-frame h-24 w-24 rounded-[1.8rem] object-cover"
                />
              ) : (
                <div className="app-photo-placeholder flex h-24 w-24 items-center justify-center rounded-[1.8rem] text-2xl font-black text-[var(--app-accent-primary)]">
                  {getInitials(displayName)}
                </div>
              )}

              <div className="min-w-0 flex-1">
                <div className="text-2xl font-black tracking-tight text-[var(--app-text-strong)]">{displayName}</div>
                <div className="mt-1 text-sm font-semibold text-[var(--app-text)]">
                  {resolvedJobTitle || "Jobsite title"}
                  {resolvedJobTitle && resolvedTrade ? " · " : ""}
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
              <div className="app-soft-field rounded-2xl px-4 py-3">
                <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--app-muted)]">
                  Work Region
                </div>
                <div className="mt-2 text-sm font-semibold text-[var(--app-text-strong)]">
                  {[city, stateRegion].filter(Boolean).join(", ") || "Set location"}
                </div>
              </div>
              <div className="app-soft-field rounded-2xl px-4 py-3">
                <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[var(--app-muted)]">
                  Work Mobile
                </div>
                <div className="mt-2 text-sm font-semibold text-[var(--app-text-strong)]">
                  {phone || "Add phone"}
                </div>
              </div>
            </div>

            <div className="app-soft-field mt-6 rounded-2xl p-4">
              <div className="text-[11px] font-bold uppercase tracking-[0.22em] text-[var(--app-muted)]">
                Experience Summary
              </div>
              <p className="mt-3 text-sm leading-6 text-[var(--app-text)]">
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
                  className="flex items-center justify-between rounded-2xl border border-slate-700/80 bg-slate-950/50 px-4 py-3"
                >
                  <span className="text-sm font-medium text-slate-300">{item.label}</span>
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
                    previewCertifications.map((item) => {
                      const exp = certExpirations[item];
                      const expired = exp ? isCertificationExpired(exp, new Date()) : false;
                      return (
                        <span
                          key={item}
                          className={[
                            "inline-flex max-w-full flex-col rounded-full border px-3 py-1.5 text-xs font-semibold sm:max-w-none sm:inline-flex sm:flex-row sm:items-center sm:gap-2",
                            expired
                              ? "border-amber-300 bg-amber-950/40 text-amber-900"
                              : exp
                                ? "border-sky-500/35 bg-sky-950/35 text-sky-900"
                                : "border-slate-700/80 bg-slate-950/50 text-slate-300",
                          ].join(" ")}
                        >
                          <span className="truncate">{item}</span>
                          {exp ? (
                            <span className="font-normal opacity-90">
                              {expired ? "expired " : "expires "}
                              {exp}
                            </span>
                          ) : null}
                        </span>
                      );
                    })
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
                        className="rounded-full border border-sky-500/35 bg-sky-950/35 px-3 py-1.5 text-xs font-semibold text-sky-300"
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
                        className="rounded-full border border-amber-500/35 bg-amber-950/40 px-3 py-1.5 text-xs font-semibold text-amber-700"
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
