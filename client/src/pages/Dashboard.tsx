import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { Page } from '../App';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
import { toast } from '@/hooks/use-toast';
import {
  FileOutput,
  Play,
  CheckCircle2,
  CalendarClock,
  AlertCircle,
  Pencil,
  Loader2,
} from 'lucide-react';
import { format } from 'date-fns';

interface DashboardProps {
  onNavigate: (p: Page, id?: string | null) => void;
}

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

const DEF_STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  draft: 'bg-yellow-100 text-yellow-800',
  inactive: 'bg-gray-100 text-gray-700',
};

export default function Dashboard({ onNavigate }: DashboardProps) {
  const queryClient = useQueryClient();
  const [runningId, setRunningId] = useState<string | null>(null);

  const { data: metrics, isLoading, error } = useQuery({
    queryKey: ['dashboard-metrics'],
    queryFn: () => api.dashboard.metrics(),
    refetchInterval: 30000,
  });

  // Fetch extract definitions for the management table
  const { data: extractsData, isLoading: extractsLoading } = useQuery({
    queryKey: ['extracts', { page: '1', page_size: '10' }],
    queryFn: () => api.extracts.list({ page: '1', page_size: '10' }),
  });

  const handleRunNow = async (defId: string, defName: string) => {
    setRunningId(defId);
    try {
      const result = await api.extracts.run(defId);
      if (result.status === 'failed') {
        toast({
          title: 'Extract failed',
          description: `"${defName}" failed: ${result.error_message || 'Unknown error'}`,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Extract completed',
          description: `"${defName}" completed with ${result.row_count ?? 0} rows.`,
        });
      }
      queryClient.invalidateQueries({ queryKey: ['dashboard-metrics'] });
      queryClient.invalidateQueries({ queryKey: ['extracts'] });
    } catch (err) {
      toast({
        title: 'Run failed',
        description: (err as Error).message,
        variant: 'destructive',
      });
    } finally {
      setRunningId(null);
    }
  };

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
          Failed to load dashboard: {(error as Error).message}
        </AlertDescription>
      </Alert>
    );
  }

  const recentRuns: any[] = metrics?.recent_runs ?? [];
  const extracts: any[] = extractsData?.data ?? [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-5 w-5 rounded" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Extracts
                </CardTitle>
                <FileOutput className="h-5 w-5 text-[#005DA6]" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{metrics?.total_definitions ?? 0}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Total Runs
                </CardTitle>
                <Play className="h-5 w-5 text-[#005DA6]" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{metrics?.total_runs ?? 0}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Success Rate
                </CardTitle>
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {metrics?.success_rate_pct != null
                    ? `${Number(metrics.success_rate_pct).toFixed(1)}%`
                    : '0%'}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Active Schedules
                </CardTitle>
                <CalendarClock className="h-5 w-5 text-[#005DA6]" />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{metrics?.active_schedules ?? 0}</div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Extract Definitions - with Edit & Run actions */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Extract Definitions</CardTitle>
          <Button
            size="sm"
            className="bg-[#005DA6] hover:bg-[#004a85]"
            onClick={() => onNavigate('editor', null)}
          >
            + New Extract
          </Button>
        </CardHeader>
        <CardContent>
          {extractsLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : extracts.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No extract definitions yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Format</TableHead>
                  <TableHead>Country</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {extracts.map((ext: any) => (
                  <TableRow key={ext.id}>
                    <TableCell className="font-medium">{ext.name}</TableCell>
                    <TableCell>
                      <Badge
                        className={cn(
                          'border-0',
                          TYPE_COLORS[ext.extract_type] ?? 'bg-gray-100 text-gray-700'
                        )}
                      >
                        {(ext.extract_type ?? '').replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="uppercase text-xs font-mono">
                      {ext.file_format}
                    </TableCell>
                    <TableCell>{ext.country_code || '-'}</TableCell>
                    <TableCell>
                      <Badge
                        className={cn(
                          'border-0',
                          DEF_STATUS_COLORS[ext.status] ?? 'bg-gray-100 text-gray-700'
                        )}
                      >
                        {ext.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="Edit"
                          onClick={() => onNavigate('editor', ext.id)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-[#005DA6]"
                          title="Run Now"
                          disabled={runningId === ext.id}
                          onClick={() => handleRunNow(ext.id, ext.name)}
                        >
                          {runningId === ext.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Play className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Recent Runs */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Runs</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : recentRuns.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No runs recorded yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Extract Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead className="text-right">Rows</TableHead>
                  <TableHead className="text-right">File Size</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentRuns.slice(0, 10).map((run: any) => (
                  <TableRow key={run.id}>
                    <TableCell className="font-medium">
                      {run.extract_name ?? run.extract_definition_id}
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
                    <TableCell className="text-muted-foreground text-sm">
                      {run.started_at
                        ? format(new Date(run.started_at), 'MMM d, HH:mm')
                        : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      {run.row_count != null
                        ? Number(run.row_count).toLocaleString()
                        : '-'}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">
                      {run.file_size_bytes != null
                        ? `${(Number(run.file_size_bytes) / 1024).toFixed(1)} KB`
                        : '-'}
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
