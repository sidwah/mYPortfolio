const mongoose = require('mongoose');
const User = require('../models/User');
require('dotenv').config();

const createAdminUser = async () => {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    
    // Check if admin already exists
    const existingAdmin = await User.findOne({ role: 'admin' });
    if (existingAdmin) {
      console.log('✅ Admin user already exists');
      console.log(`📧 Email: ${existingAdmin.email}`);
      console.log(`👤 Username: ${existingAdmin.username}`);
      return;
    }
    
    // Create admin user - CHANGE THESE VALUES!
    const adminData = {
      username: 'barrockadmin',
      email: 'barrock@example.com', // Change this to your real email
      password: 'AdminPassword123!', // Change this to a secure password
      firstName: 'Barrock',
      lastName: 'Sidwah',
      role: 'admin',
      emailVerified: true,
      isActive: true
    };
    
    const admin = await User.create(adminData);
    
    console.log('🎉 Admin user created successfully!');
    console.log('📧 Email:', admin.email);
    console.log('👤 Username:', admin.username);
    console.log('🔐 Password:', adminData.password);
    console.log('\n⚠️  IMPORTANT: Change the password after first login!');
    console.log('🔗 You can now login at: http://localhost:5000/api/auth/login');
    
  } catch (error) {
    console.error('❌ Error creating admin user:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('🔐 Database connection closed');
  }
};

// Run if called directly
if (require.main === module) {
  createAdminUser();
}

module.exports = createAdminUser;