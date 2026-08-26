import 'dotenv/config';

import { prisma } from '@/lib/prisma';
import { DEMO_USERS } from '@/lib/demo-users';
import { DEMO_WORKSPACE_ID } from '@/lib/demo-workspace';

/**
 * Loads a realistic demo dataset into `DEMO_WORKSPACE_ID`, which the app
 * defaults to on a fresh browser. Safe to re-run: it clears that workspace
 * first, so `npm run db:seed` always leaves the same known-good state.
 */

const WORKSPACE_ID = DEMO_WORKSPACE_ID;
const [HECTOR, SARAH, MARCUS] = DEMO_USERS.map((u) => u.id);
const owners = [HECTOR, SARAH, MARCUS];
const ownerOf = (i: number) => owners[i % owners.length]!;

async function reset() {
  await prisma.chatMessage.deleteMany({ where: { workspace_id: WORKSPACE_ID } });
  await prisma.chatSession.deleteMany({ where: { workspace_id: WORKSPACE_ID } });
  await prisma.chatAuthCode.deleteMany({ where: { workspace_id: WORKSPACE_ID } });
  await prisma.chatConversation.deleteMany({ where: { workspace_id: WORKSPACE_ID } });
  await prisma.chatContact.deleteMany({ where: { workspace_id: WORKSPACE_ID } });
  await prisma.chatChannel.deleteMany({ where: { workspace_id: WORKSPACE_ID } });
  await prisma.note.deleteMany({ where: { workspace_id: WORKSPACE_ID } });
  await prisma.incidentCase.deleteMany({ where: { workspace_id: WORKSPACE_ID } });
  await prisma.entityPerson.deleteMany({ where: { workspace_id: WORKSPACE_ID } });
  await prisma.deal.deleteMany({ where: { workspace_id: WORKSPACE_ID } });
  await prisma.supportCase.deleteMany({ where: { workspace_id: WORKSPACE_ID } });
  await prisma.featureRequest.deleteMany({ where: { workspace_id: WORKSPACE_ID } });
  await prisma.incident.deleteMany({ where: { workspace_id: WORKSPACE_ID } });
  await prisma.person.deleteMany({ where: { workspace_id: WORKSPACE_ID } });
  await prisma.entity.deleteMany({ where: { workspace_id: WORKSPACE_ID } });
}

async function seedEntities() {
  const rows = [
    { name: 'Acme Corporation', entity_type: 'company', relationship_stage: 'customer', primary_domain: 'acme.example', primary_email: 'hello@acme.example', city: 'Austin', region: 'TX', country_code: 'US', description: 'Industrial hardware manufacturer, our largest account.' },
    { name: 'Wayne Foundation', entity_type: 'nonprofit', relationship_stage: 'partner', primary_domain: 'waynefoundation.example', city: 'Gotham', region: 'NJ', country_code: 'US', description: 'Philanthropic partner on the community outreach program.' },
    { name: 'Globex Industries', entity_type: 'company', relationship_stage: 'prospect', primary_domain: 'globex.example', city: 'Chicago', region: 'IL', country_code: 'US' },
    { name: 'Initech', entity_type: 'company', relationship_stage: 'customer', primary_domain: 'initech.example', city: 'Dallas', region: 'TX', country_code: 'US' },
    { name: 'Stark Industries', entity_type: 'company', relationship_stage: 'customer', primary_domain: 'stark.example', city: 'New York', region: 'NY', country_code: 'US', description: 'Enterprise account, multiple active deals.' },
    { name: 'Springfield School District', entity_type: 'education', relationship_stage: 'prospect', primary_domain: 'springfield-sd.example', city: 'Springfield', region: 'IL', country_code: 'US' },
    { name: 'Metro Transit Authority', entity_type: 'government', relationship_stage: 'customer', primary_domain: 'metrotransit.example', city: 'Seattle', region: 'WA', country_code: 'US' },
    { name: 'Umbrella Health', entity_type: 'company', relationship_stage: 'former_customer', primary_domain: 'umbrella-health.example', city: 'Raccoon City', region: 'MI', country_code: 'US' },
  ] as const;

  const created = [];
  for (const [i, row] of rows.entries()) {
    created.push(
      await prisma.entity.create({
        data: { workspace_id: WORKSPACE_ID, owner_user_id: ownerOf(i), created_by_user_id: ownerOf(i), ...row },
      }),
    );
  }
  return created;
}

