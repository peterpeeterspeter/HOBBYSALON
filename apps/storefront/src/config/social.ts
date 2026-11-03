/**
 * Official Hobbysalon social media accounts. Add TikTok here when the
 * account exists; the banner and the Organization schema pick it up.
 */
export type SocialChannel = {
  id: "facebook" | "instagram" | "pinterest" | "youtube" | "tiktok";
  label: string;
  /** Profile URL; YouTube opens the subscribe prompt straight away. */
  href: string;
  /** Brand colour for the icon tile. */
  color: string;
  /** Verb used on the button. */
  action: string;
};

export const SOCIAL_CHANNELS: SocialChannel[] = [
  {
    id: "facebook",
    label: "Facebook",
    href: "https://www.facebook.com/profile.php?id=100087126786376",
    color: "#1877F2",
    action: "Volg",
  },
  {
    id: "instagram",
    label: "Instagram",
    href: "https://www.instagram.com/hobby.salon/",
    color: "#E4405F",
    action: "Volg",
  },
  {
    id: "pinterest",
    label: "Pinterest",
    href: "https://www.pinterest.com/inspiredbyhobbysalon/",
    color: "#BD081C",
    action: "Volg",
  },
  {
    id: "youtube",
    label: "YouTube",
    href: "https://www.youtube.com/channel/UCpn5F3OkZJFofeqKFuF0B8g?sub_confirmation=1",
    color: "#FF0000",
    action: "Abonneer",
  },
];

/** Plain profile URLs for schema.org sameAs. */
export const SOCIAL_PROFILE_URLS = SOCIAL_CHANNELS.map((channel) => channel.href.split("?sub_confirmation")[0]);

/**
 * Link to the contest rules. Keep null until the rules are published; the
 * banner then says the rules follow.
 */
export const SOCIAL_CONTEST_RULES_HREF: string | null = null;
