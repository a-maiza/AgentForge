'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DatasetVersionList } from '@/components/datasets/DatasetVersionList';

export default function DatasetVersionsPage({ params }: { params: { id: string } }) {
  const { id } = params;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center gap-3">
        <Link href={`/datasets/${id}`}>
          <Button variant="ghost" size="icon" aria-label="Back to dataset">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Version History</h1>
          <p className="mt-1 text-sm text-muted-foreground">Compare and manage dataset versions</p>
        </div>
      </div>

      <DatasetVersionList datasetId={id} />
    </div>
  );
}
