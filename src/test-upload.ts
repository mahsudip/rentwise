import { supabase } from "./integrations/supabase/client";

async function testUpload() {
  try {
    console.log("Testing Supabase connection...");
    
    // Test listing storage buckets
    const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
    
    if (bucketError) {
      console.error("Error listing buckets:", bucketError);
      return;
    }
    
    console.log("Available buckets:", buckets);
    
    // Test listing tenants
    const { data: tenants, error: tenantError } = await supabase
      .from('tenants')
      .select('id, name')
      .limit(5);
      
    if (tenantError) {
      console.error("Error fetching tenants:", tenantError);
      return;
    }
    
    console.log("Available tenants:", tenants);
    
  } catch (error) {
    console.error("Test failed:", error);
  }
}

testUpload();
