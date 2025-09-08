import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://kqmillfrmetkjikevqvs.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtxbWlsbGZybWV0a2ppa2V2cXZzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4MTE3NDAsImV4cCI6MjA3MjM4Nzc0MH0.wK_6DaecOCwwpiMdC0uYIUFtzGHKeY63eSzumpWMSwY';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testFileUpload() {
  try {
    // Create a test file
    const file = new File(['test content'], 'test.txt', { type: 'text/plain' });
    const filePath = `test-uploads/test-${Date.now()}.txt`;
    
    console.log('Uploading test file to:', filePath);
    
    // Upload the file
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false
      });
    
    if (uploadError) {
      console.error('Upload error:', uploadError);
      return;
    }
    
    console.log('Upload successful:', uploadData);
    
    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('documents')
      .getPublicUrl(filePath);
    
    console.log('Public URL:', publicUrl);
    
    // Try to download the file
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('documents')
      .download(filePath);
    
    if (downloadError) {
      console.error('Download error:', downloadError);
      return;
    }
    
    const text = await fileData.text();
    console.log('Downloaded file content:', text);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testFileUpload();
