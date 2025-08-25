import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { 
  CheckCircle2, 
  XCircle, 
  Clock,
  RefreshCw,
  Download,
  Eye,
  Trash2
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { cn } from '../lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';

export default function Extractions() {
  const navigate = useNavigate();
  const [extractions, setExtractions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState({ open: false, jobId: null, restaurantName: null });

  useEffect(() => {
    fetchExtractions();
    // Poll for updates every 5 seconds
    const interval = setInterval(fetchExtractions, 5000);
    return () => clearInterval(interval);
  }, []);

  const fetchExtractions = async () => {
    try {
      const response = await api.get('/extractions');
      // API returns 'jobs' array, not 'extractions'
      setExtractions(response.data.jobs || []);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch extractions:', err);
      setError('Failed to load extractions');
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-brand-green" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-brand-red" />;
      case 'running':
        return <RefreshCw className="h-4 w-4 text-brand-blue animate-spin" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status) => {
    const statusConfig = {
      completed: { variant: 'success', label: 'Completed' },
      failed: { variant: 'destructive', label: 'Failed' },
      running: { variant: 'default', label: 'Running' },
      pending: { variant: 'secondary', label: 'Pending' },
    };
    
    const config = statusConfig[status] || { variant: 'outline', label: status };
    
    return (
      <Badge 
        variant={config.variant}
        className={cn(
          'gap-1',
          status === 'completed' && 'bg-brand-green/10 text-brand-green border-brand-green/20',
          status === 'failed' && 'bg-brand-red/10 text-brand-red border-brand-red/20',
          status === 'running' && 'bg-brand-blue/10 text-brand-blue border-brand-blue/20'
        )}
      >
        {getStatusIcon(status)}
        {config.label}
      </Badge>
    );
  };

  const handleViewResults = async (jobId) => {
    try {
      const response = await api.get(`/extractions/${jobId}`);
      // Navigate to a detailed view with the results
      navigate(`/extractions/${jobId}`, { state: { job: response.data } });
    } catch (err) {
      console.error('Failed to fetch extraction details:', err);
    }
  };

  const handleDownloadCSV = async (extraction) => {
    try {
      // Check if the extraction has a menuId (database-driven)
      if (extraction.menu_id) {
        // Use direct CSV download endpoint for database menus
        const response = await api.get(`/menus/${extraction.menu_id}/csv`, {
          responseType: 'blob',
          params: { format: 'full' }
        });
        
        // Create download link
        const url = window.URL.createObjectURL(response.data);
        const a = document.createElement('a');
        a.href = url;
        
        // Extract filename from Content-Disposition header or use default
        const contentDisposition = response.headers['content-disposition'];
        let filename = `${extraction.restaurant_name || 'menu'}_export.csv`;
        if (contentDisposition) {
          const matches = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(contentDisposition);
          if (matches && matches[1]) {
            filename = matches[1].replace(/['"]/g, '');
          }
        }
        
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      } else {
        // Fall back to old method for legacy extractions
        const response = await api.get(`/batch-extract-results/${extraction.job_id}`);
        if (response.data.success && response.data.data) {
          const csvResponse = await api.post('/generate-csv', {
            data: response.data.data
          });
          
          if (csvResponse.data.success && csvResponse.data.csv) {
            const blob = new Blob([csvResponse.data.csv], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `menu-${extraction.job_id}.csv`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
          }
        }
      }
    } catch (err) {
      console.error('Failed to download CSV:', err);
    }
  };

  const handleRetry = async (jobId) => {
    try {
      const response = await api.post(`/extractions/${jobId}/retry`);
      if (response.data.success) {
        // Refresh the list
        fetchExtractions();
      }
    } catch (err) {
      console.error('Failed to retry extraction:', err);
    }
  };

  const handleDeleteExtraction = async () => {
    if (!deleteConfirm.jobId) return;
    
    try {
      const response = await api.delete(`/extractions/${deleteConfirm.jobId}`);
      
      if (response.data.success) {
        // Refresh the extractions list
        await fetchExtractions();
        console.log('Extraction deleted successfully');
      }
    } catch (err) {
      console.error('Failed to delete extraction:', err);
      // You could add error toast here
    } finally {
      setDeleteConfirm({ open: false, jobId: null, restaurantName: null });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 text-brand-blue animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg bg-brand-red/5 border border-brand-red/20 p-4">
        <p className="text-sm text-brand-red">{error}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-bold text-foreground">Extractions</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            View and manage menu extraction jobs
          </p>
        </div>
        <div className="mt-4 sm:ml-16 sm:mt-0 sm:flex-none">
          <Button
            onClick={() => navigate('/extractions/new')}
            className="bg-gradient-to-r from-brand-blue to-brand-green hover:opacity-90"
          >
            New Extraction
          </Button>
        </div>
      </div>

      <div className="mt-8">
        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[120px]">Job ID</TableHead>
                  <TableHead className="min-w-[150px]">Restaurant</TableHead>
                  <TableHead className="min-w-[100px]">Status</TableHead>
                  <TableHead className="min-w-[80px]">Items</TableHead>
                  <TableHead className="min-w-[150px]">Started</TableHead>
                  <TableHead className="text-right min-w-[120px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
              {extractions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No extractions found. Start a new extraction to get started.
                  </TableCell>
                </TableRow>
              ) : (
                extractions.map((extraction) => (
                  <TableRow key={extraction.job_id}>
                    <TableCell>
                      <div className="font-medium">
                        {extraction.job_id.split('_').pop().substring(0, 8)}...
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {extraction.restaurants?.name || 'Unknown'}
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(extraction.status)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {extraction.progress?.totalItems || 
                       (extraction.status === 'completed' && extraction.menu ? 
                        `${extraction.menu.item_count || 0} items` : '-')}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {extraction.started_at ? 
                        new Date(extraction.started_at).toLocaleString() : 
                        new Date(extraction.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {extraction.status === 'completed' && (
                          <>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleViewResults(extraction.job_id)}
                              className="text-brand-blue hover:text-brand-blue hover:bg-brand-blue/10"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDownloadCSV(extraction)}
                              className="text-brand-green hover:text-brand-green hover:bg-brand-green/10"
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                        {extraction.status === 'failed' && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleRetry(extraction.job_id)}
                            className="text-brand-orange hover:text-brand-orange hover:bg-brand-orange/10"
                          >
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setDeleteConfirm({ 
                            open: true, 
                            jobId: extraction.job_id, 
                            restaurantName: extraction.restaurants?.name || 'Unknown' 
                          })}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          title="Delete extraction"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirm.open} onOpenChange={(open) => !open && setDeleteConfirm({ open: false, jobId: null, restaurantName: null })}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Delete Extraction</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the extraction for <span className="font-semibold">{deleteConfirm.restaurantName}</span>? 
              This will also delete all associated menus and menu items. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteConfirm({ open: false, jobId: null, restaurantName: null })}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteExtraction}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete Extraction
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}