'use client';

import { ActivityFeed } from '@/components/activity-feed';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { NoteParentType } from '@/lib/objects';

/** The tabs shared by record pages. */
export function RecordTabs({
  overview,
  related,
  noteParentType,
  recordId,
  workspaceId,
}: {
  overview: React.ReactNode;
  /** Omit when the object has no meaningful one-to-many relations (e.g. Deal, Request). */
  related?: React.ReactNode;
  noteParentType: NoteParentType;
  recordId: string;
  workspaceId: string;
}) {
  return (
    <Tabs defaultValue="overview" className="pt-4">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        {related ? <TabsTrigger value="related">Related</TabsTrigger> : null}
        <TabsTrigger value="activity">Activity</TabsTrigger>
        <TabsTrigger value="notes">Notes</TabsTrigger>
      </TabsList>
      <TabsContent value="overview" className="pt-6">
        {overview}
      </TabsContent>
      {related ? (
        <TabsContent value="related" className="flex flex-col pt-6" style={{ gap: 'var(--d-gap-section)' }}>
          {related}
        </TabsContent>
      ) : null}
      <TabsContent value="activity" className="pt-6">
        <ActivityFeed parentType={noteParentType} parentId={recordId} workspaceId={workspaceId} />
      </TabsContent>
      <TabsContent value="notes" className="pt-6">
        <ActivityFeed parentType={noteParentType} parentId={recordId} workspaceId={workspaceId} filter="notes" />
      </TabsContent>
    </Tabs>
  );
}
