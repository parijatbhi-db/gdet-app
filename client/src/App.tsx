import { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import ExtractList from './pages/ExtractList';
import ExtractEditor from './pages/ExtractEditor';
import RunHistory from './pages/RunHistory';
import AuditLog from './pages/AuditLog';

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } },
});

export type Page = 'dashboard' | 'extracts' | 'editor' | 'runs' | 'audit';

export default function App() {
  const [page, setPage] = useState<Page>('dashboard');
  const [editId, setEditId] = useState<string | null>(null);

  const navigate = (p: Page, id?: string | null) => {
    setPage(p);
    setEditId(id || null);
  };

  return (
    <QueryClientProvider client={queryClient}>
      <Layout currentPage={page} onNavigate={navigate}>
        {page === 'dashboard' && <Dashboard onNavigate={navigate} />}
        {page === 'extracts' && <ExtractList onNavigate={navigate} />}
        {page === 'editor' && <ExtractEditor definitionId={editId} onNavigate={navigate} />}
        {page === 'runs' && <RunHistory />}
        {page === 'audit' && <AuditLog />}
      </Layout>
    </QueryClientProvider>
  );
}
