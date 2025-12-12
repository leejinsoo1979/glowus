const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

// Load environment variables
require('dotenv').config({ path: '/Users/jinsoolee/Downloads/startupshow/.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const updateData = JSON.parse(fs.readFileSync('/tmp/eni_update.json', 'utf-8'));

async function updateAgent() {
  const { data, error } = await supabase
    .from('deployed_agents')
    .update({
      name: updateData.name,
      description: updateData.description,
      workflow_nodes: updateData.workflow_nodes,
      workflow_edges: updateData.workflow_edges,
      capabilities: updateData.capabilities,
      updated_at: new Date().toISOString()
    })
    .eq('id', 'fb1ad76a-5ee4-412d-8854-84fa8351d27b')
    .select()
    .single();

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Success! Updated agent:');
    console.log('Name:', data.name);
    console.log('Description:', data.description);
    console.log('Capabilities:', data.capabilities);
    console.log('Nodes count:', data.workflow_nodes?.length || 0);
    console.log('Edges count:', data.workflow_edges?.length || 0);
  }
}

updateAgent();
