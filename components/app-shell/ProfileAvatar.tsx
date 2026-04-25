"use client";

import Image from "next/image";
import { getAvatarInitialsFromLabel, getUserDisplayName } from "@/lib/userRoleDisplay";

export type ProfileSummary = {
  fullName?: string;
  preferredName?: string;
  jobTitle?: string;
  tradeSpecialty?: string;
  photoUrl?: string;
};

export function ProfileAvatar({
  profile,
  email,
  sizeClass = "h-12 w-12",
  textClass = "text-sm",
}: {
  profile: ProfileSummary | null;
  email: string;
  sizeClass?: string;
  textClass?: string;
}) {
  const displayName = getUserDisplayName(profile, email);

  if (profile?.photoUrl) {
    return (
      <Image
        src={profile.photoUrl}
        alt={displayName}
        width={48}
        height={48}
        className={`${sizeClass} rounded-2xl object-cover`}
      />
    );
  }

  return (
    <span
      className={`${sizeClass} inline-flex items-center justify-center rounded-2xl bg-[var(--app-accent-surface-14)] font-black text-[var(--app-accent-primary)] ${textClass}`}
    >
      {getAvatarInitialsFromLabel(displayName)}
    </span>
  );
}
