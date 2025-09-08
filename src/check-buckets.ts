import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kqmillfrmetkjikevqvs.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtxbWlsbGZybWV0a2ppa2V2cXZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4MTE3NDAsImV4cCI6MjA3MjM4Nzc0MH0.wK_6DaecOCwwpiMdC0uYIUFtzGHKeY63eSzumpWMSwY';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkBuckets() {
  try {
    const { data, error } = await supabase.storage.listBuckets();
    
    if (error) {
      console.error('Error listing buckets:', error);
      return;
    }
    
    console.log('Available buckets:');
    console.table(data);
    
    // Check if 'documents' bucket exists
    const documentsBucket = data.find(b => b.name === 'documents');
    if (documentsBucket) {
      console.log('\nDocuments bucket exists and is accessible');
      
      // Try to list files in the documents bucket
      const { data: files, error: listError } = await supabase.storage
        .from('documents')
        .list();
        
      if (listError) {
        console.error('Error listing files in documents bucket:', listError);
      } else {
        console.log('\nFiles in documents bucket:');
        console.table(files);
      }
    } else {
      console.log('\nDocuments bucket does not exist or is not accessible');
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkBuckets();
