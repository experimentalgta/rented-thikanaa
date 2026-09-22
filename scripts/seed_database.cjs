/**
 * Idempotent Database Seed Script for Rented Thikana
 * Seeds initial approved demo listings, profiles, and super admins into PostgreSQL.
 */

const { Client } = require('pg');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Helper to produce deterministic UUID from string ID
function toUUID(str) {
  const hash = crypto.createHash('md5').update('rented-thikan-' + str).digest('hex');
  return [
    hash.substring(0, 8),
    hash.substring(8, 12),
    hash.substring(12, 16),
    hash.substring(16, 20),
    hash.substring(20, 32)
  ].join('-');
}

async function ensureAuthUser(client, id, email) {
  await client.query(`
    INSERT INTO auth.users (
      id, aud, role, email, is_sso_user, is_anonymous, created_at, updated_at
    ) VALUES (
      $1, 'authenticated', 'authenticated', $2, false, false, NOW(), NOW()
    ) ON CONFLICT (id) DO NOTHING;
  `, [id, email]);
}

async function runSeed() {
  const client = new Client({
    host: 'aws-0-ap-southeast-2.pooler.supabase.com',
    port: 6543,
    database: 'postgres',
    user: 'postgres.kjamjylsntwuundttcio',
    password: '9451184211@aA',
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to Supabase PostgreSQL. Starting seed...');

    // 1. SEED PROFILES
    const profiles = [
      {
        id: toUUID('admin-1'),
        full_name: 'Rented Thikan Trust & Safety',
        email: 'moderation@rentedthikan.in',
        phone_number: '+91 94500 00001',
        account_type: 'super_admin',
        avatar_url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&w=200&q=80',
        phone_privacy: 'private',
        is_verified: true,
        college: 'Allahabad University',
        occupation: 'Platform Administrator',
        bio: 'Official Rented Thikan Moderation Team'
      },
      {
        id: toUUID('user-member-1'),
        full_name: 'Ankit Tiwari',
        email: 'ankit.tiwari@allduniv.ac.in',
        phone_number: '+91 98394 55123',
        account_type: 'user',
        avatar_url: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&w=200&q=80',
        phone_privacy: 'on_request',
        is_verified: true,
        college: 'Allahabad University (AU)',
        occupation: 'Student / Civil Services Aspirant',
        bio: 'Preparing for UPSC & State PCS in Katra.'
      },
      {
        id: toUUID('owner-101'),
        full_name: 'Pandey Nilayam Residency',
        email: 'pandey.nilayam@rentedthikan.in',
        phone_number: '+91 94152 38472',
        account_type: 'user',
        avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=80',
        phone_privacy: 'on_request',
        is_verified: true,
        college: '',
        occupation: 'Property Owner / Host',
        bio: 'Providing student accommodation in Katra for 15+ years.'
      },
      {
        id: toUUID('owner-102'),
        full_name: 'Mrs. Pratibha Mishra',
        email: 'pratibha.mishra@rentedthikan.in',
        phone_number: '+91 94512 89341',
        account_type: 'user',
        avatar_url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=200&q=80',
        phone_privacy: 'on_request',
        is_verified: true,
        college: '',
        occupation: 'Resident Caretaker',
        bio: 'Safe student accommodations for girls in Katra.'
      }
    ];

    for (const p of profiles) {
      await ensureAuthUser(client, p.id, p.email);
      await client.query(`
        INSERT INTO public.profiles (
          id, full_name, email, phone_number, account_type, avatar_url, phone_privacy, is_verified, college, occupation, bio
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT (id) DO UPDATE SET
          full_name = EXCLUDED.full_name,
          phone_number = EXCLUDED.phone_number,
          avatar_url = EXCLUDED.avatar_url,
          bio = EXCLUDED.bio;
      `, [
        p.id, p.full_name, p.email, p.phone_number, p.account_type, p.avatar_url, p.phone_privacy, p.is_verified, p.college, p.occupation, p.bio
      ]);
    }
    console.log(`Seeded ${profiles.length} profiles.`);

    // 2. SEED SUPER ADMIN
    await client.query(`
      INSERT INTO public.super_admins (user_id)
      VALUES ($1)
      ON CONFLICT (user_id) DO NOTHING;
    `, [toUUID('admin-1')]);
    console.log('Seeded super_admin record.');

    // 3. READ & SEED APPROVED PROPERTIES FROM mockProperties.ts
    const mockFile = fs.readFileSync(path.join(__dirname, '../src/data/mockProperties.ts'), 'utf8');
    
    const cleanJs = mockFile
      .replace(/import\s+[^;]+;/g, '')
      .replace(/export\s+const\s+MOCK_PROPERTIES:\s*Property\[\]\s*=/, 'module.exports =')
      .replace(/:\s*Property\[\]/g, '');

    const tempPath = path.join(__dirname, 'temp_mock.cjs');
    fs.writeFileSync(tempPath, cleanJs);
    const mockProperties = require(tempPath);
    fs.unlinkSync(tempPath);

    console.log(`Loaded ${mockProperties.length} approved sample properties from mockProperties.ts.`);

    let propCount = 0;
    let imgCount = 0;

    for (const prop of mockProperties) {
      const propUUID = toUUID(prop.id);
      const ownerUUID = toUUID(prop.owner_id || 'owner-101');
      const ownerEmail = `${prop.owner_id || 'owner'}@rentedthikan.in`;

      // Ensure auth user and profile exist for owner
      await ensureAuthUser(client, ownerUUID, ownerEmail);
      await client.query(`
        INSERT INTO public.profiles (id, full_name, email, phone_number, account_type, phone_privacy, is_verified)
        VALUES ($1, $2, $3, $4, 'user', 'on_request', true)
        ON CONFLICT (id) DO UPDATE SET
          full_name = EXCLUDED.full_name;
      `, [
        ownerUUID,
        prop.owner_name || 'Listing Owner',
        ownerEmail,
        prop.owner_phone || '+91 94150 00000'
      ]);

      const insertPropSql = `
        INSERT INTO public.properties (
          id, owner_id, created_by, lister_type, title, slug, description,
          property_type, gender_preference, room_type, rent, security_deposit,
          electricity_billing, maintenance_fee, available_from, vacancies,
          floor, total_floors, furnishing_status, attached_bathroom, balcony,
          availability_status, is_verified, verification_badge, is_featured, is_demo,
          locality, sub_locality, landmark, city, state, pincode, address,
          location, amenities, rules, phone_privacy
        ) VALUES (
          $1, $2, $2, 'owner', $3, $4, $5,
          $6, $7, $8, $9, $10,
          $11, $12, $13, $14,
          $15, $16, $17, $18, $19,
          $20, $21, $22, $23, true,
          $24, $25, $26, $27, $28, $29, $30,
          ST_SetSRID(ST_MakePoint($31, $32), 4326)::geography,
          $33, $34, $35
        )
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          rent = EXCLUDED.rent,
          locality = EXCLUDED.locality,
          city = EXCLUDED.city,
          state = EXCLUDED.state,
          address = EXCLUDED.address,
          location = EXCLUDED.location,
          amenities = EXCLUDED.amenities,
          rules = EXCLUDED.rules;
      `;

      await client.query(insertPropSql, [
        propUUID,
        ownerUUID,
        prop.title,
        prop.slug || prop.id,
        prop.description || '',
        prop.property_type || 'pg',
        prop.gender_preference || 'any',
        prop.room_type || 'single',
        Number(prop.rent) || 5000,
        Number(prop.security_deposit) || 5000,
        prop.electricity_billing || 'included',
        Number(prop.maintenance_fee) || 0,
        prop.available_from || 'Immediately',
        Number(prop.vacancies) || 1,
        Number(prop.floor) || 1,
        Number(prop.total_floors) || 2,
        prop.furnishing_status || 'semi_furnished',
        Boolean(prop.attached_bathroom),
        Boolean(prop.balcony),
        prop.availability_status || 'available',
        Boolean(prop.is_verified),
        prop.verification_badge || null,
        Boolean(prop.is_featured),
        prop.locality,
        prop.sub_locality || null,
        prop.landmark || null,
        prop.city,
        prop.state,
        prop.pincode || '',
        prop.address,
        Number(prop.longitude),
        Number(prop.latitude),
        prop.amenities || [],
        prop.rules || [],
        prop.phone_privacy || 'on_request'
      ]);
      propCount++;

      // Seed images
      if (prop.images && prop.images.length > 0) {
        for (let i = 0; i < prop.images.length; i++) {
          const img = prop.images[i];
          const imgUUID = toUUID(`${prop.id}-img-${i}`);
          await client.query(`
            INSERT INTO public.property_images (id, property_id, url, caption, is_cover, sort_order)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (id) DO UPDATE SET
              url = EXCLUDED.url,
              caption = EXCLUDED.caption,
              is_cover = EXCLUDED.is_cover;
          `, [
            imgUUID,
            propUUID,
            img.url,
            img.caption || '',
            Boolean(img.is_cover),
            i
          ]);
          imgCount++;
        }
      }
    }

    console.log(`Seeded ${propCount} properties and ${imgCount} images into Supabase.`);

    // 4. SEED STUDENT PROFILES (mockRoommates.ts)
    const mockRoommatesFile = fs.readFileSync(path.join(__dirname, '../src/data/mockRoommates.ts'), 'utf8');
    const cleanRoommatesJs = mockRoommatesFile
      .replace(/import\s+[^;]+;/g, '')
      .replace(/export\s+const\s+MOCK_ROOMMATES:\s*StudentProfile\[\]\s*=/, 'module.exports =')
      .replace(/:\s*StudentProfile\[\]/g, '');

    const tempRoommatePath = path.join(__dirname, 'temp_roommates.cjs');
    fs.writeFileSync(tempRoommatePath, cleanRoommatesJs);
    const mockRoommates = require(tempRoommatePath);
    fs.unlinkSync(tempRoommatePath);

    console.log(`Loaded ${mockRoommates.length} approved roommate profiles.`);
    let roommateCount = 0;
    for (const rm of mockRoommates) {
      const studentUUID = toUUID(rm.id);
      const studentEmail = `${rm.id}@allduniv.ac.in`;
      await ensureAuthUser(client, studentUUID, studentEmail);
      await client.query(`
        INSERT INTO public.profiles (id, full_name, email, phone_number, account_type, avatar_url, phone_privacy, is_verified, college, bio)
        VALUES ($1, $2, $3, $4, 'user', $5, 'on_request', true, $6, $7)
        ON CONFLICT (id) DO NOTHING;
      `, [studentUUID, rm.full_name, studentEmail, rm.phone_number || '+91 98000 00000', rm.avatar_url || '', rm.college, rm.bio || '']);

      await client.query(`
        INSERT INTO public.student_profiles (
          id, user_id, college, course, academic_year, target_move_in, budget_min, budget_max, preferred_areas, lifestyle, bio, is_demo
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true
        ) ON CONFLICT (user_id) DO UPDATE SET
          budget_min = EXCLUDED.budget_min,
          budget_max = EXCLUDED.budget_max,
          lifestyle = EXCLUDED.lifestyle;
      `, [
        toUUID(rm.id + '-profile'),
        studentUUID,
        rm.college || 'Allahabad University',
        rm.course || 'B.A.',
        rm.academic_year || '2nd Year',
        rm.target_move_in || 'Immediately',
        Number(rm.budget_min) || 3500,
        Number(rm.budget_max) || 6500,
        rm.preferred_areas || ['Katra', 'Civil Lines'],
        JSON.stringify(rm.lifestyle || {}),
        rm.bio || '',
      ]);
      roommateCount++;
    }
    console.log(`Seeded ${roommateCount} student roommate profiles.`);

    // 5. VERIFY VIA RPC
    const rpcRes = await client.query(`
      SELECT count(*) FROM public.get_properties_proximity_ranked(25.4563, 81.8546);
    `);
    console.log(`Proximity function returned ${rpcRes.rows[0].count} properties for Katra (25.4563, 81.8546).`);

    await client.end();
    console.log('Seed completed successfully!');
  } catch (err) {
    console.error('Seed error:', err.message);
    try { await client.end(); } catch (e) {}
    process.exit(1);
  }
}

runSeed();
