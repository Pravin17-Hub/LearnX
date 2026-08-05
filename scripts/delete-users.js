// scripts/delete-users.js - Deletes specified users from Supabase Auth and public profile tables
const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Manually load and parse .env.local
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
      const [key, ...valueParts] = trimmed.split('=');
      const val = valueParts.join('=').trim();
      process.env[key.trim()] = val.replace(/^["']|["']$/g, ''); // strip quotes
    }
  });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

const USERNAMES_TO_DELETE = ['virat365', 'pravin17xyz149'];

async function deleteUsers() {
  console.log('Fetching user details for deletion...', USERNAMES_TO_DELETE);

  try {
    // Fetch all auth users to find their UUIDs by email
    console.log('Listing auth users...');
    const { data: { users: authUsers }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) {
      throw new Error(`Failed to list auth users: ${listError.message}`);
    }

    for (const username of USERNAMES_TO_DELETE) {
      console.log(`\n--- Processing @${username} ---`);

      // 1. Fetch public profile
      const { data: user, error: fetchError } = await supabaseAdmin
        .from('users')
        .select('id, email, name')
        .eq('username', username)
        .maybeSingle();

      if (fetchError) {
        console.error(`Error fetching user profile for ${username}:`, fetchError.message);
        continue;
      }

      if (!user) {
        console.log(`User @${username} not found in public.users table.`);
        continue;
      }

      console.log(`Found public profile @${username}: Name="${user.name}", Email="${user.email}", SerialID="${user.id}".`);

      // 2. Find auth user by email
      const matchedAuthUser = authUsers.find(au => au.email?.toLowerCase() === user.email?.toLowerCase());

      if (matchedAuthUser) {
        console.log(`Found matching Auth record for ${user.email} (AuthUUID: ${matchedAuthUser.id}). Deleting...`);
        const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(matchedAuthUser.id);
        if (authDeleteError) {
          console.error(`Warning: Failed to delete auth record for ${user.email}:`, authDeleteError.message);
        } else {
          console.log(`Successfully deleted auth record for ${user.email}.`);
        }
      } else {
        console.log(`No matching Auth record found for email ${user.email} (might be a mock seeded user).`);
      }

      // 3. Delete from public.users table (and cascade dependents)
      console.log(`Deleting public.users profile for @${username}...`);
      const { error: profileDeleteError } = await supabaseAdmin
        .from('users')
        .delete()
        .eq('id', user.id);

      if (profileDeleteError) {
        console.error(`Error deleting profile for @${username}:`, profileDeleteError.message);
      } else {
        console.log(`Successfully deleted public.users profile for @${username}.`);
      }
    }
  } catch (err) {
    console.error('Error during deletion process:', err.message);
  }

  console.log('\nUser deletion process complete.');
}

deleteUsers();
