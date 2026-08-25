'use client';

import { Plus } from 'lucide-react';
import { useState } from 'react';

import { RecordFormDialog } from '@/components/record-form-dialog';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { NAV_OBJECT_ORDER, OBJECTS, type ObjectKey } from '@/lib/objects';

/** Creates any supported object from the application header. */
export function CreateMenu({ workspaceId }: { workspaceId: string | null }) {
  const [creating, setCreating] = useState<ObjectKey | null>(null);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" disabled={!workspaceId}>
            <Plus /> Create
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {NAV_OBJECT_ORDER.map((key) => {
            const object = OBJECTS[key];
            const Icon = object.icon;
            return (
              <DropdownMenuItem key={key} onSelect={() => setCreating(key)}>
                <Icon /> {object.singular}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      {creating && workspaceId ? (
        <RecordFormDialog
          open
          onOpenChange={(open) => !open && setCreating(null)}
          objectKey={creating}
          mode="create"
          workspaceId={workspaceId}
        />
      ) : null}
    </>
  );
}
