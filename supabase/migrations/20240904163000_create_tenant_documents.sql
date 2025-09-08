-- Create tenant_documents table
CREATE TABLE IF NOT EXISTS public.tenant_documents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.tenant_documents ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own tenant documents" 
  ON public.tenant_documents 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own tenant documents"
  ON public.tenant_documents
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tenant documents"
  ON public.tenant_documents
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tenant documents"
  ON public.tenant_documents
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_tenant_documents_tenant_id ON public.tenant_documents(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tenant_documents_user_id ON public.tenant_documents(user_id);
