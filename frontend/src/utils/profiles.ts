export const userProfiles = {
  me: {
    role: "me",
    nickname: "LXQ",
    avatar: "L"
  },
  her: {
    role: "her",
    nickname: "WLY",
    avatar: "W"
  }
} as const;

export function profileOf(role?: "me" | "her") {
  return role ? userProfiles[role] : undefined;
}
