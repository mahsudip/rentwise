-- Create tenant_documents table for document uploads
CREATE TABLE public.tenant_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL CHECK (document_type IN ('contract', 'citizenship', 'other')),
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enhance rent_payments table with payment method and additional fields
ALTER TABLE public.rent_payments 
ADD COLUMN payment_method TEXT CHECK (payment_method IN ('cash', 'cheque', 'bank_deposit')),
ADD COLUMN cheque_number TEXT,
ADD COLUMN issue_bank TEXT,
ADD COLUMN deposit_bank TEXT,
ADD COLUMN notes TEXT;

-- Enable Row Level Security for tenant_documents
ALTER TABLE public.tenant_documents ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for tenant_documents
CREATE POLICY "Users can view their own tenant documents" ON public.tenant_documents
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own tenant documents" ON public.tenant_documents
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tenant documents" ON public.tenant_documents
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tenant documents" ON public.tenant_documents
  FOR DELETE USING (auth.uid() = user_id);

-- Create trigger for automatic timestamp updates on tenant_documents
CREATE TRIGGER update_tenant_documents_updated_at
  BEFORE UPDATE ON public.tenant_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
