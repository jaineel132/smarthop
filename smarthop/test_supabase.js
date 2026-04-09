
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testSupabase() {
  console.log('Testing Supabase connection and select...');
  const { data: stations, error: sError } = await supabase
    .from('metro_stations')
    .select('id, name')
    .limit(1);

  if (sError) {
    console.error('Select failed:', sError);
    return;
  }
  console.log('Select success, station found:', stations[0]?.name);

  console.log('Testing insert into ride_requests...');
  const { data, error } = await supabase
    .from('ride_requests')
    .insert({
      user_id: 'c6b9ed1c-a290-42b9-b5a7-25a59e265686', // From logs
      pickup_station_id: stations[0]?.id,
      dest_lat: 19.1136,
      dest_lng: 72.8697,
      dest_address: 'Test Address',
      hour: 10,
      day_of_week: 1,
      demand_level: 0.5,
      status: 'pending'
    })
    .select();
    
  if (error) {
    console.error('Insert failed:', error);
  } else {
    console.log('Insert success:', data);
  }
}

testSupabase();
