-- Create properties table
CREATE TABLE public.properties (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create tenants table
CREATE TABLE public.tenants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  company_name TEXT,
  citizenship_number TEXT,
  monthly_rent DECIMAL(10,2) NOT NULL,
  rent_frequency TEXT NOT NULL CHECK (rent_frequency IN ('monthly', 'bi-monthly', 'tri-monthly', 'semi-annually', 'yearly')),
  contract_start_date DATE NOT NULL,
  contract_period_years INTEGER DEFAULT 0,
  contract_period_months INTEGER DEFAULT 0,
  contract_end_date DATE,
  rent_increment_percentage DECIMAL(5,2) DEFAULT 0,
  rent_increment_interval_years INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create rent_payments table
CREATE TABLE public.rent_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  paid BOOLEAN DEFAULT FALSE,
  payment_date DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rent_payments ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for properties
CREATE POLICY "Users can view their own properties" ON public.properties
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own properties" ON public.properties
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own properties" ON public.properties
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own properties" ON public.properties
  FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for tenants
CREATE POLICY "Users can view their own tenants" ON public.tenants
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own tenants" ON public.tenants
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tenants" ON public.tenants
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tenants" ON public.tenants
  FOR DELETE USING (auth.uid() = user_id);

-- Create RLS policies for rent_payments
CREATE POLICY "Users can view their own rent payments" ON public.rent_payments
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own rent payments" ON public.rent_payments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own rent payments" ON public.rent_payments
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own rent payments" ON public.rent_payments
  FOR DELETE USING (auth.uid() = user_id);

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_properties_updated_at
  BEFORE UPDATE ON public.properties
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tenants_updated_at
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_rent_payments_updated_at
  BEFORE UPDATE ON public.rent_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to auto-calculate contract end date
CREATE OR REPLACE FUNCTION public.calculate_contract_end_date()
RETURNS TRIGGER AS $$
BEGIN
  NEW.contract_end_date = NEW.contract_start_date + 
    INTERVAL '1 year' * NEW.contract_period_years + 
    INTERVAL '1 month' * NEW.contract_period_months;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger to auto-calculate contract end date
CREATE TRIGGER calculate_tenant_contract_end_date
  BEFORE INSERT OR UPDATE ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.calculate_contract_end_date();

-- Create tenant_documents table
CREATE TABLE public.tenant_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  document_type TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type TEXT,
  uploaded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS for tenant_documents
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

-- Create trigger for tenant_documents timestamp updates
CREATE TRIGGER update_tenant_documents_updated_at
  BEFORE UPDATE ON public.tenant_documents
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();