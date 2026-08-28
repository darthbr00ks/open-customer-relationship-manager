import 'dotenv/config';

import { prisma } from '@/lib/prisma';
import { DEMO_USERS } from '@/lib/demo-users';
import { DEMO_WORKSPACE_ID } from '@/lib/demo-workspace';
import { acceptQuote, createQuoteFromDeal, shipShipment } from '@/lib/selling/flow';
import { amendSubscription } from '@/lib/selling/subscriptions';

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
  // Selling, deepest first — usage hangs off entitlements, which hang off
  // subscriptions, which point back at order lines and the catalog.
  await prisma.usageRecord.deleteMany({ where: { workspace_id: WORKSPACE_ID } });
  await prisma.entitlement.deleteMany({ where: { workspace_id: WORKSPACE_ID } });
  await prisma.subscriptionAmendment.deleteMany({ where: { workspace_id: WORKSPACE_ID } });
  await prisma.subscription.deleteMany({ where: { workspace_id: WORKSPACE_ID } });
  await prisma.serviceMilestone.deleteMany({ where: { workspace_id: WORKSPACE_ID } });
  await prisma.serviceDelivery.deleteMany({ where: { workspace_id: WORKSPACE_ID } });
  await prisma.shipmentLine.deleteMany({ where: { workspace_id: WORKSPACE_ID } });
  await prisma.shipment.deleteMany({ where: { workspace_id: WORKSPACE_ID } });
  await prisma.orderLine.deleteMany({ where: { workspace_id: WORKSPACE_ID } });
  await prisma.order.deleteMany({ where: { workspace_id: WORKSPACE_ID } });
  await prisma.quoteLine.deleteMany({ where: { workspace_id: WORKSPACE_ID } });
  await prisma.quote.deleteMany({ where: { workspace_id: WORKSPACE_ID } });
  await prisma.dealLine.deleteMany({ where: { workspace_id: WORKSPACE_ID } });
  await prisma.bundleComponent.deleteMany({ where: { workspace_id: WORKSPACE_ID } });
  await prisma.priceTier.deleteMany({ where: { workspace_id: WORKSPACE_ID } });
  await prisma.price.deleteMany({ where: { workspace_id: WORKSPACE_ID } });
  await prisma.priceBook.deleteMany({ where: { workspace_id: WORKSPACE_ID } });
  await prisma.inventoryItem.deleteMany({ where: { workspace_id: WORKSPACE_ID } });
  await prisma.serviceDefinition.deleteMany({ where: { workspace_id: WORKSPACE_ID } });
  await prisma.offering.deleteMany({ where: { workspace_id: WORKSPACE_ID } });
  await prisma.product.deleteMany({ where: { workspace_id: WORKSPACE_ID } });

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

/* -------------------------------------------------------------------------- */
/* Selling                                                                     */
/* -------------------------------------------------------------------------- */

const product = (row: Record<string, unknown>, i: number) =>
  prisma.product.create({
    data: { workspace_id: WORKSPACE_ID, owner_user_id: ownerOf(i), created_by_user_id: ownerOf(i), status: 'active', ...row },
  } as never);

const offering = (product_id: string, row: Record<string, unknown>, i: number) =>
  prisma.offering.create({
    data: { workspace_id: WORKSPACE_ID, product_id, owner_user_id: ownerOf(i), created_by_user_id: ownerOf(i), ...row },
  } as never);

const price = (offering_id: string, row: Record<string, unknown>) =>
  prisma.price.create({ data: { workspace_id: WORKSPACE_ID, offering_id, ...row } } as never);

/**
 * A catalog covering the selling models the schema is built for: a per-seat
 * subscription with a setup fee and usage overage, fixed-fee and hourly
 * services, a physical good with stock, a tiered usage product, and a bundle
 * that mixes all three fulfillment paths.
 */
