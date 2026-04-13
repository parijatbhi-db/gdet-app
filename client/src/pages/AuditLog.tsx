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
import { AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { format } from 'date-fns';

const ACTION_COLORS: Record<string, string> = {
  create: 'bg-green-100 text-green-800',
  update: 'bg-blue-100 text-blue-800',
  delete: 'bg-red-100 text-red-800',
  run: 'bg-purple-100 text-purple-800',
};

const ACTION_OPTIONS = [
  { value: '', label: 'All Actions' },
  { value: 'create', label: 'Create' },
  { value: 'update', label: 'Update' },
  { value: 'delete', label: 'Delete' },
  { value: 'run', label: 'Run' },
];

const PAGE_SIZE = 20;

export default function AuditLog() {
  const [actionFilter, setActionFilter] = useState('');
  const [page, setPage] = useState(0);

  const params: Record<string, string> = {
    limit: String(PAGE_SIZE),
    offset: String(page * PAGE_SIZE),
  };
  if (actionFilter) params.action = actionFilter;

  const { data, isLoading, error } = useQuery({
    queryKey: ['audit', params],
    queryFn: () => api.audit.list(params),
  });

  const entries: any[] = Array.isArray(data) ? data : data?.items ?? [];
  const totalCount: number = data?.total ?? entries.length;
  const hasNextPage = (page + 1) * PAGE_SIZE < totalCount;
  const hasPrevPage = page > 0;

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
          Failed to load audit log: {(error as Error).message}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Audit Log</h1>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <select
          value={actionFilter}
          onChange={(e) => {
            setActionFilter(e.target.value);
            setPage(0);
          }}
          className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {ACTION_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Audit Entries</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : entries.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No audit entries found.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Entity Type</TableHead>
                  <TableHead>Entity ID</TableHead>
                  <TableHead>Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry: any, idx: number) => {
                  const details =
                    typeof entry.details === 'string'
                      ? entry.details
                      : entry.details != null
                        ? JSON.stringify(entry.details)
                        : '-';
                  const truncatedDetails =
                    details.length > 80 ? details.substring(0, 80) + '...' : details;

                  return (
                    <TableRow key={entry.audit_id ?? idx}>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {entry.timestamp
                          ? format(new Date(entry.timestamp), 'MMM d, yyyy HH:mm:ss')
                          : entry.created_at
                            ? format(new Date(entry.created_at), 'MMM d, yyyy HH:mm:ss')
                            : '-'}
                      </TableCell>
                      <TableCell className="font-medium">
                        {entry.user ?? entry.user_id ?? '-'}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={cn(
                            'border-0',
                            ACTION_COLORS[entry.action?.toLowerCase()] ??
                              'bg-gray-100 text-gray-700'
                          )}
                        >
                          {entry.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {entry.entity_type ?? '-'}
                      </TableCell>
                      <TableCell
                        className="font-mono text-xs text-muted-foreground"
                        title={entry.entity_id}
                      >
                        {entry.entity_id
                          ? entry.entity_id.length > 12
                            ? entry.entity_id.substring(0, 12) + '...'
                            : entry.entity_id
                          : '-'}
                      </TableCell>
                      <TableCell
                        className="text-xs text-muted-foreground max-w-xs truncate"
                        title={details}
                      >
                        {truncatedDetails}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}

          {/* Pagination */}
          {!isLoading && entries.length > 0 && (
            <div className="flex items-center justify-between pt-4">
              <p className="text-sm text-muted-foreground">
                Showing {page * PAGE_SIZE + 1}&ndash;
                {Math.min((page + 1) * PAGE_SIZE, totalCount)} of {totalCount}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!hasPrevPage}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!hasNextPage}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
