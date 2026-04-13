import { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Page } from '../App';
import { api } from '@/lib/api';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { Save, Eye, X, AlertCircle, ArrowUp, ArrowDown } from 'lucide-react';

interface ExtractEditorProps {
  definitionId: string | null;
  onNavigate: (p: Page) => void;
}

interface ColumnDef {
  column_name: string;
  selected: boolean;
  alias: string;
}

interface FormData {
  name: string;
  description: string;
  extract_type: string;
  status: string;
  country_code: string;
  sensitivity_level: string;
  tags: string;
  source_table: string;
  columns: ColumnDef[];
  parameters: Record<string, string>;
  file_format: string;
  delimiter: string;
  encoding: string;
  decimal_format: string;
  file_naming_template: string;
}

const INITIAL_FORM: FormData = {
  name: '',
  description: '',
  extract_type: 'inventory',
  status: 'draft',
  country_code: '',
  sensitivity_level: 'internal',
  tags: '',
  source_table: '',
  columns: [],
  parameters: {},
  file_format: 'csv',
  delimiter: ',',
  encoding: 'utf-8',
  decimal_format: '.',
  file_naming_template: '',
};

const EXTRACT_TYPES = [
  { value: 'inventory', label: 'Inventory' },
  { value: 'pos', label: 'POS' },
  { value: 'price_feed', label: 'Price Feed' },
  { value: 'scip_reach', label: 'SCIP/REACH' },
];

const STATUS_OPTIONS = [
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'archived', label: 'Archived' },
];

const SENSITIVITY_OPTIONS = [
  { value: 'public', label: 'Public' },
  { value: 'internal', label: 'Internal' },
  { value: 'confidential', label: 'Confidential' },
  { value: 'restricted', label: 'Restricted' },
];

const ENCODING_OPTIONS = [
  { value: 'utf-8', label: 'UTF-8' },
  { value: 'utf-16', label: 'UTF-16' },
  { value: 'iso-8859-1', label: 'ISO-8859-1' },
];

const PARAM_FIELDS: Record<string, { key: string; label: string }[]> = {
  inventory: [{ key: 'warehouse_country', label: 'Warehouse Country' }],
  pos: [{ key: 'store_country', label: 'Store Country' }],
  price_feed: [
    { key: 'country_code', label: 'Country Code' },
    { key: 'currency', label: 'Currency' },
  ],
  scip_reach: [
    { key: 'country_code', label: 'Country Code' },
    { key: 'compliance_status', label: 'Compliance Status' },
  ],
};

// Maps extract type to fully qualified source table name
const SOURCE_TABLE_MAP: Record<string, string> = {
  inventory: 'parijat_demos.gdet.inventory_data',
  pos: 'parijat_demos.gdet.pos_data',
  price_feed: 'parijat_demos.gdet.price_feed_data',
  scip_reach: 'parijat_demos.gdet.scip_reach_data',
};

