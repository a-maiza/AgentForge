'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { DatasetList } from '@/components/datasets/DatasetList';
import { CreateDatasetModal } from '@/components/datasets/CreateDatasetModal';

export default function DatasetsPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const router = useRouter();
  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="text-2xl font-bold">Datasets</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage training and evaluation datasets
        </p>
      </div>
      <DatasetList onCreateClick={() => setCreateOpen(true)} />
      <CreateDatasetModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={(id) => router.push(`/datasets/${id}`)}
      />
    </div>
  );
}
