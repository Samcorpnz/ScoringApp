export interface NavLink {
  title: string;
  href: string;
}

export interface NavSection {
  title: string;
  href: string;
  links: NavLink[];
}

export const SPORT_LINKS: NavLink[] = [
  { title: "Netball", href: "/sports/netball" },
  { title: "Basketball", href: "/sports/basketball" },
  { title: "Rugby Union", href: "/sports/rugby-union" },
  { title: "Rugby League", href: "/sports/rugby-league" },
  { title: "Volleyball", href: "/sports/volleyball" },
  { title: "Football", href: "/sports/football" },
  { title: "Handball", href: "/sports/handball" },
  { title: "Hockey", href: "/sports/hockey" },
  { title: "Water Polo", href: "/sports/water-polo" },
  { title: "Tennis", href: "/sports/tennis" },
  { title: "Touch Rugby", href: "/sports/touch-rugby" },
  { title: "Futsal", href: "/sports/futsal" },
  { title: "Pickleball", href: "/sports/pickleball" },
  { title: "Badminton", href: "/sports/badminton" },
  { title: "Table Tennis", href: "/sports/table-tennis" },
  { title: "Floorball", href: "/sports/floorball" },
  { title: "Squash", href: "/sports/squash" },
  { title: "Lawn Bowls", href: "/sports/lawn-bowls" },
  { title: "Indoor Cricket", href: "/sports/indoor-cricket" },
  { title: "Softball", href: "/sports/softball" },
  { title: "Cricket", href: "/sports/cricket" },
  { title: "Custom Sport", href: "/sports/custom" },
];

export const NAV: NavSection[] = [
  {
    title: "Getting started",
    href: "/getting-started",
    links: [
      { title: "Getting started", href: "/getting-started" },
      { title: "Connecting a console (Bridge)", href: "/connecting-the-bridge" },
      { title: "Displaying your score", href: "/displaying-your-score" },
    ],
  },
  {
    title: "Sports",
    href: "/sports",
    links: SPORT_LINKS,
  },
  {
    title: "Account management",
    href: "/account",
    links: [
      { title: "Account overview", href: "/account" },
      { title: "Roles & permissions", href: "/account/roles-and-permissions" },
      { title: "Inviting your team", href: "/account/inviting-your-team" },
      { title: "Switching organisations", href: "/account/switching-organisations" },
    ],
  },
  {
    title: "Billing",
    href: "/billing",
    links: [
      { title: "Plans & pricing", href: "/billing" },
      { title: "Upgrading & downgrading", href: "/billing/upgrading-and-downgrading" },
      { title: "Graphics Operator add-on", href: "/billing/graphics-addon" },
      { title: "Invoices & payment methods", href: "/billing/invoices-and-payment-methods" },
      { title: "Cancelling your plan", href: "/billing/cancelling" },
    ],
  },
  {
    title: "Support",
    href: "/support",
    links: [
      { title: "Contact support", href: "/support" },
      { title: "Troubleshooting", href: "/support/troubleshooting" },
    ],
  },
];
