import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Download, AlertCircle } from 'lucide-react';
import { format, differenceInSeconds } from 'date-fns';

const TYPE_COLORS: Record<string, string> = {
  inventory: 'bg-blue-100 text-blue-800',
  pos: 'bg-green-100 text-green-800',
  price_feed: 'bg-orange-100 text-orange-800',
  scip_reach: 'bg-purple-100 text-purple-800',
};

const STATUS_COLORS: Record<string, string> = {
  success: 'bg-green-100 text-green-800',
  failed: 'bg-red-100 text-red-800',
  running: 'bg-blue-100 text-blue-800',
  queued: 'bg-gray-100 text-gray-700',
};

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'success', label: 'Success' },
  { value: 'failed', label: 'Failed' },
  { value: 'running', label: 'Running' },
  { value: 'queued', label: 'Queued' },
];

function formatDuration(started?: string, completed?: string): string {
  if (!started || !completed) return '-';
  const secs = differenceInSeconds(new Date(completed), new Date(started));
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const remainSecs = secs % 60;
  if (mins < 60) return `${mins}m ${remainSecs}s`;
  const hrs = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return `${hrs}h ${remainMins}m`;
}

function formatFileSize(bytes?: number): string {
  if (bytes == null || bytes === 0) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function RunHistory() {
  const [statusFilter, setStatusFilter] = useState('');

  const params: Record<string, string> = {};
  if (statusFilter) params.status = statusFilter;

  const { data, isLoading, error } = useQuery({
    queryKey: ['runs', params],
    queryFn: () => api.runs.list(params),
  });

  const runs: any[] = Array.isArray(data) ? data : data?.items ?? [];

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
          Failed to load run history: {(error as Error).message}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Run History</h1>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {runs.length} run{runs.length !== 1 ? 's' : ''}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : runs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No runs found.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Run ID</TableHead>
                  <TableHead>Extract Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead>Completed</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead className="text-right">Rows</TableHead>
                  <TableHead className="text-right">File Size</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {runs.map((run: any) => (
                  <TableRow key={run.run_id}>
                    <TableCell
                      className="font-mono text-xs text-muted-foreground"
                      title={run.run_id}
                    >
                      {run.run_id?.substring(0, 8)}...
                    </TableCell>
                    <TableCell className="font-medium">
                      {run.extract_name ?? run.definition_id}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={cn(
                          'border-0',
                          TYPE_COLORS[run.extract_type] ?? 'bg-gray-100 text-gray-700'
                        )}
                      >
                        {(run.extract_type ?? '').replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={cn(
                          'border-0',
                          STATUS_COLORS[run.status] ?? 'bg-gray-100 text-gray-700'
                        )}
                      >
                        {run.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {run.started_at
                        ? format(new Date(run.started_at), 'MMM d, HH:mm:ss')
                        : '-'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {run.completed_at
                        ? format(new Date(run.completed_at), 'MMM d, HH:mm:ss')
                        : '-'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDuration(run.started_at, run.completed_at)}
                    </TableCell>
                    <TableCell className="text-right">
                      {run.rows_extracted != null
                        ? Number(run.rows_extracted).toLocaleString()
                        : '-'}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {formatFileSize(run.file_size_bytes)}
                    </TableCell>
                    <TableCell className="text-right">
                      {run.status === 'success' && (
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Download"
                          asChild
                        >
                          <a
                            href={api.runs.downloadUrl(run.run_id)}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <Download className="h-4 w-4 text-[#005DA6]" />
                          </a>
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
