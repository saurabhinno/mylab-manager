## Plan: Mylab Blood Test Platform

TL;DR: Build a Next.js + MySQL lab reporting platform with two roles (doctor and compounder), doctor-managed test metadata and dashboards, compounder report creation with patient lookup and test result entry, image signature injection into reports, and printable lab report output.

**Steps**
1. Initialize the app: create a Next.js project with App Router, MySQL database access, and an ORM like Prisma.
2. Design the data model:
   - Doctor user accounts with `role`, `email`, `password`, and `signatureImage`.
   - Compounder user accounts.
   - Patient master records.
   - `TestDefinition` with `name`, `defaultMin`, `defaultMax`, `price`, and optional unit.
   - `Report` with patient info, date, compounder reference, doctor reference, status, and total price.
   - `ReportItem` with selected test, result type, value, note, and computed price.
3. Add authentication and role-based access:
   - Email/password login for doctor and compounder.
   - Separate doctor dashboard and compounder report UI.
   - Guard routes and API endpoints by role.
4. Implement doctor features:
   - Manage available tests with min/max, price, and units.
   - Upload or set a signature image that is included in printed reports.
   - View daily report metrics: total reports, total tests, total revenue, and a list of reports by day.
   - Optional: allow doctor to view/approve report drafts or report history.
5. Implement compounder workflow:
   - New report form with patient name autocomplete/search and ability to enter new patient details.
   - Auto-fill date to current day; capture age, weight, referred doctor, and remarks.
   - Select multiple tests from available definitions.
   - For each test, choose result type and enter result content:
     - numeric value with units or range markers,
     - categorical positive/negative,
     - textual high/low/normal notes.
   - Show calculated per-test and total price in real time.
   - Add confirmation steps before saving or submitting the report.
6. Build report generation and printable output:
   - Create a styled report page that matches medical lab format (header, patient info, test table, signature, footer).
   - Use print-specific CSS and a print button.
   - Ensure report includes doctor signature image and price totals.
7. Add UI confirmations and validation:
   - Confirm before deleting test definitions or reports.
   - Confirm before finalizing report submission.
   - Validate required fields and display inline errors.
8. Test and verify:
   - Create doctor and compounder accounts.
   - Add tests, create reports, check daily metrics, and print a report.
   - Validate that doctor signature appears on saved reports.

**Relevant files**
- `package.json` / `next.config.ts` — app setup and MySQL configuration.
- `prisma/schema.prisma` or equivalent ORM schema — database model.
- `app/(auth)/login/page.tsx` — authentication pages.
- `app/doctor/dashboard/page.tsx` — doctor admin dashboard.
- `app/doctor/tests/page.tsx` — test management.
- `app/compounder/reports/new/page.tsx` — report creation flow.
- `app/reports/[id]/page.tsx` — printable report view.
- `app/api/*` — REST or route handlers for tests, reports, patients, auth.
- `components/*` — shared form controls, confirmations, patient autocomplete.

**Verification**
1. Run the app, register or seed a doctor account, log in as doctor, and add test definitions.
2. Upload a signature image and confirm it persists.
3. Log in as compounder, create a report with existing and new patient data, select tests, enter mixed result types, and save.
4. Verify the report dashboard shows day-wise totals and revenue.
5. Use the print page and confirm the formatted report output includes the signature and totals.

**Decisions**
- Use a doctor as super-admin role and compounder as report creator.
- Support both patient search/autocomplete and free-text patient creation.
- Store doctor signature as an image asset referenced in every report.
- Use explicit confirm dialogs at save/submit/delete actions.

**Further Considerations**
1. Confirm whether both doctor and compounder should use email/password login or another auth method.
2. Confirm if patient onboarding should persist a patient record for reuse.
3. Confirm if doctor signature should be uploaded once or managed per report.
