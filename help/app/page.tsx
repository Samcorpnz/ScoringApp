const CATEGORIES = [
  {
    href: "/getting-started",
    title: "Getting started",
    description: "Create your first match, score it from the control panel, and get your score on screen.",
  },
  {
    href: "/sports",
    title: "Sports",
    description: "Setup and scoring guides for every sport ScoreHub supports.",
  },
  {
    href: "/account",
    title: "Account management",
    description: "Roles, inviting your team, and switching between organisations.",
  },
  {
    href: "/billing",
    title: "Billing",
    description: "Plans, add-ons, upgrading, invoices, and cancelling.",
  },
  {
    href: "/support",
    title: "Support",
    description: "Troubleshooting and how to reach the ScoreHub team.",
  },
];

export default function HelpHome() {
  return (
    <>
      <div className="hero">
        <h1>How can we help?</h1>
        <p>
          Setup guides for every sport, plus everything on running matches, managing your
          organisation, and billing.
        </p>
      </div>
      <div className="category-grid">
        {CATEGORIES.map(c => (
          <a key={c.href} href={c.href} className="category-card">
            <h2>{c.title}</h2>
            <p>{c.description}</p>
          </a>
        ))}
      </div>
    </>
  );
}
