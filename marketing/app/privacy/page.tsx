import type { Metadata } from "next";

const LAST_UPDATED = "15 August 2026";

export const metadata: Metadata = {
  title: "Privacy Policy — ScoreHub",
  description:
    "How Samcorp Limited collects, uses, and protects personal information through ScoreHub.",
  alternates: {
    canonical: "/privacy",
  },
};

export default function PrivacyPage() {
  return (
    <main id="main-content">
      <div className="legal">
        <h1>Privacy Policy</h1>
        <p className="legal-updated">Last updated: {LAST_UPDATED}</p>

        <div className="legal-callout">
          <p>
            Samcorp Limited (<strong>Samcorp</strong>, <strong>we</strong>, <strong>us</strong>)
            respects your privacy. This policy explains what personal information ScoreHub
            collects, why, who we share it with, and the rights you have under New Zealand&apos;s
            Privacy Act 2020. It applies to account holders using the control panel and to
            anonymous visitors of our display pages and marketing site.
          </p>
        </div>

        <div className="legal-toc">
          <p>Contents</p>
          <ol>
            <li>
              <a href="#collect">Information we collect</a>
            </li>
            <li>
              <a href="#sources">How we collect it</a>
            </li>
            <li>
              <a href="#use">How we use it</a>
            </li>
            <li>
              <a href="#legal-basis">Our basis for processing</a>
            </li>
            <li>
              <a href="#sharing">Who we share it with</a>
            </li>
            <li>
              <a href="#cross-border">Overseas storage and disclosure</a>
            </li>
            <li>
              <a href="#cookies">Cookies and analytics</a>
            </li>
            <li>
              <a href="#security">Security</a>
            </li>
            <li>
              <a href="#retention">Retention</a>
            </li>
            <li>
              <a href="#rights">Your rights</a>
            </li>
            <li>
              <a href="#players">Player and team names</a>
            </li>
            <li>
              <a href="#children">Children&apos;s privacy</a>
            </li>
            <li>
              <a href="#changes">Changes to this policy</a>
            </li>
            <li>
              <a href="#contact">Contact and complaints</a>
            </li>
          </ol>
        </div>

        <h2 id="collect">1. Information we collect</h2>
        <h3>Account and contact information</h3>
        <p>
          When you or your organisation register for ScoreHub, we collect your name, email
          address, role within your organisation, and organisation details (name, type — e.g.
          venue, club, National Sporting Organisation).
        </p>
        <h3>Billing information</h3>
        <p>
          If you subscribe to a paid plan, our payment processor Stripe collects and stores your
          payment card and billing details directly. We receive and store subscription status,
          plan/add-on selection, and transaction references (such as invoice IDs) from Stripe — we
          do not receive or store full card numbers.
        </p>
        <h3>Match and scoring data</h3>
        <p>
          The Service processes live match state — scores, period/time, and configuration —
          entered by operators or fed from a connected console or third-party data source. This is
          generally not personal information about the operator, but may include team and player
          names entered by the operator (see section 11).
        </p>
        <h3>Usage and device information</h3>
        <p>
          We and our hosting/analytics providers may collect technical information such as IP
          address, browser type, device type, pages viewed, and timestamps, for the purposes
          described in section 3.
        </p>

        <h2 id="sources">2. How we collect it</h2>
        <p>We collect personal information:</p>
        <ul>
          <li>directly from you, when you register, subscribe, or contact us;</li>
          <li>
            from your organisation&apos;s administrators, when they invite you as a member or
            operator;
          </li>
          <li>
            automatically, through your use of the control panel, display pages, or marketing
            site (e.g. cookies, server logs); and
          </li>
          <li>from Stripe, limited to billing status and transaction references as above.</li>
        </ul>

        <h2 id="use">3. How we use it</h2>
        <p>We use personal information to:</p>
        <ul>
          <li>provide, operate, and maintain the Service, including authentication and access control;</li>
          <li>process subscriptions, billing, and plan entitlements;</li>
          <li>communicate with you about your account, matches, or changes to the Service;</li>
          <li>provide customer support;</li>
          <li>monitor, secure, and improve the Service, including diagnosing technical issues;</li>
          <li>comply with legal obligations; and</li>
          <li>
            with your consent or as permitted by law, send you marketing communications about
            ScoreHub (you can opt out at any time).
          </li>
        </ul>

        <h2 id="legal-basis">4. Our basis for processing</h2>
        <p>
          Samcorp is based in New Zealand and handles personal information in accordance with the{" "}
          <strong>Privacy Act 2020</strong> and its Information Privacy Principles. Where we
          process personal information of individuals in other jurisdictions with their own data
          protection laws (for example the EU/UK GDPR), we rely on performance of our contract
          with you, our legitimate interests in operating and securing the Service, and, where
          required, your consent.
        </p>

        <h2 id="sharing">5. Who we share it with</h2>
        <p>We disclose personal information only as needed to:</p>
        <ul>
          <li>
            <strong>Stripe, Inc.</strong> — payment processing and billing;
          </li>
          <li>
            <strong>Fly.io and Vercel</strong> — application hosting for the relay and frontend;
          </li>
          <li>
            <strong>Neon</strong> — database hosting (account, organisation, and match records);
          </li>
          <li>
            <strong>Upstash</strong> — caching/session infrastructure;
          </li>
          <li>
            other members of your organisation, to the extent your account and role visibility
            require it;
          </li>
          <li>
            a purchaser or successor in the event of a merger, acquisition, or sale of assets,
            subject to that party assuming obligations consistent with this policy; and
          </li>
          <li>law enforcement or regulators, where required by law.</li>
        </ul>
        <p>We do not sell personal information.</p>

        <h2 id="cross-border">6. Overseas storage and disclosure</h2>
        <p>
          Some of the providers listed in section 5 store or process data outside New Zealand
          (including in the United States, via their own data centres or subprocessors). Where we
          disclose personal information to an overseas person, we take reasonable steps to ensure
          it is subject to protections comparable to the Privacy Act 2020, including relying on
          those providers&apos; own compliance with recognised data protection frameworks (such as
          GDPR-standard contractual clauses, where applicable) and standard information privacy
          principles under section 19 of the Privacy Act 2020.
        </p>

        <h2 id="cookies">7. Cookies and analytics</h2>
        <p>
          Our marketing site and control panel use essential cookies (for example, to keep you
          signed in) and may use analytics cookies to understand how the Service is used. You can
          control cookies through your browser settings; disabling essential cookies may prevent
          the control panel from functioning correctly.
        </p>

        <h2 id="security">8. Security</h2>
        <p>
          We take reasonable technical and organisational measures to protect personal information
          against loss, misuse, and unauthorised access, including encrypted transport (TLS),
          hashed storage of long-lived tokens, and role-based access control. No method of
          transmission or storage is completely secure, and we cannot guarantee absolute security.
        </p>

        <h2 id="retention">9. Retention</h2>
        <p>
          We retain personal information for as long as your account is active, and afterwards for
          as long as reasonably necessary to comply with legal, accounting, or reporting
          obligations, resolve disputes, and enforce our agreements. Match/scoring data associated
          with a closed account may be retained for a limited period for support and record-keeping
          purposes before deletion.
        </p>

        <h2 id="rights">10. Your rights</h2>
        <p>
          Under the Privacy Act 2020, you have the right to access the personal information we
          hold about you and to request correction of it. To exercise these rights, contact us
          using the details in section 14. We will respond within the timeframes required by the
          Act, and may need to verify your identity before releasing information.
        </p>
        <p>
          If you believe we have interfered with your privacy and are not satisfied with our
          response, you may complain to the New Zealand{" "}
          <strong>Office of the Privacy Commissioner</strong> (privacy.org.nz).
        </p>

        <h2 id="players">11. Player and team names</h2>
        <p>
          Operators may enter player, team, or participant names into match data for display
          purposes. This is entered and controlled by the operator/organisation, not Samcorp — the
          operator is responsible for having any necessary consent to display that information
          publicly. If you are a player or participant and want a display removed or corrected,
          please contact the operator or organisation running that match in the first instance; we
          will assist where we reasonably can.
        </p>

        <h2 id="children">12. Children&apos;s privacy</h2>
        <p>
          The Service is intended for use by operators, administrators, and viewers who are 18 or
          older, or otherwise using it under adult supervision (e.g. school or club sport). We do
          not knowingly collect account information from children. Match data may reference junior
          participants (e.g. school sport) where entered by an operator with appropriate authority
          to do so.
        </p>

        <h2 id="changes">13. Changes to this policy</h2>
        <p>
          We may update this policy from time to time. We will update the &ldquo;Last
          updated&rdquo; date above and, for material changes, make reasonable efforts to notify
          account holders.
        </p>

        <h2 id="contact">14. Contact and complaints</h2>
        <p>
          Samcorp Limited (NZBN 9429051028626)
          <br />
          43 Grande Avenue, Mount Albert, Auckland, 1025, New Zealand
          <br />
          Email: <a href="mailto:hello@scorehub.co.nz">hello@scorehub.co.nz</a>
        </p>
        <p>
          See also our <a href="/terms">Terms of Use</a>.
        </p>
      </div>
    </main>
  );
}
