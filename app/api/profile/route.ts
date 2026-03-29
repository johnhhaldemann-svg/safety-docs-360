import { NextResponse } from "next/server";
import { getCompanyScope } from "@/lib/companyScope";
import { authorizeRequest } from "@/lib/rbac";
import { isAdminRole, isCompanyAdminRole } from "@/lib/rbac";
import {
  normalizeCertificationExpirationsPayload,
  parseCertificationExpirations,
} from "@/lib/certificationExpirations";
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
  certification_expirations: Record<string, string> | null;
  specialties: string[] | null;
  equipment: string[] | null;
  bio: string | null;
  photo_url: string | null;
  photo_path: string | null;
  profile_complete: boolean | null;
};

type ProfilePayload = {
  userId?: string;
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
  certificationExpirations?: Record<string, unknown>;
  specialties?: string[] | string;
  equipment?: string[] | string;
  bio?: string;
  photoUrl?: string | null;
  photoPath?: string | null;
};

type AuthorizedProfileTarget = {
  targetUserId: string;
  managed: boolean;
};

function trimText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function getTargetUserIdFromRequest(request: Request) {
  return trimText(new URL(request.url).searchParams.get("userId"));
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
    certificationExpirations: parseCertificationExpirations(
      profile?.certification_expirations ?? undefined
    ),
    specialties: profile?.specialties ?? [],
    equipment: profile?.equipment ?? [],
    bio: profile?.bio?.trim() || "",
    photoUrl: profile?.photo_url?.trim() || "",
    photoPath: profile?.photo_path?.trim() || "",
    profileComplete: Boolean(profile?.profile_complete),
  };
}

async function resolveProfileTarget(params: {
  request: Request;
  auth: Awaited<ReturnType<typeof authorizeRequest>> extends { error: unknown }
    ? never
    : never;
  requestedUserId?: string;
}) {
  const requestedUserId =
    trimText(params.requestedUserId) || getTargetUserIdFromRequest(params.request);
  const auth = params.auth as unknown as {
    user: {
      id: string;
      app_metadata?: Record<string, unknown>;
      user_metadata?: Record<string, unknown>;
    };
    role: string;
    team: string;
    supabase: unknown;
  };
  const targetUserId = requestedUserId || auth.user.id;

  if (targetUserId === auth.user.id) {
    return {
      targetUserId,
      managed: false,
    } satisfies AuthorizedProfileTarget;
  }

  if (isAdminRole(auth.role)) {
    return {
      targetUserId,
      managed: true,
    } satisfies AuthorizedProfileTarget;
  }

  if (!isCompanyAdminRole(auth.role)) {
    return NextResponse.json(
      { error: "You can only view or edit your own profile." },
      { status: 403 }
    );
  }

  const actorScope = await getCompanyScope({
    supabase: auth.supabase as never,
    userId: auth.user.id,
    fallbackTeam: auth.team,
    authUser: auth.user,
  });

  if (!actorScope.companyId) {
    return NextResponse.json(
      { error: "This company admin account is not linked to a valid company workspace yet." },
      { status: 400 }
    );
  }

  const targetScope = await getCompanyScope({
    supabase: auth.supabase as never,
    userId: targetUserId,
    fallbackTeam: null,
  });

  if (!targetScope.companyId || targetScope.companyId !== actorScope.companyId) {
    return NextResponse.json(
      { error: "Company admins can only view or edit employee profiles in their own company." },
      { status: 403 }
    );
  }

  return {
    targetUserId,
    managed: true,
  } satisfies AuthorizedProfileTarget;
}

export async function GET(request: Request) {
  const auth = await authorizeRequest(request, {
    allowPending: true,
    allowSuspended: true,
  });

  if ("error" in auth) {
    return auth.error;
  }

  const targetAccess = await resolveProfileTarget({
    request,
    auth: auth as never,
  });

  if (targetAccess instanceof NextResponse) {
    return targetAccess;
  }

  const adminClient = createSupabaseAdminClient();
  const targetAuthUser =
    targetAccess.managed && adminClient
      ? (
          await adminClient.auth.admin
            .getUserById(targetAccess.targetUserId)
            .then((result) => result.data.user ?? null)
            .catch(() => null)
        )
      : targetAccess.targetUserId === auth.user.id
        ? auth.user
        : null;

  const { data, error } = await auth.supabase
    .from("user_profiles")
    .select(
      "user_id, full_name, preferred_name, job_title, trade_specialty, years_experience, phone, city, state_region, readiness_status, certifications, certification_expirations, specialties, equipment, bio, photo_url, photo_path, profile_complete"
    )
    .eq("user_id", targetAccess.targetUserId)
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
      targetAuthUser ? getFallbackFullName(targetAuthUser) : ""
    ),
    targetUser: {
      id: targetAccess.targetUserId,
      managed: targetAccess.managed,
      fullName: targetAuthUser ? getFallbackFullName(targetAuthUser) : "",
      email: targetAuthUser?.email ?? "",
    },
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
  const targetAccess = await resolveProfileTarget({
    request,
    auth: auth as never,
    requestedUserId: body?.userId,
  });

  if (targetAccess instanceof NextResponse) {
    return targetAccess;
  }

  const adminClient = createSupabaseAdminClient();
  const targetAuthUser =
    targetAccess.targetUserId === auth.user.id
      ? auth.user
      : adminClient
        ? (
            await adminClient.auth.admin
              .getUserById(targetAccess.targetUserId)
              .then((result) => result.data.user ?? null)
              .catch(() => null)
          )
        : null;

  const fullName =
    trimText(body?.fullName) || getFallbackFullName(targetAuthUser ?? auth.user);
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
  const certificationExpirations = normalizeCertificationExpirationsPayload(
    body?.certificationExpirations,
    new Set(certifications)
  );
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
    user_id: targetAccess.targetUserId,
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
    certification_expirations: certificationExpirations,
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
      "user_id, full_name, preferred_name, job_title, trade_specialty, years_experience, phone, city, state_region, readiness_status, certifications, certification_expirations, specialties, equipment, bio, photo_url, photo_path, profile_complete"
    )
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: error.message || "Failed to save profile." },
      { status: 500 }
    );
  }

  if (adminClient && targetAuthUser) {
    const mergedUserMetadata = {
      ...(targetAuthUser.user_metadata ?? {}),
      full_name: fullName,
      name: preferredName || fullName,
      avatar_url: photoUrl || null,
    };
    const mergedAppMetadata = {
      ...(targetAuthUser.app_metadata ?? {}),
      full_name: fullName,
      avatar_url: photoUrl || null,
    };

    await adminClient.auth.admin.updateUserById(targetAccess.targetUserId, {
      user_metadata: mergedUserMetadata,
      app_metadata: mergedAppMetadata,
    });
  }

  return NextResponse.json({
    success: true,
    profile: serializeProfile(
      (data as ProfileRow | null) ?? null,
      targetAuthUser ? getFallbackFullName(targetAuthUser) : ""
    ),
    message: profileComplete
      ? targetAccess.managed
        ? "Employee construction profile saved."
        : "Construction profile saved. Your account is ready for the next setup step."
      : targetAccess.managed
        ? "Employee profile saved. Add the remaining construction details to finish the profile."
        : "Profile saved. Add the remaining construction details to finish onboarding.",
  });
}