async function seedCatalog() {
  const [platform, services, hardware, screening] = await Promise.all([
    product({ name: 'Relationship Management Platform', category: 'software', tax_category: 'SaaS', description: 'The product this workspace runs on.' }, 0),
    product({ name: 'Professional Services', category: 'consulting', tax_category: 'Services' }, 1),
    product({ name: 'Site Security Hardware', category: 'hardware', tax_category: 'Tangible goods' }, 2),
    product({ name: 'Background Screening', category: 'software', tax_category: 'SaaS' }, 3),
  ]);

  // One product, two packages, two billing frequencies — which is exactly why a
  // product carries no price of its own.
  const pro = await offering(platform.id, {
    sku: 'PLAT-PRO-MO', name: 'Professional Plan', offering_type: 'subscription', unit_of_measure: 'user',
    fulfillment_policy: 'digital_activation', description: 'Per-seat plan billed monthly, with API usage included.',
  }, 0);
  await price(pro.id, { name: 'Setup', charge_type: 'one_time', pricing_model: 'flat', unit_amount: '1000' });
  await price(pro.id, { name: 'Monthly', charge_type: 'recurring', pricing_model: 'per_unit', unit_amount: '25', billing_period: 'month', minimum_quantity: '5' });
  await price(pro.id, { name: 'API calls', charge_type: 'usage', pricing_model: 'per_unit', unit_amount: '0.02', included_quantity: '10000', unit_of_measure: 'call' });

  const enterprise = await offering(platform.id, {
    sku: 'PLAT-ENT-YR', name: 'Enterprise Plan, billed annually', offering_type: 'subscription', unit_of_measure: 'user',
    fulfillment_policy: 'digital_activation', description: 'Annual commitment with volume seat pricing.',
  }, 1);
  const enterpriseSeats = await price(enterprise.id, {
    name: 'Annual', charge_type: 'recurring', pricing_model: 'volume', billing_period: 'year',
  });
  await prisma.priceTier.createMany({
    data: [
      { workspace_id: WORKSPACE_ID, price_id: enterpriseSeats.id, up_to: '50', unit_amount: '240' },
      { workspace_id: WORKSPACE_ID, price_id: enterpriseSeats.id, up_to: '250', unit_amount: '210' },
      { workspace_id: WORKSPACE_ID, price_id: enterpriseSeats.id, up_to: null, unit_amount: '180' },
    ],
  });

  const onboarding = await offering(services.id, {
    sku: 'SVC-ONBOARD', name: 'Onboarding', offering_type: 'service', unit_of_measure: 'engagement',
    fulfillment_policy: 'scheduled_work', description: 'Fixed-fee implementation: data migration, configuration, and training.',
  }, 2);
  await price(onboarding.id, { charge_type: 'one_time', pricing_model: 'flat', unit_amount: '5000' });
  await prisma.serviceDefinition.create({
    data: {
      workspace_id: WORKSPACE_ID, offering_id: onboarding.id, scope_type: 'fixed', estimated_hours: '40',
      delivery_location: 'Remote', required_skills: 'Implementation consultant',
      service_level_agreement: 'Kickoff within five business days of the order.',
      included_deliverables: 'Migrated data, configured workspace, two training sessions.',
      cancellation_policy: 'Full refund if canceled before kickoff.',
    },
  });

  const consulting = await offering(services.id, {
    sku: 'SVC-CONSULT-HR', name: 'Consulting', offering_type: 'service', unit_of_measure: 'hour',
    fulfillment_policy: 'scheduled_work', description: 'Time and materials, billed against a retainer or as used.',
  }, 3);
  await price(consulting.id, { charge_type: 'usage', pricing_model: 'per_unit', unit_amount: '200' });
  await prisma.serviceDefinition.create({
    data: {
      workspace_id: WORKSPACE_ID, offering_id: consulting.id, scope_type: 'flexible', estimated_hours: '20',
      delivery_location: 'Remote or on-site', required_skills: 'Solution architect',
      scheduling_notes: 'Booked in half-day blocks.', cancellation_policy: '48 hours notice.',
    },
  });

  const sensor = await offering(hardware.id, {
    sku: 'HW-SENSOR-1', name: 'Door Sensor', offering_type: 'good', unit_of_measure: 'each',
    fulfillment_policy: 'shipping', description: 'Wireless door sensor, batteries included.',
    attributes: { color: 'white', wireless_protocol: 'Zigbee' },
  }, 0);
  await price(sensor.id, { charge_type: 'one_time', pricing_model: 'per_unit', unit_amount: '120' });
  await prisma.inventoryItem.createMany({
    data: [
      { workspace_id: WORKSPACE_ID, offering_id: sensor.id, location_code: 'WH-AUSTIN', location_name: 'Austin warehouse', quantity_on_hand: '250', reorder_point: '50', requires_serial_number: true },
      { workspace_id: WORKSPACE_ID, offering_id: sensor.id, location_code: 'WH-RENO', location_name: 'Reno warehouse', quantity_on_hand: '40', reorder_point: '25', requires_serial_number: true },
    ],
  });

  const monitoring = await offering(hardware.id, {
    sku: 'SUB-MONITOR-MO', name: 'Site Monitoring', offering_type: 'subscription', unit_of_measure: 'device',
    fulfillment_policy: 'digital_activation', description: 'Round-the-clock monitoring for installed devices.',
  }, 1);
  await price(monitoring.id, { name: 'Monthly', charge_type: 'recurring', pricing_model: 'per_unit', unit_amount: '12', billing_period: 'month' });

  const install = await offering(services.id, {
    sku: 'SVC-INSTALL', name: 'Installation', offering_type: 'service', unit_of_measure: 'site',
    fulfillment_policy: 'scheduled_work', description: 'On-site installation and commissioning.',
  }, 2);
  await price(install.id, { charge_type: 'one_time', pricing_model: 'flat', unit_amount: '450' });

  // The spec's own bundle example: one device, one installation, twelve months
  // of monitoring — three fulfillment paths under one thing to buy.
  const packageOffering = await offering(hardware.id, {
    sku: 'PKG-SITE-SECURITY', name: 'Site Security Package', offering_type: 'bundle', unit_of_measure: 'site',
    fulfillment_policy: 'none', description: 'Sensor, installation, and a year of monitoring.',
  }, 3);
  await price(packageOffering.id, { charge_type: 'one_time', pricing_model: 'per_unit', unit_amount: '1400' });
  await prisma.bundleComponent.createMany({
    data: [
      { workspace_id: WORKSPACE_ID, parent_offering_id: packageOffering.id, child_offering_id: sensor.id, default_quantity: '4', sort_order: 0 },
      { workspace_id: WORKSPACE_ID, parent_offering_id: packageOffering.id, child_offering_id: install.id, default_quantity: '1', sort_order: 1 },
      { workspace_id: WORKSPACE_ID, parent_offering_id: packageOffering.id, child_offering_id: monitoring.id, default_quantity: '4', sort_order: 2 },
    ],
  });

  const checks = await offering(screening.id, {
    sku: 'BGC-STANDARD', name: 'Standard Background Check', offering_type: 'subscription', unit_of_measure: 'check',
    fulfillment_policy: 'digital_activation', description: 'Priced per check, cheaper as volume grows.',
  }, 0);
  await price(checks.id, { name: 'Platform fee', charge_type: 'recurring', pricing_model: 'flat', unit_amount: '99', billing_period: 'month' });
  const checkUsage = await price(checks.id, { name: 'Checks run', charge_type: 'usage', pricing_model: 'graduated', unit_of_measure: 'check' });
  await prisma.priceTier.createMany({
    data: [
      { workspace_id: WORKSPACE_ID, price_id: checkUsage.id, up_to: '100', unit_amount: '2' },
      { workspace_id: WORKSPACE_ID, price_id: checkUsage.id, up_to: '500', unit_amount: '1.5' },
      { workspace_id: WORKSPACE_ID, price_id: checkUsage.id, up_to: null, unit_amount: '1' },
    ],
  });

  // A government price list, to show that a price book beats the list price
  // without the list price being edited.
  const book = await prisma.priceBook.create({
    data: {
      workspace_id: WORKSPACE_ID, code: 'GOV', name: 'Government price list',
      description: 'Negotiated rates for public-sector customers.', currency_code: 'USD', channel: 'public-sector',
    },
  });
  await price(pro.id, { name: 'Monthly', charge_type: 'recurring', pricing_model: 'per_unit', unit_amount: '19', billing_period: 'month', price_book_id: book.id });

  return { pro, enterprise, onboarding, consulting, sensor, packageOffering, checks, book };
}

