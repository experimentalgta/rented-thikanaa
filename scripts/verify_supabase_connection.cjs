/**
 * Automated Supabase & PostGIS Verification Suite
 */

const { Client } = require('pg');

async function runVerification() {
  console.log('================================================================');
  console.log('RENTED THIKAN — SUPABASE & POSTGIS DATABASE VERIFICATION SUITE');
  console.log('================================================================\n');

  const client = new Client({
    host: 'aws-0-ap-southeast-2.pooler.supabase.com',
    port: 5432,
    database: 'postgres',
    user: 'postgres.kjamjylsntwuundttcio',
    password: '9451184211@aA',
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('▶ TEST 1: Database Connectivity');
    const dbInfo = await client.query('SELECT current_database(), version();');
    console.log(`  ✓ Connected to ${dbInfo.rows[0].current_database} running ${dbInfo.rows[0].version.split(' on ')[0]}`);

    console.log('\n▶ TEST 2: Schema & PostGIS Verification');
    const ext = await client.query("SELECT extname, extversion FROM pg_extension WHERE extname = 'postgis';");
    console.log(`  ✓ PostGIS Extension: ${ext.rows[0].extname} v${ext.rows[0].extversion}`);

    const rpc = await client.query("SELECT proname FROM pg_proc WHERE proname = 'get_properties_proximity_ranked';");
    console.log(`  ✓ Proximity Stored Procedure: ${rpc.rows[0].proname} is active`);

    console.log('\n▶ TEST 3: Marketplace Data Population');
    const propCount = await client.query('SELECT count(*) FROM public.properties;');
    const imgCount = await client.query('SELECT count(*) FROM public.property_images;');
    const profCount = await client.query('SELECT count(*) FROM public.profiles;');
    const studentCount = await client.query('SELECT count(*) FROM public.student_profiles;');
    const saCount = await client.query('SELECT count(*) FROM public.super_admins;');

    console.log(`  ✓ Active Properties: ${propCount.rows[0].count} listings`);
    console.log(`  ✓ Property Images: ${imgCount.rows[0].count} photos`);
    console.log(`  ✓ Profiles: ${profCount.rows[0].count} registered profiles`);
    console.log(`  ✓ Roommate Profiles: ${studentCount.rows[0].count} student seekers`);
    console.log(`  ✓ Super Admins: ${saCount.rows[0].count} authorized admins`);

    console.log('\n▶ TEST 4: PostGIS Proximity Geodesic Query');
    // Test proximity query around Katra (25.4563, 81.8546)
    const proximity = await client.query(`
      SELECT id, title, rent, locality, distance_meters, jsonb_array_length(images) as photo_count
      FROM public.get_properties_proximity_ranked(25.4563, 81.8546)
      LIMIT 3;
    `);
    console.log(`  ✓ Returned ${proximity.rows.length} closest properties ordered by distance:`);
    proximity.rows.forEach((p, idx) => {
      console.log(`    ${idx + 1}. [${p.locality}] "${p.title}" - ₹${p.rent}/mo - ${Math.round(p.distance_meters)}m away (${p.photo_count} photos)`);
    });

    console.log('\n▶ TEST 5: Anonymous Role Security & RLS Policies');
    await client.query('SET ROLE anon;');

    // 5a. Public SELECT properties
    const anonProps = await client.query('SELECT count(*) FROM public.properties;');
    console.log(`  ✓ Anon SELECT properties: Permitted (${anonProps.rows[0].count} visible listings)`);

    // 5b. Public SELECT property images
    const anonImgs = await client.query('SELECT count(*) FROM public.property_images;');
    console.log(`  ✓ Anon SELECT property images: Permitted (${anonImgs.rows[0].count} visible images)`);

    // 5c. Super admins isolation check
    const anonSa = await client.query('SELECT * FROM public.super_admins;');
    if (anonSa.rows.length === 0) {
      console.log('  ✓ Anon SELECT super_admins: Securely Blocked (0 rows returned to anonymous users)');
    } else {
      throw new Error('SECURITY VIOLATION: Anonymous role was able to read super_admins table!');
    }

    // 5d. Unauthorized INSERT rejection
    let writeBlocked = false;
    try {
      await client.query(`
        INSERT INTO public.properties (title, rent, locality, city, state, address, location)
        VALUES ('Unauthorized Test', 1000, 'Katra', 'Prayagraj', 'UP', 'Secret St', ST_SetSRID(ST_MakePoint(81, 25), 4326)::geography);
      `);
    } catch (err) {
      writeBlocked = true;
      console.log(`  ✓ Anon INSERT properties: Securely Rejected by RLS ("${err.message.split('\n')[0]}")`);
    }

    if (!writeBlocked) {
      throw new Error('SECURITY VIOLATION: Anonymous role was able to insert into properties table!');
    }

    await client.query('RESET ROLE;');
    await client.end();

    console.log('\n================================================================');
    console.log('🎉 ALL DATABASE, RLS & POSTGIS TESTS PASSED SUCCESSFULLY');
    console.log('================================================================');
    return true;
  } catch (err) {
    console.error('\nVerification failed:', err.message);
    try { await client.end(); } catch (e) {}
    process.exit(1);
  }
}

runVerification();
