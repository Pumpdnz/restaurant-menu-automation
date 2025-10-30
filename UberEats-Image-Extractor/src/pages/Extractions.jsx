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
  Trash2,
  FileDown,
  ImageDown
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

  const handleViewResults = async (extraction) => {
    // If extraction has a menu_id, navigate directly to MenuDetail
    if (extraction.menu_id) {
      navigate(`/menus/${extraction.menu_id}`);
    } else {
      // Fallback to old behavior for legacy extractions
      try {
        const response = await api.get(`/extractions/${extraction.job_id}`);
        navigate(`/extractions/${extraction.job_id}`, { state: { job: response.data } });
      } catch (err) {
        console.error('Failed to fetch extraction details:', err);
      }
    }
  };

  const handleDownloadImages = async (extraction) => {
    try {
      // Check if the extraction has a menuId (database-driven)
      if (extraction.menu_id) {
        // Use database menu image download endpoint
        const response = await api.get(`/menus/${extraction.menu_id}/download-images-zip`, {
          responseType: 'blob'
        });
        
        // Create download link
        const url = window.URL.createObjectURL(new Blob([response.data]));
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `menu_${extraction.menu_id}_images.zip`);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
      } else {
        // Fall back to old method for legacy extractions
        const response = await api.get(`/batch-extract-results/${extraction.job_id}`);
        if (response.data.success && response.data.data) {
          const imagesResponse = await api.post('/download-images', {
            data: response.data.data,
            groupByCategory: true
          });
          
          if (imagesResponse.data.success) {
            console.log('Images download initiated:', imagesResponse.data);
            // The download-images endpoint typically triggers a download directly
          }
        }
      }
    } catch (err) {
      console.error('Failed to download images:', err);
    }
  };

  const handleDownloadCSV = async (extraction) => {
    try {
      // Check if the extraction has a menuId (database-driven)
      if (extraction.menu_id) {
        // Use direct CSV download endpoint for database menus (no images)
        const response = await api.get(`/menus/${extraction.menu_id}/csv`, {
          responseType: 'blob',
          params: { format: 'no_images' }
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
        // Fall back to old method for legacy extractions (generate clean CSV)
        const response = await api.get(`/batch-extract-results/${extraction.job_id}`);
        if (response.data.success && response.data.data) {
          const csvResponse = await api.post('/generate-clean-csv', {
            data: response.data.data
          });
          
          if (csvResponse.data.success) {
            const csvData = csvResponse.data.csvDataNoImages || csvResponse.data.csv;
            if (csvData) {
              const blob = new Blob([csvData], { type: 'text/csv' });
              const url = window.URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = csvResponse.data.filenameNoImages || `menu-${extraction.job_id}_no_images.csv`;
              document.body.appendChild(a);
              a.click();
              document.body.removeChild(a);
              window.URL.revokeObjectURL(url);
            }
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
                  <TableHead className="min-w-[150px]">Restaurant</TableHead>
                  <TableHead className="min-w-[100px]">Platform</TableHead>
                  <TableHead className="min-w-[100px]">Status</TableHead>
                  <TableHead className="min-w-[150px]">Started</TableHead>
                  <TableHead className="text-right min-w-[180px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
              {extractions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No extractions found. Start a new extraction to get started.
                  </TableCell>
                </TableRow>
              ) : (
                extractions.map((extraction) => {
                  // Detect platform from URL
                  const getPlatform = (url) => {
                    if (!url) return 'Unknown';
                    try {
                      const hostname = new URL(url).hostname.toLowerCase();
                      const pathname = new URL(url).pathname.toLowerCase();

                      // Tier 1 platforms
                      if (hostname.includes('ubereats.com')) return 'UberEats';
                      if (hostname.includes('doordash.com')) return 'DoorDash';

                      // NZ platforms
                      if (hostname.includes('delivereasy.co.nz')) return 'DeliverEasy';
                      if (hostname.includes('ordermeal.co.nz')) return 'OrderMeal';
                      if (hostname.includes('menulog.co.nz')) return 'Menulog';
                      if (hostname.includes('mobi2go.com')) return 'Mobi2Go';
                      if (hostname.includes('foodhub.co.nz')) return 'FoodHub';
                      if (hostname.includes('nextorder.nz') || hostname.includes('nextorder.co.nz')) return 'NextOrder';
                      if (hostname.includes('sipocloudpos.com')) return 'Sipo';
                      if (hostname.includes('booknorder.co.nz')) return 'BookNOrder';
                      if (hostname.includes('bopple.app')) return 'Bopple';
                      if (hostname.includes('resdiary.com')) return 'ResDiary';
                      if (hostname.includes('meandu.app')) return 'Me&u';

                      // Check for GloriaFood embedded widget patterns
                      if (pathname.includes('gloriafood') ||
                          pathname.includes('online-ordering') ||
                          hostname.includes('noi.co.nz') ||
                          hostname.includes('luckythai.co.nz')) {
                        return 'GloriaFood';
                      }

                      // Check for known FoodHub custom domains
                      const foodhubDomains = ['konyakebabs.co.nz', 'larubythaionline.co.nz', 'fusionkebab.co.nz', 'lakepizza.co.nz'];
                      if (foodhubDomains.some(domain => hostname.includes(domain))) {
                        return 'FoodHub';
                      }

                      // Check for known Mobi2Go restaurant domains
                      if (hostname.includes('scopa.co.nz') || hostname.includes('ljs.co.nz')) {
                        return 'Mobi2Go';
                      }

                      return 'Website';
                    } catch {
                      return 'Unknown';
                    }
                  };
                  
                  return (
                  <TableRow key={extraction.job_id}>
                    <TableCell 
                      className="text-muted-foreground cursor-pointer hover:text-brand-blue transition-colors"
                      onClick={() => {
                        if (extraction.restaurants?.id) {
                          navigate(`/restaurants/${extraction.restaurants.id}`);
                        }
                      }}
                    >
                      {extraction.restaurants?.name || 'Unknown'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="capitalize">
                        {getPlatform(extraction.source_url || extraction.url)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {getStatusBadge(extraction.status)}
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
                              onClick={() => handleViewResults(extraction)}
                              className="text-brand-blue hover:text-brand-blue hover:bg-brand-blue/10"
                              title={extraction.menu_id ? "View menu" : "View extraction details"}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDownloadCSV(extraction)}
                              className="text-brand-green hover:text-brand-green hover:bg-brand-green/10"
                              title="Download CSV (No Images)"
                            >
                              <FileDown className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDownloadImages(extraction)}
                              className="text-brand-blue hover:text-brand-blue hover:bg-brand-blue/10"
                              title="Download Images ZIP"
                            >
                              <ImageDown className="h-4 w-4" />
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
                  );
                })
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