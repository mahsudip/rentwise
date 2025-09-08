import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/types/database.types";

type TableName = keyof Database['public']['Tables'];
type InsertType<T extends TableName> = Database['public']['Tables'][T]['Insert'];

export const db = {
  async insert<T extends TableName>(
    table: T,
    data: Omit<InsertType<T>, 'id' | 'created_at' | 'updated_at'>
  ) {
    const now = new Date().toISOString();
    const result = await supabase
      .from(table)
      .insert({
        ...data,
        created_at: now,
        updated_at: now
      } as any)
      .select()
      .single();
    
    if (result.error) throw result.error;
    return result.data;
  }
};