async function seedPeople() {
  const rows = [
    { first_name: 'Jane', last_name: 'Smith', primary_email: 'jane.smith@acme.example', primary_phone: '512-555-0101' },
    { first_name: 'John', last_name: 'Doe', primary_email: 'john.doe@acme.example', primary_phone: '512-555-0102' },
    { first_name: 'Maria', last_name: 'Lopez', primary_email: 'maria.lopez@acme.example' },
    { first_name: 'Alfred', last_name: 'Pennyworth', primary_email: 'alfred@waynefoundation.example' },
    { first_name: 'Lucius', last_name: 'Fox', primary_email: 'lucius@waynefoundation.example' },
    { first_name: 'Hank', last_name: 'Scorpio', primary_email: 'hank@globex.example' },
    { first_name: 'Peter', last_name: 'Gibbons', primary_email: 'peter@initech.example' },
    { first_name: 'Samir', last_name: 'Nagheenanajar', primary_email: 'samir@initech.example' },
    { first_name: 'Pepper', last_name: 'Potts', primary_email: 'pepper@stark.example', primary_phone: '212-555-0110' },
    { first_name: 'Happy', last_name: 'Hogan', primary_email: 'happy@stark.example' },
    { first_name: 'Seymour', last_name: 'Skinner', primary_email: 'skinner@springfield-sd.example' },
    { first_name: 'Edna', last_name: 'Krabappel', primary_email: 'edna@springfield-sd.example' },
  ] as const;

  const created = [];
  for (const [i, row] of rows.entries()) {
    created.push(
      await prisma.person.create({
        data: { workspace_id: WORKSPACE_ID, owner_user_id: ownerOf(i), created_by_user_id: ownerOf(i), ...row },
      }),
    );
  }
  return created;
}