/**
 * Walk one deal all the way through, using the same code paths the app does, so
 * the demo data is exactly what the flow produces rather than a hand-built
 * imitation of it.
 */
async function seedSellingFlow(catalog: Awaited<ReturnType<typeof seedCatalog>>, dealId: string, entityId: string) {
  await prisma.dealLine.createMany({
    data: [
      { workspace_id: WORKSPACE_ID, deal_id: dealId, offering_id: catalog.pro.id, name: 'Professional Plan', quantity: '25', term_months: 12, sort_order: 0, created_by_user_id: HECTOR },
      { workspace_id: WORKSPACE_ID, deal_id: dealId, offering_id: catalog.onboarding.id, name: 'Onboarding', quantity: '1', sort_order: 1, created_by_user_id: HECTOR },
      { workspace_id: WORKSPACE_ID, deal_id: dealId, offering_id: catalog.sensor.id, name: 'Door Sensor', quantity: '8', discount_type: 'percentage', discount_value: '10', sort_order: 2, created_by_user_id: HECTOR },
    ],
  });

  const { quote } = await createQuoteFromDeal({
    workspace_id: WORKSPACE_ID,
    deal_id: dealId,
    name: 'Acme platform rollout',
    contract_term_months: 12,
    payment_terms: 'Net 30',
    owner_user_id: HECTOR,
    created_by_user_id: HECTOR,
  });

  const { order, provisioning } = await acceptQuote({
    workspace_id: WORKSPACE_ID,
    quote_id: quote.id,
    purchase_order_number: 'ACME-PO-4417',
    created_by_user_id: HECTOR,
  });

  // The order ships in two goes, which is the ordinary case rather than the
  // exception: a partial shipment leaves the rest on the order.
  const sensorLine = await prisma.orderLine.findFirst({
    where: { workspace_id: WORKSPACE_ID, order_id: order.id, sku: 'HW-SENSOR-1' },
  });
  if (sensorLine) {
    const shipment = await prisma.shipment.create({
      data: {
        workspace_id: WORKSPACE_ID, order_id: order.id, shipment_number: 'SHP-0001', status: 'pending',
        carrier: 'UPS', service_level: 'Ground', tracking_number: '1Z999AA10123456784',
        ship_from_location_code: 'WH-AUSTIN', ship_to_name: 'Acme Corporation', ship_to_city: 'Austin',
        ship_to_region: 'TX', ship_to_country_code: 'US', created_by_user_id: HECTOR,
      },
    });
    await prisma.shipmentLine.create({
      data: {
        workspace_id: WORKSPACE_ID, shipment_id: shipment.id, order_line_id: sensorLine.id,
        quantity: '5', backordered_quantity: '3', serial_numbers: 'SN-0001, SN-0002, SN-0003, SN-0004, SN-0005',
      },
    });
    await shipShipment(WORKSPACE_ID, shipment.id);
  }

  const [subscriptionId] = provisioning.subscriptions;
  if (subscriptionId) {
    // Two teams onboard mid-period: seats go up, the change is prorated, and
    // the original agreement stays exactly as it was signed.
    await amendSubscription({
      workspace_id: WORKSPACE_ID,
      subscription_id: subscriptionId,
      amendment_type: 'quantity_change',
      quantity: '40',
      reason: 'Two new teams onboarded',
      created_by_user_id: HECTOR,
    });

    const apiCalls = await prisma.entitlement.findFirst({
      where: { workspace_id: WORKSPACE_ID, subscription_id: subscriptionId, overage_unit_amount: { not: null } },
    });
    if (apiCalls) {
      const days = [21, 14, 7, 2];
      for (const [i, daysAgo] of days.entries()) {
        const occurred = new Date(Date.now() - daysAgo * 86_400_000);
        await prisma.usageRecord.create({
          data: {
            workspace_id: WORKSPACE_ID, entity_id: entityId, subscription_id: subscriptionId,
            entitlement_id: apiCalls.id, metric_code: 'api_calls', quantity: String(2800 + i * 400),
            unit_of_measure: 'call', occurred_at: occurred, source: 'api-gateway',
            external_reference: `usage-${daysAgo}d`,
          },
        });
      }
      await prisma.entitlement.update({
        where: { id: apiCalls.id },
        data: { used_quantity: String(2800 + 3200 + 3600 + 4000) },
      });
    }
  }

  const [deliveryId] = provisioning.service_deliveries;
  if (deliveryId) {
    await prisma.serviceDelivery.update({
      where: { id: deliveryId },
      data: {
        status: 'in_progress',
        assigned_user_id: SARAH,
        assigned_team: 'Implementation',
        scheduled_start_at: new Date(Date.now() - 10 * 86_400_000),
        scheduled_end_at: new Date(Date.now() + 18 * 86_400_000),
        actual_start_at: new Date(Date.now() - 9 * 86_400_000),
        hours_consumed: '18',
      },
    });
    // Project billing: 30% at kickoff, 40% at delivery, 30% at completion.
    await prisma.serviceMilestone.createMany({
      data: [
        { workspace_id: WORKSPACE_ID, service_delivery_id: deliveryId, name: 'Kickoff', sequence: 0, status: 'accepted', billing_percent: '30', billing_amount: '1500', currency_code: 'USD', completed_at: new Date(Date.now() - 8 * 86_400_000), accepted_at: new Date(Date.now() - 7 * 86_400_000) },
        { workspace_id: WORKSPACE_ID, service_delivery_id: deliveryId, name: 'Data migration delivered', sequence: 1, status: 'in_progress', billing_percent: '40', billing_amount: '2000', currency_code: 'USD', due_on: new Date(Date.now() + 7 * 86_400_000) },
        { workspace_id: WORKSPACE_ID, service_delivery_id: deliveryId, name: 'Completion and sign-off', sequence: 2, status: 'pending', billing_percent: '30', billing_amount: '1500', currency_code: 'USD', due_on: new Date(Date.now() + 18 * 86_400_000) },
      ],
    });
  }

  return { quote, order, provisioning };
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

  const catalog = await seedCatalog();
  // The Acme "Services Expansion" deal is the one carried all the way through
  // to an order, so the demo workspace has a live subscription, an engagement
  // in progress, and a partly shipped order to look at.
  const flow = await seedSellingFlow(catalog, deals[1]!.id, acme.id);

  console.log('Seeded:');
  console.log(`  Entities:  8`);
  console.log(`  People:    12`);
  console.log(`  Deals:     ${deals.length}`);
  console.log(`  Cases:     ${cases.length}`);
  console.log(`  Incidents: ${incidents.length}`);
  console.log(`  Requests:  5`);
  console.log(`  Chat channels: ${channelRows.length} (/chat/widget/sales, /chat/widget/support)`);
  console.log(`  Products:  4 with 9 offerings, 1 price book`);
  console.log(`  Quote:     ${flow.quote.quote_number} -> order ${flow.order.order_number}`);
  console.log(
    `  Opened:    ${flow.provisioning.subscriptions.length} subscription(s), ` +
      `${flow.provisioning.service_deliveries.length} service delivery(ies)`,
  );
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
