import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Page } from '../App';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
import { toast } from '@/hooks/use-toast';
import {
  Plus,
  Search,
  Pencil,
  Play,
  Trash2,
  AlertCircle,
} from 'lucide-react';

interface ExtractListProps {
  onNavigate: (p: Page, id?: string | null) => void;
}

const TYPE_COLORS: Record<string, string> = {
  inventory: 'bg-blue-100 text-blue-800',
  pos: 'bg-green-100 text-green-800',
  price_feed: 'bg-orange-100 text-orange-800',
  scip_reach: 'bg-purple-100 text-purple-800',
};

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  draft: 'bg-gray-100 text-gray-700',
  inactive: 'bg-yellow-100 text-yellow-800',
  archived: 'bg-red-100 text-red-800',
};

const TYPE_OPTIONS = [
  { value: '', label: 'All Types' },
  { value: 'inventory', label: 'Inventory' },
  { value: 'pos', label: 'POS' },
  { value: 'price_feed', label: 'Price Feed' },
  { value: 'scip_reach', label: 'SCIP/REACH' },
];

export default function ExtractList({ onNavigate }: ExtractListProps) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const params: Record<string, string> = {};
  if (typeFilter) params.extract_type = typeFilter;

  const { data, isLoading, error } = useQuery({
    queryKey: ['extracts', params],
    queryFn: () => api.extracts.list(params),
  });

  const extracts: any[] = Array.isArray(data) ? data : data?.data ?? [];

  const filtered = extracts.filter((ext: any) =>
    ext.name?.toLowerCase().includes(search.toLowerCase())
  );

  const handleRun = async (id: string, name: string) => {
    try {
      await api.extracts.run(id);
      toast({ title: 'Run started', description: `Extract "${name}" is now running.` });
    } catch (err) {
      toast({
        title: 'Run failed',
        description: (err as Error).message,
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.extracts.delete(id);
      toast({ title: 'Deleted', description: 'Extract definition deleted.' });
      queryClient.invalidateQueries({ queryKey: ['extracts'] });
    } catch (err) {
      toast({
        title: 'Delete failed',
        description: (err as Error).message,
        variant: 'destructive',
      });
    } finally {
      setDeletingId(null);
    }
  };

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
          Failed to load extracts: {(error as Error).message}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Extract Definitions</h1>
        <Button
          className="bg-[#005DA6] hover:bg-[#004a85]"
          onClick={() => onNavigate('editor', null)}
        >
          <Plus className="h-4 w-4 mr-2" />
          New Extract
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {TYPE_OPTIONS.map((opt) => (
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
            {filtered.length} extract{filtered.length !== 1 ? 's' : ''}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              No extract definitions found.
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
                  <TableHead>Sensitivity</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((ext: any) => (
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
                    <TableCell className="uppercase text-sm text-muted-foreground">
                      {ext.file_format ?? '-'}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {ext.country_code ?? '-'}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={cn(
                          'border-0',
                          STATUS_COLORS[ext.status] ?? 'bg-gray-100 text-gray-700'
                        )}
                      >
                        {ext.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {ext.sensitivity_level ?? '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Edit"
                          onClick={() => onNavigate('editor', ext.id)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Run Now"
                          onClick={() => handleRun(ext.id, ext.name)}
                        >
                          <Play className="h-4 w-4 text-green-600" />
                        </Button>
                        {deletingId === ext.id ? (
                          <div className="flex items-center gap-1">
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDelete(ext.id)}
                            >
                              Confirm
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setDeletingId(null)}
                            >
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon"
                            title="Delete"
                            onClick={() => setDeletingId(ext.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        )}
                      </div>
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