async function main() {
  console.log(`Seeding workspace ${WORKSPACE_ID}…`);
  await reset();

  // Umbrella Health is seeded as a former customer but has no other seed data pointing at it —
  // it exists so the "former_customer" stage and an empty related-records page both have an example.
  const [acme, wayne, globex, initech, stark, springfield, metro] = await seedEntities();
  const [jane, john, maria, alfred, lucius, hank, peter, samir, pepper, happy, skinner, edna] = await seedPeople();

  await prisma.entityPerson.createMany({
    data: [
      { workspace_id: WORKSPACE_ID, entity_id: acme.id, person_id: jane.id, relationship_type: 'employee', job_title: 'VP Engineering', is_primary_contact: true, status: 'current' },
      { workspace_id: WORKSPACE_ID, entity_id: acme.id, person_id: john.id, relationship_type: 'employee', job_title: 'CFO', status: 'current' },
      { workspace_id: WORKSPACE_ID, entity_id: acme.id, person_id: maria.id, relationship_type: 'employee', job_title: 'Director of Operations', status: 'current' },
      { workspace_id: WORKSPACE_ID, entity_id: wayne.id, person_id: alfred.id, relationship_type: 'board_member', job_title: 'Board Chair', is_primary_contact: true, status: 'current' },
      { workspace_id: WORKSPACE_ID, entity_id: wayne.id, person_id: lucius.id, relationship_type: 'advisor', job_title: 'Technology Advisor', status: 'current' },
      { workspace_id: WORKSPACE_ID, entity_id: globex.id, person_id: hank.id, relationship_type: 'owner', job_title: 'CEO', is_primary_contact: true, status: 'current' },
      { workspace_id: WORKSPACE_ID, entity_id: initech.id, person_id: peter.id, relationship_type: 'employee', job_title: 'Software Engineer', is_primary_contact: true, status: 'current' },
      { workspace_id: WORKSPACE_ID, entity_id: initech.id, person_id: samir.id, relationship_type: 'employee', job_title: 'Software Engineer', status: 'former', ended_on: new Date('2025-06-01') },
      { workspace_id: WORKSPACE_ID, entity_id: stark.id, person_id: pepper.id, relationship_type: 'employee', job_title: 'CEO', is_primary_contact: true, status: 'current' },
      { workspace_id: WORKSPACE_ID, entity_id: stark.id, person_id: happy.id, relationship_type: 'employee', job_title: 'Head of Security', status: 'current' },
      // Happy also consults for Wayne Foundation — the multi-entity case the Entity↔Person view is for.
      { workspace_id: WORKSPACE_ID, entity_id: wayne.id, person_id: happy.id, relationship_type: 'contractor', job_title: 'Security Consultant', status: 'current' },
      { workspace_id: WORKSPACE_ID, entity_id: springfield.id, person_id: skinner.id, relationship_type: 'employee', job_title: 'Principal', is_primary_contact: true, status: 'current' },
      { workspace_id: WORKSPACE_ID, entity_id: springfield.id, person_id: edna.id, relationship_type: 'employee', job_title: 'Teacher', status: 'current' },
    ],
  });

  const dealRows = [
      { name: 'Enterprise Upgrade', entity_id: acme.id, primary_contact_person_id: jane.id, stage: 'negotiation', amount: '220000.00', probability: 70, next_step: 'Legal review of MSA redlines', owner_user_id: HECTOR },
      { name: 'Services Expansion', entity_id: acme.id, primary_contact_person_id: john.id, stage: 'discovery', amount: '75000.00', probability: 30, owner_user_id: HECTOR },
      { name: 'Community Program Renewal', entity_id: wayne.id, primary_contact_person_id: alfred.id, stage: 'proposal', amount: '48000.00', probability: 55, owner_user_id: SARAH },
      { name: 'Pilot Rollout', entity_id: globex.id, primary_contact_person_id: hank.id, stage: 'qualification', amount: '15000.00', probability: 15, owner_user_id: MARCUS },
      { name: 'Platform Migration', entity_id: initech.id, primary_contact_person_id: peter.id, stage: 'won', amount: '132000.00', probability: 100, closed_at: new Date('2026-06-15'), owner_user_id: HECTOR },
      { name: 'Legacy System Replacement', entity_id: stark.id, primary_contact_person_id: pepper.id, stage: 'negotiation', amount: '410000.00', probability: 80, next_step: 'Final pricing approval from procurement', owner_user_id: SARAH },
      { name: 'Transit Fleet Analytics', entity_id: metro.id, stage: 'lost', amount: '60000.00', probability: 0, closed_at: new Date('2026-04-02'), lost_reason: 'Budget frozen for the fiscal year', owner_user_id: MARCUS },
  ] as const;
  const deals = await Promise.all(
    dealRows.map((row, i) => prisma.deal.create({ data: { workspace_id: WORKSPACE_ID, created_by_user_id: ownerOf(i), ...row } })),
  );

  const caseRows = [
      { case_number: 'CASE-1029', subject: 'Login issue after SSO rollout', description: 'Users intermittently bounced back to the login page after SSO redirect.', entity_id: acme.id, reported_by_person_id: jane.id, status: 'open', priority: 'high', category: 'Authentication', source: 'email', owner_user_id: HECTOR },
      { case_number: 'CASE-1098', subject: 'Billing question on latest invoice', description: 'Customer asking about a proration line item.', entity_id: acme.id, reported_by_person_id: john.id, status: 'closed', priority: 'low', category: 'Billing', source: 'email', resolved_at: new Date('2026-08-10'), resolution: 'Explained proration; no billing error.', owner_user_id: SARAH },
      { case_number: 'CASE-1104', subject: 'API rate limit errors during batch import', description: '429s during nightly batch jobs starting this week.', entity_id: stark.id, reported_by_person_id: happy.id, status: 'open', priority: 'urgent', category: 'API', source: 'phone', owner_user_id: HECTOR },
      { case_number: 'CASE-1107', subject: 'Dashboard fails to load for one user', description: 'Single user reports a blank dashboard; others on the team are fine.', entity_id: stark.id, reported_by_person_id: pepper.id, status: 'pending', priority: 'medium', category: 'UI', source: 'web', owner_user_id: SARAH },
      { case_number: 'CASE-1112', subject: 'Export CSV missing custom fields', description: 'Custom fields added last month are not appearing in CSV export.', entity_id: initech.id, reported_by_person_id: peter.id, status: 'new', priority: 'medium', category: 'Reporting', source: 'web', owner_user_id: MARCUS },
      { case_number: 'CASE-1120', subject: 'Onboarding walkthrough request', description: 'New team members need a refresher on the reporting module.', entity_id: wayne.id, reported_by_person_id: alfred.id, status: 'resolved', priority: 'low', category: 'Training', source: 'internal', resolved_at: new Date('2026-08-05'), resolution: 'Scheduled and completed a live walkthrough.', owner_user_id: SARAH },
      { case_number: 'CASE-1131', subject: 'Slow report generation for large workspace', description: 'Pipeline report takes over a minute to generate for this account.', entity_id: metro.id, status: 'open', priority: 'high', category: 'Performance', source: 'integration', owner_user_id: MARCUS },
  ] as const;
  const cases = await Promise.all(
    caseRows.map((row, i) => prisma.supportCase.create({ data: { workspace_id: WORKSPACE_ID, created_by_user_id: ownerOf(i), ...row } })),
  );

  const incidentRows = [
      { incident_number: 'INC-201', title: 'SSO provider outage', description: 'Upstream identity provider had a partial outage affecting login for several customers.', status: 'monitoring', severity: 'high', started_at: new Date('2026-08-22T14:00:00Z'), identified_at: new Date('2026-08-22T14:20:00Z'), root_cause: 'Upstream IdP certificate rotation was not propagated in time.', public_update: 'We are monitoring the fix from our identity provider.' },
      { incident_number: 'INC-207', title: 'API gateway rate limiter misconfiguration', description: 'A rate-limit config change was too aggressive for batch workloads.', status: 'identified', severity: 'medium', started_at: new Date('2026-08-23T09:00:00Z'), identified_at: new Date('2026-08-23T09:45:00Z') },
      { incident_number: 'INC-214', title: 'Report worker backlog', description: 'Elevated queue depth on the reporting worker during a traffic spike.', status: 'resolved', severity: 'low', started_at: new Date('2026-08-10T02:00:00Z'), identified_at: new Date('2026-08-10T02:10:00Z'), resolved_at: new Date('2026-08-10T04:00:00Z'), closed_at: new Date('2026-08-10T04:30:00Z'), resolution: 'Scaled worker concurrency and cleared the backlog.' },
  ] as const;
  const incidents = await Promise.all(
    incidentRows.map((row, i) => prisma.incident.create({ data: { workspace_id: WORKSPACE_ID, created_by_user_id: ownerOf(i), ...row } })),
  );

  await prisma.incidentCase.createMany({
    data: [
      { workspace_id: WORKSPACE_ID, incident_id: incidents[0]!.id, case_id: cases[0]!.id, entity_id: acme.id, impact_level: 'major', impact_description: 'Multiple users locked out during business hours.' },
      { workspace_id: WORKSPACE_ID, incident_id: incidents[1]!.id, case_id: cases[2]!.id, entity_id: stark.id, impact_level: 'critical', impact_description: 'Nightly batch import failing entirely.' },
      { workspace_id: WORKSPACE_ID, incident_id: incidents[2]!.id, case_id: cases[6]!.id, entity_id: metro.id, impact_level: 'moderate' },
    ],
  });

  const requestRows = [
    { request_number: 'REQ-204', title: 'SSO enhancement: SCIM provisioning', description: 'Automate user provisioning/deprovisioning via SCIM.', entity_id: acme.id, requested_by_person_id: jane.id, status: 'in_progress', priority: 'high', category: 'Security', business_need: 'Manual user management does not scale past 200 seats.', owner_user_id: HECTOR },
    { request_number: 'REQ-283', title: 'Advanced reporting: cohort breakdowns', description: 'Ability to segment the pipeline report by acquisition cohort.', entity_id: acme.id, requested_by_person_id: john.id, status: 'under_review', priority: 'medium', owner_user_id: SARAH },
    { request_number: 'REQ-301', title: 'Bulk case reassignment', description: 'Reassign many cases to a new owner in one action.', entity_id: stark.id, requested_by_person_id: happy.id, status: 'planned', priority: 'medium', target_date: new Date('2026-10-01'), owner_user_id: HECTOR },
    { request_number: 'REQ-318', title: 'Dark mode for the client portal', description: 'Customer-facing portal should respect OS theme.', entity_id: wayne.id, requested_by_person_id: alfred.id, status: 'submitted', priority: 'low', owner_user_id: SARAH },
    { request_number: 'REQ-329', title: 'Public status page', description: 'A status page customers can check during incidents.', status: 'declined', priority: 'low', decision_notes: 'Out of scope for this year — revisit next planning cycle.', owner_user_id: MARCUS },
  ] as const;
  await Promise.all(
    requestRows.map((row, i) => prisma.featureRequest.create({ data: { workspace_id: WORKSPACE_ID, created_by_user_id: ownerOf(i), ...row } })),
  );

  await prisma.note.createMany({
    data: [
      { workspace_id: WORKSPACE_ID, parent_type: 'entity', parent_id: acme.id, kind: 'note', body: 'Customer interested in expanding the contract to cover two more business units.', created_by_user_id: HECTOR },
      { workspace_id: WORKSPACE_ID, parent_type: 'entity', parent_id: acme.id, kind: 'note', body: 'Quarterly business review went well — champion (Jane) is pushing internally for the upgrade.', created_by_user_id: HECTOR },
      { workspace_id: WORKSPACE_ID, parent_type: 'deal', parent_id: deals[0]!.id, kind: 'system', body: 'Stage changed from Proposal → Negotiation', created_by_user_id: HECTOR },
      { workspace_id: WORKSPACE_ID, parent_type: 'deal', parent_id: deals[4]!.id, kind: 'system', body: 'Closed as Won 🎉', created_by_user_id: HECTOR },
      { workspace_id: WORKSPACE_ID, parent_type: 'case', parent_id: cases[0]!.id, kind: 'note', body: 'Escalated to engineering — likely tied to the SSO certificate rotation incident.', created_by_user_id: SARAH },
      { workspace_id: WORKSPACE_ID, parent_type: 'incident', parent_id: incidents[0]!.id, kind: 'note', body: 'Identity provider confirmed a fix is rolling out; expect resolution within the hour.', created_by_user_id: MARCUS },
    ],
  });

  // Two instances of the chat tool, configured for opposite jobs: the pair the
  // README walks through, and the quickest way to see that the deal/case and
  // guest/verified choices really are per-channel.
  const channelRows = [
    {
      name: 'Website sales chat',
      key: 'sales',
      description: 'Chat box on the marketing site. Opens a deal so nobody has to re-key an inbound lead.',
      intake_mode: 'deal',
      auth_mode: 'none',
      greeting: 'Interested in open-rm? Ask us anything.',
      collect_name: true,
      collect_email: true,
      deal_stage: 'qualification',
      owner_user_id: HECTOR,
      default_assignee_user_id: HECTOR,
    },
    {
      name: 'Customer support',
      key: 'support',
      description: 'Signed-in support desk. Verifies the customer by email, then opens a case.',
      intake_mode: 'case',
      auth_mode: 'required',
      greeting: 'Tell us what is going wrong and we will pick it up from here.',
      collect_name: true,
      collect_email: true,
      case_priority: 'medium',
      case_category: 'Support',
      owner_user_id: SARAH,
      default_assignee_user_id: SARAH,
    },
  ] as const;
  await Promise.all(
    channelRows.map((row, i) =>
      prisma.chatChannel.create({ data: { workspace_id: WORKSPACE_ID, created_by_user_id: ownerOf(i), ...row } }),
    ),
  );

  console.log('Seeded:');
  console.log(`  Entities:  8`);
  console.log(`  People:    12`);
  console.log(`  Deals:     ${deals.length}`);
  console.log(`  Cases:     ${cases.length}`);
  console.log(`  Incidents: ${incidents.length}`);
  console.log(`  Requests:  5`);
  console.log(`  Chat channels: ${channelRows.length} (/chat/widget/sales, /chat/widget/support)`);
  console.log('');
  console.log(`Workspace id (already the app's default): ${WORKSPACE_ID}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
