import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { FileText, Upload as UploadIcon, Download, Trash2, Eye, ArrowLeft, FileType2, FileDigit, FileCheck2 } from 'lucide-react';

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

export default function Documents() {
  const { tenantId } = useParams<{ tenantId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [documents, setDocuments] = useState<StoredDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [documentType, setDocumentType] = useState<'contract' | 'citizenship' | 'tax_record' | 'other'>('contract');
  const [activeTab, setActiveTab] = useState<'contract' | 'citizenship' | 'tax_record' | 'other'>('contract');
  const [tenant, setTenant] = useState<{ id: string; name: string } | null>(null);

  useEffect(() => {
    if (tenantId) {
      fetchTenantData();
      fetchDocuments();
    }
  }, [tenantId]);

  const fetchTenantData = async () => {
    try {
      const { data, error } = await supabase
        .from('tenants')
        .select('id, name')
        .eq('id', tenantId)
        .single();
      
      if (error) throw error;
      setTenant(data);
    } catch (error) {
      console.error('Error fetching tenant data:', error);
      toast({
        title: 'Error',
        description: 'Failed to load tenant information',
        variant: 'destructive',
      });
    }
  };

  const fetchDocuments = async () => {
    if (!tenantId) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('tenant_documents')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('uploaded_at', { ascending: false });
      
      if (error) throw error;
      
      const documentsWithUrls = (data || []).map(doc => ({
        ...doc,
        name: doc.file_name || 'Unnamed Document',
        path: doc.file_path,
        size: doc.file_size,
        document_type: doc.document_type || 'other',
        uploaded_at: doc.uploaded_at,
        publicUrl: doc.file_path ? supabase.storage
          .from('documents')
          .getPublicUrl(doc.file_path).data.publicUrl : undefined
      }));
      
      setDocuments(documentsWithUrls);
    } catch (error) {
      console.error('Error fetching documents:', error);
      toast({
        title: 'Error',
        description: 'Failed to load documents',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  const handleUpload = async () => {
    if (!tenantId || !files.length) return;
    
    setUploading(true);
    
    try {
      const uploadPromises = files.map(async (file) => {
        const fileExt = file.name.split('.').pop();
        const fileName = `${tenantId}/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
        const filePath = `${documentType}/${fileName}`;
        
        // Upload file to storage
        const { error: uploadError } = await supabase.storage
          .from('documents')
          .upload(filePath, file);
        
        if (uploadError) throw uploadError;
        
        // Save document metadata to database
        const { error: dbError } = await supabase
          .from('tenant_documents')
          .insert({
            tenant_id: tenantId,
            file_name: file.name,
            file_path: filePath,
            file_size: file.size,
            mime_type: file.type,
            document_type: documentType,
            uploaded_at: new Date().toISOString(),
            user_id: user?.id
          });
        
        if (dbError) throw dbError;
      });
      
      await Promise.all(uploadPromises);
      
      toast({
        title: 'Success',
        description: 'Documents uploaded successfully',
      });
      
      // Refresh documents
      await fetchDocuments();
      setFiles([]);
      
    } catch (error) {
      console.error('Error uploading files:', error);
      toast({
        title: 'Error',
        description: 'Failed to upload files. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (document: StoredDocument) => {
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
      setDocuments(prev => prev.filter(doc => doc.id !== document.id));
      
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

  // Group documents by type
  const groupedDocuments = documents.reduce((acc, doc) => {
    const type = doc.document_type || 'other';
    if (!acc[type]) {
      acc[type] = [];
    }
    acc[type].push(doc);
    return acc;
  }, {} as Record<string, StoredDocument[]>);

  // Document type configurations
  const documentTypes = [
    { id: 'contract', label: 'Contracts', icon: <FileType2 className="h-4 w-4 mr-2" /> },
    { id: 'citizenship', label: 'Citizenship', icon: <FileDigit className="h-4 w-4 mr-2" /> },
    { id: 'tax_record', label: 'Tax Records', icon: <FileCheck2 className="h-4 w-4 mr-2" /> },
    { id: 'other', label: 'Other', icon: <FileText className="h-4 w-4 mr-2" /> },
  ];

  // Render documents for a specific type
  const renderDocuments = (type: string) => {
    const docs = groupedDocuments[type] || [];
    
    if (docs.length === 0) {
      return (
        <div className="text-center py-12 bg-muted/30 rounded-lg">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
          <p className="text-muted-foreground">No {type.replace('_', ' ')} documents found</p>
          <p className="text-sm text-muted-foreground mt-1">Upload a document to get started</p>
        </div>
      );
    }

    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {docs.map((doc) => (
          <Card key={doc.id} className="flex flex-col h-full hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <span className="font-medium truncate max-w-[200px]">{doc.name}</span>
                </div>
                <div className="flex items-center space-x-1">
                  {doc.publicUrl && (
                    <>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => window.open(doc.publicUrl, '_blank')}
                        title="View"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <a 
                        href={doc.publicUrl} 
                        download 
                        className="inline-flex items-center justify-center h-8 w-8 rounded-md hover:bg-muted"
                        title="Download"
                      >
                        <Download className="h-4 w-4" />
                      </a>
                    </>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => handleDelete(doc)}
                    title="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1">
              <div className="text-sm text-muted-foreground space-y-1">
                <p>Type: {doc.document_type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}</p>
                <p>Size: {formatFileSize(doc.size || 0)}</p>
                <p>Uploaded: {formatDate(doc.uploaded_at)}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64">Loading...</div>;
  }

  return (
    <div className="container mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/?tab=tenants')} className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Dashboard
          </Button>
          <h1 className="text-2xl font-bold">
            {tenant?.name || 'Tenant'}'s Document
          </h1>
        </div>
      </div>
      
      <Card>
        <CardHeader>
          <CardTitle>Upload New Documents</CardTitle>
          <CardDescription>Upload contract, citizenship, or other tenant-related documents</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="documentType">Document Type</Label>
              <select
                id="documentType"
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value as 'contract' | 'citizenship' | 'tax_record' | 'other')}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <option value="contract">Contract</option>
                <option value="citizenship">Citizenship</option>
                <option value="tax_record">Tax Record</option>
                <option value="other">Other</option>
              </select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="files">Select Files</Label>
              <Input
                id="files"
                type="file"
                multiple
                onChange={handleFileChange}
                disabled={uploading}
              />
              <p className="text-sm text-muted-foreground">
                {files.length > 0 
                  ? `${files.length} file(s) selected` 
                  : 'Select one or more files to upload'}
              </p>
            </div>
            
            <Button 
              onClick={handleUpload} 
              disabled={!files.length || uploading}
              className="w-full sm:w-auto"
            >
              {uploading ? 'Uploading...' : 'Upload Documents'}
            </Button>
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Document Library</CardTitle>
              <CardDescription>Browse documents by category</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Tabs 
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as any)}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-4">
              {documentTypes.map((type) => (
                <TabsTrigger 
                  key={type.id} 
                  value={type.id}
                  className="flex items-center justify-center gap-2"
                >
                  {type.icon}
                  <span className="hidden sm:inline">{type.label}</span>
                  {(groupedDocuments[type.id]?.length || 0) > 0 && (
                    <span className="ml-1 text-xs bg-muted-foreground/20 rounded-full h-5 w-5 flex items-center justify-center">
                      {groupedDocuments[type.id]?.length || 0}
                    </span>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
            
            {documentTypes.map((type) => (
              <TabsContent key={type.id} value={type.id} className="mt-6">
                {renderDocuments(type.id)}
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
