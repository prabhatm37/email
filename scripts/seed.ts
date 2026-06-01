import { loadEnvConfig } from '@next/env';

loadEnvConfig(process.cwd());

async function seed() {
  try {
    const bcrypt = (await import('bcryptjs')).default;
    const connectDB = (await import('../src/lib/db/mongodb')).default;
    const User = (await import('../src/lib/models/User')).default;

    console.log('Connecting to database...');
    await connectDB();
    console.log('Connected.');

    const email = (process.env.SEED_SPM_EMAIL || 'info@m37labs.com').toLowerCase().trim();
    const password = process.env.SEED_SPM_PASSWORD || '1310@m37labs!';
    const fullName = process.env.SEED_SPM_NAME || 'System Administrator';

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      console.log(`User with email ${email} already exists.`);
      console.log('Seed skipped.');
      process.exit(0);
    }

    console.log('Hashing password...');
    const passwordHash = await bcrypt.hash(password, 12);

    console.log('Creating Senior Product Manager account...');
    await User.create({
      full_name: fullName,
      email,
      role: 'SENIOR_PRODUCT_MANAGER',
      status: 'ACTIVE',
      login_method: 'BOTH',
      password_hash: passwordHash,
      last_login_at: null,
      created_by: null,
    });

    console.log('SPM account created successfully.');
    console.log('------------------------------------');
    console.log(`Email:    ${email}`);
    console.log(`Password: ${password}`);
    console.log('Role:     SENIOR_PRODUCT_MANAGER');
    console.log('------------------------------------');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
}

seed();
