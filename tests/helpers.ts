import { randomUUID } from 'node:crypto';

import { prisma } from '@/lib/prisma';

export const uuid = () => randomUUID();

/** Child rows first: the junctions and chat tables carry FKs back to entity/person/case. */
export async function resetDatabase() {
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
