import { randomUUID } from 'node:crypto';

import { prisma } from '@/lib/prisma';

export const uuid = () => randomUUID();

/** Child rows first: the junctions, chat, and selling tables carry FKs back to entity/person/case/deal. */
export async function resetDatabase() {
  // Permissions hang off profiles, which hang off the users email accounts also
  // point at, so they go before both.
  await prisma.profileAssignment.deleteMany();
  await prisma.fieldPermission.deleteMany();
  await prisma.objectPermission.deleteMany();
  await prisma.profile.deleteMany();

  // Email, deepest first: a message points at the mailbox that sent it, and a
  // mailbox at the user who connected it.
  await prisma.emailMessage.deleteMany();
  await prisma.emailAccount.deleteMany();
  await prisma.appUser.deleteMany();

  // Selling, deepest first: usage hangs off entitlements, which hang off
  // subscriptions, which point back at order lines, orders, and the catalog.
  await prisma.usageRecord.deleteMany();
  await prisma.entitlement.deleteMany();
  await prisma.subscriptionAmendment.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.serviceMilestone.deleteMany();
  await prisma.serviceDelivery.deleteMany();
  await prisma.shipmentLine.deleteMany();
  await prisma.shipment.deleteMany();
  await prisma.orderLine.deleteMany();
  await prisma.order.deleteMany();
  await prisma.quoteLine.deleteMany();
  await prisma.quote.deleteMany();
  await prisma.dealLine.deleteMany();
  await prisma.bundleComponent.deleteMany();
  await prisma.priceTier.deleteMany();
  await prisma.price.deleteMany();
  await prisma.priceBook.deleteMany();
  await prisma.inventoryItem.deleteMany();
  await prisma.serviceDefinition.deleteMany();
  await prisma.offering.deleteMany();
  await prisma.product.deleteMany();

  await prisma.chatMessage.deleteMany();
  await prisma.chatSession.deleteMany();
  await prisma.chatAuthCode.deleteMany();
  await prisma.chatConversation.deleteMany();
  await prisma.chatContact.deleteMany();
  await prisma.chatChannel.deleteMany();
  await prisma.note.deleteMany();
  await prisma.incidentCase.deleteMany();
  await prisma.entityPerson.deleteMany();
  await prisma.deal.deleteMany();
  await prisma.featureRequest.deleteMany();
  await prisma.supportCase.deleteMany();
  await prisma.incident.deleteMany();
  await prisma.person.deleteMany();
  await prisma.entity.deleteMany();
}

export const jsonRequest = (url: string, method: string, body?: unknown) =>
  new Request(url, {
    method,
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

/** Route handlers receive params as a promise in the App Router. */
export const routeContext = (id: string) => ({ params: Promise.resolve({ id }) });

/** The same, for routes whose segments are not a single `id` (e.g. the chat widget API). */
export const paramsContext = <T extends Record<string, string>>(params: T) => ({
  params: Promise.resolve(params),
});

export const BASE = 'http://localhost:3000';
