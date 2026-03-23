import { NextResponse } from "next/server";
import { authorizeRequest } from "@/lib/rbac";
import { createSupabaseAdminClient } from "@/lib/supabaseAdmin";

export const runtime = "nodejs";

type ProfileRow = {
  user_id: string;
  full_name: string | null;
  preferred_name: string | null;
  job_title: string | null;
  trade_specialty: string | null;
  years_experience: number | null;
  phone: string | null;
  city: string | null;
  state_region: string | null;
  readiness_status: string | null;
  certifications: string[] | null;
  specialties: string[] | null;
  equipment: string[] | null;
  bio: string | null;
  photo_url: string | null;
  photo_path: string | null;
  profile_complete: boolean | null;
};

type ProfilePayload = {
  fullName?: string;
  preferredName?: string;
  jobTitle?: string;
  tradeSpecialty?: string;
  yearsExperience?: number | string | null;
  phone?: string;
  city?: string;
  stateRegion?: string;
  readinessStatus?: string;
  certifications?: string[] | string;
  specialties?: string[] | string;
  equipment?: string[] | string;
  bio?: string;
  photoUrl?: string | null;
  photoPath?: string | null;
};

function trimText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeReadiness(value: unknown) {
  const normalized = trimText(value).toLowerCase().replace(/\s+/g, "_");
  if (normalized === "travel" || normalized === "travel-ready") {
    return "travel_ready";
  }
  if (normalized === "limited") {
    return "limited";
  }
  return "ready";
}

function normalizeList(value: unknown, limit = 20) {
  if (Array.isArray(value)) {
    return value
      .map((item) => trimText(item))
      .filter(Boolean)
      .slice(0, limit);
  }

  if (typeof value === "string") {
    return value
      .split(/[\n,]/)
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, limit);
  }

  return [];
}

function normalizeYearsExperience(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.round(value));
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      return Math.max(0, parsed);
    }
  }

  return null;
}

function getFallbackFullName(user: {
  email?: string | null;
  user_metadata?: Record<string, unknown>;
}) {
  const metadataFullName =
    typeof user.user_metadata?.full_name === "string"
      ? user.user_metadata.full_name
      : typeof user.user_metadata?.name === "string"
        ? user.user_metadata.name
        : "";

  return metadataFullName.trim() || user.email?.split("@")[0] || "";
}

function isProfileComplete(profile: {
  fullName: string;
  jobTitle: string;
  tradeSpecialty: string;
  city: string;
  stateRegion: string;
  bio: string;
}) {
  return Boolean(
    profile.fullName &&
      profile.jobTitle &&
      profile.tradeSpecialty &&
      profile.city &&
      profile.stateRegion &&
      profile.bio
  );
}

function serializeProfile(profile: ProfileRow | null, fallbackFullName: string) {
  return {
    userId: profile?.user_id ?? "",
    fullName: profile?.full_name?.trim() || fallbackFullName,
    preferredName: profile?.preferred_name?.trim() || "",
    jobTitle: profile?.job_title?.trim() || "",
    tradeSpecialty: profile?.trade_specialty?.trim() || "",
    yearsExperience: profile?.years_experience ?? null,
    phone: profile?.phone?.trim() || "",
    city: profile?.city?.trim() || "",
    stateRegion: profile?.state_region?.trim() || "",
    readinessStatus: profile?.readiness_status?.trim() || "ready",
    certifications: profile?.certifications ?? [],
    specialties: profile?.specialties ?? [],
    equipment: profile?.equipment ?? [],
    bio: profile?.bio?.trim() || "",
    photoUrl: profile?.photo_url?.trim() || "",
    photoPath: profile?.photo_path?.trim() || "",
    profileComplete: Boolean(profile?.profile_complete),
  };
}

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, {
    allowPending: true,
    allowSuspended: true,
  });

  if ("error" in auth) {
    return auth.error;
  }

  const { data, error } = await auth.supabase
    .from("user_profiles")
    .select(
      "user_id, full_name, preferred_name, job_title, trade_specialty, years_experience, phone, city, state_region, readiness_status, certifications, specialties, equipment, bio, photo_url, photo_path, profile_complete"
    )
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: error.message || "Failed to load profile." },
      { status: 500 }
    );
  }

  return NextResponse.json({
    profile: serializeProfile(
      (data as ProfileRow | null) ?? null,
      getFallbackFullName(auth.user)
    ),
  });
}

export async function PATCH(request: Request) {
  const auth = await authorizeRequest(request, {
    allowPending: true,
    allowSuspended: true,
  });

  if ("error" in auth) {
    return auth.error;
  }

  const body = (await request.json().catch(() => null)) as ProfilePayload | null;

  const fullName = trimText(body?.fullName) || getFallbackFullName(auth.user);
  const preferredName = trimText(body?.preferredName);
  const jobTitle = trimText(body?.jobTitle);
  const tradeSpecialty = trimText(body?.tradeSpecialty);
  const phone = trimText(body?.phone);
  const city = trimText(body?.city);
  const stateRegion = trimText(body?.stateRegion);
  const bio = trimText(body?.bio);
  const readinessStatus = normalizeReadiness(body?.readinessStatus);
  const yearsExperience = normalizeYearsExperience(body?.yearsExperience);
  const certifications = normalizeList(body?.certifications, 60);
  const specialties = normalizeList(body?.specialties, 20);
  const equipment = normalizeList(body?.equipment, 20);
  const photoUrl = typeof body?.photoUrl === "string" ? body.photoUrl.trim() : "";
  const photoPath = typeof body?.photoPath === "string" ? body.photoPath.trim() : "";

  const profileComplete = isProfileComplete({
    fullName,
    jobTitle,
    tradeSpecialty,
    city,
    stateRegion,
    bio,
  });

  const payload = {
    user_id: auth.user.id,
    full_name: fullName || null,
    preferred_name: preferredName || null,
    job_title: jobTitle || null,
    trade_specialty: tradeSpecialty || null,
    years_experience: yearsExperience,
    phone: phone || null,
    city: city || null,
    state_region: stateRegion || null,
    readiness_status: readinessStatus,
    certifications,
    specialties,
    equipment,
    bio: bio || null,
    photo_url: photoUrl || null,
    photo_path: photoPath || null,
    profile_complete: profileComplete,
  };

  const { data, error } = await auth.supabase
    .from("user_profiles")
    .upsert(payload, {
      onConflict: "user_id",
    })
    .select(
      "user_id, full_name, preferred_name, job_title, trade_specialty, years_experience, phone, city, state_region, readiness_status, certifications, specialties, equipment, bio, photo_url, photo_path, profile_complete"
    )
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: error.message || "Failed to save profile." },
      { status: 500 }
    );
  }

  const adminClient = createSupabaseAdminClient();
  if (adminClient) {
    const mergedUserMetadata = {
      ...(auth.user.user_metadata ?? {}),
      full_name: fullName,
      name: preferredName || fullName,
      avatar_url: photoUrl || null,
    };
    const mergedAppMetadata = {
      ...(auth.user.app_metadata ?? {}),
      full_name: fullName,
      avatar_url: photoUrl || null,
    };

    await adminClient.auth.admin.updateUserById(auth.user.id, {
      user_metadata: mergedUserMetadata,
      app_metadata: mergedAppMetadata,
    });
  }

  return NextResponse.json({
    success: true,
    profile: serializeProfile(
      (data as ProfileRow | null) ?? null,
      getFallbackFullName(auth.user)
    ),
    message: profileComplete
      ? "Construction profile saved. Your account is ready for the next setup step."
      : "Profile saved. Add the remaining construction details to finish onboarding.",
  });
}