export default function ExtractEditor({ definitionId, onNavigate }: ExtractEditorProps) {
  const queryClient = useQueryClient();
  const isEditing = definitionId !== null;

  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [previewData, setPreviewData] = useState<any[] | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Load existing definition
  const { data: existing, isLoading, error } = useQuery({
    queryKey: ['extract', definitionId],
    queryFn: () => api.extracts.get(definitionId!),
    enabled: isEditing,
  });

  // Derive source table from extract type
  const sourceTable = SOURCE_TABLE_MAP[form.extract_type] || '';

  // Fetch source columns
  const { data: sourceColumns } = useQuery({
    queryKey: ['source-columns', sourceTable],
    queryFn: () => api.extracts.sourceColumns(sourceTable),
    enabled: !!sourceTable,
  });

  // Populate form when existing data loads
  useEffect(() => {
    if (existing) {
      // columns_config is the field name from the API (parsed JSON array)
      const colsCfg = existing.columns_config ?? existing.columns ?? [];
      const cols: ColumnDef[] = colsCfg.map((c: any) => ({
        column_name: c.name ?? c.source_column ?? c.column_name,
        selected: c.visible !== false,
        alias: c.alias ?? '',
      }));
      const params = typeof existing.parameters === 'string'
        ? JSON.parse(existing.parameters)
        : existing.parameters ?? {};
      setForm({
        name: existing.name ?? '',
        description: existing.description ?? '',
        extract_type: existing.extract_type ?? 'inventory',
        status: existing.status ?? 'draft',
        country_code: existing.country_code ?? '',
        sensitivity_level: existing.sensitivity_level ?? 'internal',
        tags: Array.isArray(existing.tags) ? existing.tags.join(', ') : (existing.tags ?? ''),
        source_table: existing.source_table ?? '',
        columns: cols,
        parameters: params,
        file_format: existing.file_format ?? 'csv',
        delimiter: existing.delimiter ?? ',',
        encoding: existing.encoding ?? 'utf-8',
        decimal_format: existing.decimal_format ?? '.',
        file_naming_template: existing.file_naming_template ?? '',
      });
    }
  }, [existing]);

  // Merge source columns with any already-selected columns
  useEffect(() => {
    if (!sourceColumns) return;
    // API returns [{name: "col", type: "STRING"}, ...]
    const colList: string[] = Array.isArray(sourceColumns)
      ? sourceColumns.map((c: any) => (typeof c === 'string' ? c : c.name ?? c.column_name))
      : sourceColumns.columns ?? [];

    setForm((prev) => {
      const existingMap = new Map(prev.columns.map((c) => [c.column_name, c]));
      const merged: ColumnDef[] = colList.map((colName) => {
        if (existingMap.has(colName)) return existingMap.get(colName)!;
        return { column_name: colName, selected: false, alias: '' };
      });
      return { ...prev, columns: merged };
    });
  }, [sourceColumns]);

  const updateField = useCallback(
    <K extends keyof FormData>(key: K, value: FormData[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
    },
    []
  );

  const toggleColumn = (idx: number) => {
    setForm((prev) => {
      const cols = [...prev.columns];
      cols[idx] = { ...cols[idx], selected: !cols[idx].selected };
      return { ...prev, columns: cols };
    });
  };

  const updateAlias = (idx: number, alias: string) => {
    setForm((prev) => {
      const cols = [...prev.columns];
      cols[idx] = { ...cols[idx], alias };
      return { ...prev, columns: cols };
    });
  };

  const moveColumn = (idx: number, direction: 'up' | 'down') => {
    setForm((prev) => {
      const cols = [...prev.columns];
      const target = direction === 'up' ? idx - 1 : idx + 1;
      if (target < 0 || target >= cols.length) return prev;
      [cols[idx], cols[target]] = [cols[target], cols[idx]];
      return { ...prev, columns: cols };
    });
  };

  const updateParam = (key: string, value: string) => {
    setForm((prev) => ({
      ...prev,
      parameters: { ...prev.parameters, [key]: value },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Build columns_config in the format the backend expects:
      // [{name, alias, order, visible}]
      const allColumns = form.columns.map((c, i) => ({
        name: c.column_name,
        alias: c.alias || c.column_name,
        order: i + 1,
        visible: c.selected,
      }));
      const payload = {
        name: form.name,
        description: form.description,
        extract_type: form.extract_type,
        status: form.status,
        country_code: form.country_code,
        sensitivity_level: form.sensitivity_level,
        tags: form.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        source_table: sourceTable,
        columns_config: allColumns,
        parameters: form.parameters,
        file_format: form.file_format,
        delimiter: form.delimiter,
        encoding: form.encoding,
        decimal_format: form.decimal_format,
        file_naming_template: form.file_naming_template,
      };

      if (isEditing) {
        await api.extracts.update(definitionId!, payload);
        toast({ title: 'Updated', description: 'Extract definition saved.' });
      } else {
        await api.extracts.create(payload);
        toast({ title: 'Created', description: 'New extract definition created.' });
      }
      queryClient.invalidateQueries({ queryKey: ['extracts'] });
      onNavigate('extracts');
    } catch (err) {
      toast({
        title: 'Save failed',
        description: (err as Error).message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = async () => {
    if (!definitionId) {
      toast({
        title: 'Save first',
        description: 'Please save the extract before previewing.',
        variant: 'destructive',
      });
      return;
    }
    setPreviewLoading(true);
    try {
      const result = await api.extracts.preview(definitionId, { limit: 20 });
      setPreviewData(Array.isArray(result) ? result : result?.rows ?? result?.data ?? []);
    } catch (err) {
      toast({
        title: 'Preview failed',
        description: (err as Error).message,
        variant: 'destructive',
      });
    } finally {
      setPreviewLoading(false);
    }
  };

  if (isEditing && isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (isEditing && error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
          Failed to load extract: {(error as Error).message}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">
        {isEditing ? 'Edit Extract' : 'New Extract'}
      </h1>

      <Card>
        <CardContent className="pt-6">
          <Tabs defaultValue="basic">
            <TabsList className="mb-6">
              <TabsTrigger value="basic">Basic Info</TabsTrigger>
              <TabsTrigger value="columns">Columns</TabsTrigger>
              <TabsTrigger value="parameters">Parameters</TabsTrigger>
              <TabsTrigger value="file">File Config</TabsTrigger>
            </TabsList>

            {/* Tab 1: Basic Info */}
            <TabsContent value="basic">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Name</label>
                  <Input
                    value={form.name}
                    onChange={(e) => updateField('name', e.target.value)}
                    placeholder="Extract definition name"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Extract Type</label>
                  <select
                    value={form.extract_type}
                    onChange={(e) => updateField('extract_type', e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {EXTRACT_TYPES.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="md:col-span-2 space-y-2">
                  <label className="text-sm font-medium">Description</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => updateField('description', e.target.value)}
                    rows={3}
                    className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-none"
                    placeholder="Describe the purpose of this extract"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => updateField('status', e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {STATUS_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Country Code</label>
                  <Input
                    value={form.country_code}
                    onChange={(e) => updateField('country_code', e.target.value)}
                    placeholder="e.g. US, DE, CN"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Sensitivity Level</label>
                  <select
                    value={form.sensitivity_level}
                    onChange={(e) => updateField('sensitivity_level', e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {SENSITIVITY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Tags</label>
                  <Input
                    value={form.tags}
                    onChange={(e) => updateField('tags', e.target.value)}
                    placeholder="tag1, tag2, tag3"
                  />
                </div>
              </div>
            </TabsContent>

            {/* Tab 2: Columns */}
            <TabsContent value="columns">
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Source table: <span className="font-mono font-medium">{sourceTable || 'N/A'}</span>.
                  Select columns to include in the extract.
                </p>
                {form.columns.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-8 text-center">
                    No columns available. The source columns will load based on the extract type.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">Include</TableHead>
                        <TableHead>Column Name</TableHead>
                        <TableHead>Alias</TableHead>
                        <TableHead className="w-24 text-center">Reorder</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {form.columns.map((col, idx) => (
                        <TableRow key={col.column_name}>
                          <TableCell>
                            <Checkbox
                              checked={col.selected}
                              onCheckedChange={() => toggleColumn(idx)}
                            />
                          </TableCell>
                          <TableCell className="font-mono text-sm">
                            {col.column_name}
                          </TableCell>
                          <TableCell>
                            <Input
                              value={col.alias}
                              onChange={(e) => updateAlias(idx, e.target.value)}
                              placeholder="Optional alias"
                              className="h-8 text-sm"
                              disabled={!col.selected}
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            <div className="flex items-center justify-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                disabled={idx === 0}
                                onClick={() => moveColumn(idx, 'up')}
                              >
                                <ArrowUp className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                disabled={idx === form.columns.length - 1}
                                onClick={() => moveColumn(idx, 'down')}
                              >
                                <ArrowDown className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </TabsContent>

            {/* Tab 3: Parameters */}
            <TabsContent value="parameters">
              <div className="space-y-6">
                <p className="text-sm text-muted-foreground">
                  Parameters for <span className="font-medium">{form.extract_type.replace('_', ' ')}</span> extracts.
                </p>
                {(PARAM_FIELDS[form.extract_type] ?? []).map((field) => (
                  <div key={field.key} className="space-y-2 max-w-md">
                    <label className="text-sm font-medium">{field.label}</label>
                    <Input
                      value={form.parameters[field.key] ?? ''}
                      onChange={(e) => updateParam(field.key, e.target.value)}
                      placeholder={`Enter ${field.label.toLowerCase()}`}
                    />
                  </div>
                ))}
                {(PARAM_FIELDS[form.extract_type] ?? []).length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No parameters defined for this extract type.
                  </p>
                )}
              </div>
            </TabsContent>

            {/* Tab 4: File Config */}
            <TabsContent value="file">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium">File Format</label>
                  <select
                    value={form.file_format}
                    onChange={(e) => updateField('file_format', e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="csv">CSV</option>
                    <option value="json">JSON</option>
                    <option value="xlsx">XLSX</option>
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Delimiter</label>
                  <Input
                    value={form.delimiter}
                    onChange={(e) => updateField('delimiter', e.target.value)}
                    placeholder=","
                    disabled={form.file_format !== 'csv'}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Encoding</label>
                  <select
                    value={form.encoding}
                    onChange={(e) => updateField('encoding', e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {ENCODING_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Decimal Format</label>
                  <select
                    value={form.decimal_format}
                    onChange={(e) => updateField('decimal_format', e.target.value)}
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value=".">Period (.)</option>
                    <option value=",">Comma (,)</option>
                  </select>
                </div>

                <div className="md:col-span-2 space-y-2">
                  <label className="text-sm font-medium">File Naming Template</label>
                  <Input
                    value={form.file_naming_template}
                    onChange={(e) => updateField('file_naming_template', e.target.value)}
                    placeholder="{name}_{country}_{date}.{format}"
                  />
                  <p className="text-xs text-muted-foreground">
                    Available tokens: {'{name}'}, {'{country}'}, {'{date}'}, {'{timestamp}'}, {'{format}'}
                  </p>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Action buttons */}
      <div className="flex items-center gap-3">
        <Button
          className="bg-[#005DA6] hover:bg-[#004a85]"
          onClick={handleSave}
          disabled={saving || !form.name}
        >
          <Save className="h-4 w-4 mr-2" />
          {saving ? 'Saving...' : 'Save'}
        </Button>
        {isEditing && (
          <Button
            variant="outline"
            onClick={handlePreview}
            disabled={previewLoading}
          >
            <Eye className="h-4 w-4 mr-2" />
            {previewLoading ? 'Loading...' : 'Preview'}
          </Button>
        )}
        <Button variant="ghost" onClick={() => onNavigate('extracts')}>
          <X className="h-4 w-4 mr-2" />
          Cancel
        </Button>
      </div>

      {/* Preview results */}
      {previewData && previewData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Preview Results ({previewData.length} rows)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto max-h-96">
              <Table>
                <TableHeader>
                  <TableRow>
                    {Object.keys(previewData[0]).map((key) => (
                      <TableHead key={key}>{key}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {previewData.map((row: any, i: number) => (
                    <TableRow key={i}>
                      {Object.values(row).map((val: any, j: number) => (
                        <TableCell key={j} className="text-sm whitespace-nowrap">
                          {val != null ? String(val) : '-'}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {previewData && previewData.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground text-sm">
            Preview returned no rows.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
