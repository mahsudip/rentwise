import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
// Database types are now defined inline
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Plus, Edit, Trash2, Eye, Upload as UploadIcon, FileText, Download, X, RefreshCw } from "lucide-react";
import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Property {
  id: string;
  name: string;
}

interface Tenant {
  id: string;
  name: string;
  company_name: string;
  citizenship_number: string;
  monthly_rent: number;
  rent_frequency: string;
  contract_start_date: string;
  contract_period_years: number;
  contract_period_months: number;
  contract_end_date: string;
  rent_increment_percentage: number;
  rent_increment_interval_years: number;
  property_id: string;
  properties?: { name: string };
}

interface StoredDocument {
  id: string;
  name: string;
  path: string;
  size?: number;
  publicUrl?: string;
  document_type: 'contract' | 'citizenship' | 'other';
  uploaded_at: string;
  file_name?: string;
  file_path?: string;
  file_size?: number;
  mime_type?: string;
}

interface YearlyBreakdownRow {
  yearLabel: string;
  months: number;
  totalAmount: number;
}

interface UploadDocumentsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenantId: string;
  tenantName: string;
  onUploadSuccess: () => void;
}

const UploadDocumentsModal = ({ open, onOpenChange, tenantId, tenantName, onUploadSuccess }: UploadDocumentsModalProps) => {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [documentType, setDocumentType] =useState<'contract' | 'citizenship' | 'other'>('contract');
  const { user } = useAuth();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  const handleUpload = async () => {
    if (!user || !files.length) return;
    
    setUploading(true);
    
    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
        const folderPath = `tenant-${tenantId}/${documentType}`;
        const filePath = `${folderPath}/${fileName}`;
        
        // Upload file to storage
        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(filePath, file, {
            cacheControl: '3600',
            upsert: false
          });
          
        if (uploadError) throw uploadError;
        
        // Get public URL - use the path from the upload response
        const { data: { publicUrl } } = supabase.storage
          .from('documents')
          .getPublicUrl(filePath);
        
        console.log('File uploaded to:', filePath);
        console.log('Public URL:', publicUrl);
        
        // Save document reference to database
        const documentData = {
          tenant_id: tenantId,
          user_id: user.id,
          document_type: documentType,
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
          mime_type: file.type || 'application/octet-stream',
          uploaded_at: new Date().toISOString()
        } as const;
        
        // Type assertion to handle the insert operation
        const { error: dbError } = await supabase
          .from('tenant_documents')
          .insert([documentData] as unknown as never);
          
        if (dbError) throw dbError;
        
        return { success: true, fileName };
      });
      
      await Promise.all(uploadPromises);
      
      toast({
        title: "Success",
        description: `${files.length} file(s) uploaded successfully`,
      });
      
      onUploadSuccess();
      onOpenChange(false);
      setFiles([]);
      
    } catch (error) {
      console.error('Error uploading files:', error);
      toast({
        title: "Error",
        description: "Failed to upload files. Please try again.",
        variant: "destructive"
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Upload Documents</DialogTitle>
          <DialogDescription>
            Upload documents for {tenantName}
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="documentType">Document Type</Label>
            <select
              id="documentType"
              value={documentType}
              onChange={(e) => {
                const value = e.target.value as 'contract' | 'citizenship' | 'other';
                setDocumentType(value);
              }}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <option value="contract">Contract</option>
              <option value="citizenship">Citizenship</option>
              <option value="other">Other</option>
            </select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="files">Files</Label>
            <Input
              id="files"
              type="file"
              multiple
              onChange={handleFileChange}
              className="cursor-pointer"
            />
            {files.length > 0 && (
              <div className="mt-2 space-y-2">
                <p className="text-sm font-medium">Selected files:</p>
                <ScrollArea className="h-32 rounded-md border p-2">
                  <div className="space-y-1">
                    {files.map((file, index) => (
                      <div key={index} className="flex items-center justify-between text-sm">
                        <span className="truncate">{file.name}</span>
                        <span className="text-muted-foreground text-xs">
                          {(file.size / 1024).toFixed(1)} KB
                        </span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </div>
        </div>
        
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={uploading}>
            Cancel
          </Button>
          <Button onClick={handleUpload} disabled={!files.length || uploading}>
            {uploading ? "Uploading..." : "Upload"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const formatDate = (dateString: string) => {
  return new Date(dateString).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const Tenants = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [currentTenant, setCurrentTenant] = useState<{ id: string; name: string } | null>(null);
  const [viewingTenant, setViewingTenant] = useState<Tenant | null>(null);
  const [documentsByTenant, setDocumentsByTenant] = useState<Record<string, StoredDocument[]>>({});
  
  const fetchTenantDocuments = async (tenantId: string) => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('tenant_documents')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('uploaded_at', { ascending: false });
      
      if (error) throw error;
      
      // Map the database response to our StoredDocument interface
      const documents: StoredDocument[] = (data || []).map(doc => ({
        id: doc.id,
        name: doc.file_name || doc.name || 'Unnamed Document',
        path: doc.file_path || doc.path || '',
        size: doc.file_size || doc.size || 0,
        document_type: doc.document_type || 'other',
        uploaded_at: doc.uploaded_at || new Date().toISOString(),
        file_name: doc.file_name,
        file_path: doc.file_path,
        file_size: doc.file_size,
        mime_type: doc.mime_type,
        publicUrl: doc.file_path ? supabase.storage
          .from('documents')
          .getPublicUrl(doc.file_path).data.publicUrl : undefined
      }));
      
      setDocumentsByTenant(prev => ({
        ...prev,
        [tenantId]: documents
      }));
    } catch (error) {
      console.error('Error fetching documents:', error);
      toast({
        title: 'Error',
        description: 'Failed to load documents. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const getFrequencyMonths = (frequency: string) => {
    const map: { [key: string]: number } = {
      'monthly': 1,
      'bi-monthly': 2,
      'tri-monthly': 3,
      'semi-annually': 6,
      'yearly': 12
    };
    return map[frequency] || 1;
  };

  const calculateContractEndDate = (startDate: string, years: number, months: number) => {
    if (!startDate || (!years && !months)) return null;
    const endDate = new Date(startDate);
    endDate.setFullYear(endDate.getFullYear() + years);
    endDate.setMonth(endDate.getMonth() + months);
    endDate.setDate(endDate.getDate() - 1);
    return endDate.toISOString().split('T')[0];
  };

  const addMonths = (date: Date, months: number) => {
    const d = new Date(date);
    d.setMonth(d.getMonth() + months);
    return d;
  };

  const monthsBetweenInclusive = (from: Date, to: Date) => {
    return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth()) + 1;
  };

  const getEffectiveMonthlyRentForDate = (tenant: Tenant, onDate: Date) => {
    const start = new Date(tenant.contract_start_date);
    const intervalYears = Math.max(tenant.rent_increment_interval_years || 0, 0);
    const pct = Math.max(tenant.rent_increment_percentage || 0, 0) / 100;
    if (intervalYears === 0 || pct === 0) return tenant.monthly_rent;
    // Count how many full intervals elapsed by anniversary from start
    let intervals = 0;
    const check = new Date(start);
    while (true) {
      const next = new Date(check);
      next.setFullYear(next.getFullYear() + intervalYears);
      if (next <= onDate) {
        intervals += 1;
        check.setFullYear(check.getFullYear() + intervalYears);
      } else {
        break;
      }
    }
    return tenant.monthly_rent * Math.pow(1 + pct, intervals);
  };

  const buildYearlyBreakdown = (tenant: Tenant): YearlyBreakdownRow[] => {
    const start = new Date(tenant.contract_start_date);
    const endIso = calculateContractEndDate(
      tenant.contract_start_date,
      tenant.contract_period_years,
      tenant.contract_period_months
    );
    const end = endIso ? new Date(endIso) : addMonths(start, 12); // fallback 1 year

    const result: YearlyBreakdownRow[] = [];
    // Iterate calendar years overlapping contract period
    let cursor = new Date(start);
    while (cursor <= end) {
      const yearStart = new Date(cursor.getFullYear(), 0, 1);
      const yearEnd = new Date(cursor.getFullYear(), 11, 31);
      const periodStart = cursor < yearStart ? yearStart : cursor;
      const periodEnd = end < yearEnd ? end : yearEnd;
      if (periodStart > periodEnd) {
        cursor = new Date(cursor.getFullYear() + 1, 0, 1);
        continue;
      }
      // Months in this year within contract window
      const monthsInYear = monthsBetweenInclusive(
        new Date(periodStart.getFullYear(), periodStart.getMonth(), 1),
        new Date(periodEnd.getFullYear(), periodEnd.getMonth(), 1)
      );
      // Effective monthly rent for this year (based on Jan 1 of the year or contract start if same year)
      const referenceDate = new Date(periodStart.getFullYear(), periodStart.getMonth(), 1);
      const monthly = getEffectiveMonthlyRentForDate(tenant, referenceDate);
      result.push({
        yearLabel: String(periodStart.getFullYear()),
        months: monthsInYear,
        totalAmount: monthly * monthsInYear
      });
      cursor = new Date(cursor.getFullYear() + 1, 0, 1);
    }
    return result;
  };

  const fetchData = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('tenants')
        .select(`
          *,
          properties (name)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      setTenants(data || []);
      // After tenants load, fetch documents per tenant from storage
      if (data && data.length > 0) {
        loadDocumentsForTenants(data);
      }
    } catch (error) {
      console.error('Error fetching tenants:', error);
      toast({
        title: "Error",
        description: "Failed to fetch data",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const loadDocumentsForTenants = async (tenantList: Tenant[]) => {
    if (!user) return;
    try {
      // First, get all documents from the database
      const { data: documents, error: dbError } = await supabase
        .from('tenant_documents')
        .select('*')
        .in('tenant_id', tenantList.map(t => t.id));
      
      if (dbError) throw dbError;
      
      // Group documents by tenant ID
      const documentsByTenant: Record<string, StoredDocument[]> = {};
      
      for (const doc of documents || []) {
        const publicUrl = supabase.storage
          .from('documents')
          .getPublicUrl(doc.file_path).data.publicUrl;
          
        const storedDoc: StoredDocument = {
          id: doc.id,
          name: doc.file_name || 'Unnamed Document',
          path: doc.file_path,
          size: doc.file_size,
          document_type: doc.document_type || 'other',
          uploaded_at: doc.uploaded_at,
          file_name: doc.file_name,
          file_path: doc.file_path,
          file_size: doc.file_size,
          mime_type: doc.mime_type,
          publicUrl
        };
        
        if (!documentsByTenant[doc.tenant_id]) {
          documentsByTenant[doc.tenant_id] = [];
        }
        documentsByTenant[doc.tenant_id].push(storedDoc);
      }
      
      // Sort documents by upload date (newest first)
      for (const tenantId in documentsByTenant) {
        documentsByTenant[tenantId].sort((a, b) => 
          new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime()
        );
      }
      
      setDocumentsByTenant(documentsByTenant);
    } catch (err) {
      console.error('Failed loading documents:', err);
      toast({
        title: 'Error',
        description: 'Failed to load documents. Please try again.',
        variant: 'destructive',
      });
    }
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const handleDeleteDocument = async (tenantId: string, document: StoredDocument) => {
    if (!window.confirm(`Are you sure you want to delete "${document.name}"?`)) {
      return;
    }
    
    try {
      // Delete from storage
      const { error: storageError } = await supabase.storage
        .from('documents')
        .remove([document.path]);
      
      if (storageError) throw storageError;
      
      // Delete from database
      const { error: dbError } = await supabase
        .from('tenant_documents')
        .delete()
        .eq('id', document.id);
      
      if (dbError) throw dbError;
      
      // Update UI
      setDocumentsByTenant(prev => ({
        ...prev,
        [tenantId]: (prev[tenantId] || []).filter(doc => doc.id !== document.id)
      }));
      
      toast({
        title: 'Success',
        description: 'Document deleted successfully',
      });
      
    } catch (error) {
      console.error('Error deleting document:', error);
      toast({
        title: 'Error',
        description: 'Failed to delete document. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase
        .from('tenants')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      toast({ title: "Success", description: "Tenant deleted successfully" });
      fetchData();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete tenant",
        variant: "destructive"
      });
    }
  };

  const openViewDialog = (tenant: Tenant) => {
    setViewingTenant(tenant);
    setViewDialogOpen(true);
  };

  if (loading) return <div>Loading tenants...</div>;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-between sm:items-center">
        <h2 className="text-2xl font-bold">Tenants</h2>
        <Button onClick={() => navigate("/add-tenant")} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Tenant
        </Button>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {tenants.map((tenant) => (
          <Card key={tenant.id} className="transition-colors hover:bg-muted/50">
            <CardHeader>
              <CardTitle className="flex justify-between items-start">
                <span>{tenant.name}</span>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => openViewDialog(tenant)}
                    title="View Details"
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0"
                    onClick={() => navigate(`/edit-tenant/${tenant.id}`)}
                    title="Edit Tenant"
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                    onClick={() => handleDelete(tenant.id)}
                    title="Delete Tenant"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardTitle>
              <CardDescription>{tenant.properties?.name}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                <div><strong>Company:</strong> {tenant.company_name || 'N/A'}</div>
                <div><strong>Citizenship:</strong> {tenant.citizenship_number || 'N/A'}</div>
                <div><strong>Rent:</strong> ${tenant.monthly_rent} ({tenant.rent_frequency})</div>
                <div><strong>Contract:</strong> {new Date(tenant.contract_start_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })} - {(() => {
                  const endDate = calculateContractEndDate(tenant.contract_start_date, tenant.contract_period_years, tenant.contract_period_months);
                  return endDate ? new Date(endDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A';
                })()}</div>
                {tenant.rent_increment_percentage > 0 && (
                  <div><strong>Increment:</strong> {tenant.rent_increment_percentage}% every {tenant.rent_increment_interval_years} years</div>
                )}
                
                {/* Documents Section */}
                <div className="mt-4 pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Documents</span>
                      <span className="text-xs text-muted-foreground">
                        ({documentsByTenant[tenant.id]?.length || 0} files)
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => navigate(`/documents/${tenant.id}`)}
                      className="h-8 text-xs"
                    >
                      View All
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      
      {tenants.length === 0 && (
        <Card>
          <CardContent className="text-center py-12">
            <p className="text-muted-foreground">No tenants found. Add your first tenant to get started.</p>
          </CardContent>
        </Card>
      )}

      {/* Upload Documents Modal */}
      <UploadDocumentsModal
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        tenantId={currentTenant?.id || ''}
        tenantName={currentTenant?.name || 'Tenant'}
        onUploadSuccess={fetchData}
      />

      {/* View Tenant Details Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl mx-4">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold">Tenant Details</DialogTitle>
          </DialogHeader>
          {viewingTenant && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold">Basic Information</h4>
                  <div className="space-y-1 text-sm">
                    <div><strong>Name:</strong> {viewingTenant.name}</div>
                    <div><strong>Company:</strong> {viewingTenant.company_name || 'N/A'}</div>
                    <div><strong>Citizenship:</strong> {viewingTenant.citizenship_number || 'N/A'}</div>
                    <div><strong>Property:</strong> {viewingTenant.properties?.name}</div>
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold">Rent Information</h4>
                  <div className="space-y-1 text-sm">
                    <div><strong>Monthly Rent:</strong> ${viewingTenant.monthly_rent}</div>
                    <div><strong>Frequency:</strong> {viewingTenant.rent_frequency}</div>
                    <div><strong>Payable Amount:</strong> ${(viewingTenant.monthly_rent * getFrequencyMonths(viewingTenant.rent_frequency)).toLocaleString()}</div>
                    {viewingTenant.rent_increment_percentage > 0 && (
                      <div><strong>Increment:</strong> {viewingTenant.rent_increment_percentage}% every {viewingTenant.rent_increment_interval_years} years</div>
                    )}
                  </div>
                </div>
              </div>
              <div>
                <h4 className="font-semibold">Contract Period</h4>
                <div className="text-sm">
                  <div><strong>Start Date:</strong> {new Date(viewingTenant.contract_start_date).toLocaleDateString()}</div>
                  <div><strong>End Date:</strong> {(() => {
                    const endDate = calculateContractEndDate(viewingTenant.contract_start_date, viewingTenant.contract_period_years, viewingTenant.contract_period_months);
                    return endDate ? new Date(endDate).toLocaleDateString() : 'N/A';
                  })()}</div>
                  <div><strong>Duration:</strong> {viewingTenant.contract_period_years} years, {viewingTenant.contract_period_months} months</div>
                </div>
              </div>
              <div>
                <h4 className="font-semibold">Yearly Rent Breakdown</h4>
                <div className="mt-2 border rounded">
                  <div className="grid grid-cols-3 text-xs font-medium px-3 py-2 border-b bg-muted/30">
                    <div>Year</div>
                    <div className="text-center">Months</div>
                    <div className="text-right">Total</div>
                  </div>
                  {buildYearlyBreakdown(viewingTenant).map((row) => (
                    <div key={row.yearLabel} className="grid grid-cols-3 text-xs px-3 py-2 border-b last:border-b-0">
                      <div>{row.yearLabel}</div>
                      <div className="text-center">{row.months}</div>
                      <div className="text-right">${row.totalAmount.toLocaleString()}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={() => navigate(`/edit-tenant/${viewingTenant.id}`)} className="gap-2">
                  <Edit className="h-4 w-4" />
                  Edit Tenant
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Tenants;