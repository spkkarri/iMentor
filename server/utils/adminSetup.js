// server/utils/adminSetup.js
// Interactive admin setup utility

const readline = require('readline');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const UserApiKeys = require('../models/UserApiKeys');

class AdminSetup {
    constructor() {
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
    }

    // Helper to ask questions
    question(prompt) {
        return new Promise((resolve) => {
            this.rl.question(prompt, resolve);
        });
    }

    // Helper for password input (hidden)
    async questionPassword(prompt) {
        return new Promise((resolve) => {
            process.stdout.write(prompt);
            process.stdin.setEncoding('utf8');
            process.stdin.setRawMode(true);
            
            let password = '';
            const onData = (char) => {
                char = char + '';
                switch (char) {
                    case '\n':
                    case '\r':
                    case '\u0004':
                        process.stdin.setRawMode(false);
                        process.stdin.removeListener('data', onData);
                        process.stdout.write('\n');
                        resolve(password);
                        break;
                    case '\u0003':
                        process.stdout.write('\n');
                        process.exit(1);
                        break;
                    case '\u007f': // backspace
                        if (password.length > 0) {
                            password = password.slice(0, -1);
                            process.stdout.write('\b \b');
                        }
                        break;
                    default:
                        password += char;
                        process.stdout.write('*');
                        break;
                }
            };
            
            process.stdin.on('data', onData);
        });
    }

    async checkAndSetupAdmin() {
        try {
            console.log('\n' + '='.repeat(60));
            console.log('🔐 ADMIN SETUP REQUIRED');
            console.log('='.repeat(60));

            // Check if any admin exists
            const existingAdmin = await User.findOne({ isAdmin: true });
            
            if (existingAdmin) {
                console.log(`✅ Admin user already exists: ${existingAdmin.username}`);
                console.log('   Skipping admin setup...\n');
                this.rl.close();
                return existingAdmin;
            }

            console.log('⚠️  No admin user found. Setting up initial admin...\n');
            
            // Get admin credentials from user input
            console.log('💡 Default credentials available:');
            console.log('   Email: admin@gmail.com');
            console.log('   Password: admin123');
            console.log('   (Press Enter to use defaults or provide custom values)\n');

            const email = await this.question('Admin Email [admin@gmail.com]: ') || 'admin@gmail.com';
            const password = await this.questionPassword('Admin Password [admin123]: ') || 'admin123';

            // Validate email format
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                throw new Error('Invalid email format');
            }

            // Validate password
            if (password.length < 6) {
                throw new Error('Password must be at least 6 characters long');
            }

            console.log('\n🔄 Creating admin user...');

            // Check if user with this email already exists
            const existingUser = await User.findOne({
                $or: [
                    { email: email },
                    { username: email }
                ]
            });

            let adminUser;

            if (existingUser) {
                // Promote existing user to admin
                console.log(`👤 User ${email} already exists. Promoting to admin...`);
                
                existingUser.isAdmin = true;
                existingUser.adminApprovalStatus = 'approved';
                existingUser.adminApprovedAt = new Date();
                existingUser.password = password; // This will be hashed by the pre-save hook
                
                await existingUser.save();
                adminUser = existingUser;
                
                console.log('✅ Existing user promoted to admin');
            } else {
                // Create new admin user
                adminUser = new User({
                    username: email,
                    email: email,
                    password: password, // Will be hashed by pre-save hook
                    isAdmin: true,
                    adminApprovalStatus: 'approved',
                    adminApprovedAt: new Date()
                });

                await adminUser.save();
                console.log('✅ New admin user created');
            }

            // Setup admin API keys configuration
            let adminApiKeys = await UserApiKeys.findOne({ userId: adminUser._id });
            
            if (!adminApiKeys) {
                adminApiKeys = new UserApiKeys({
                    userId: adminUser._id,
                    email: adminUser.email,
                    useAdminKeys: false, // Admin manages their own keys
                    preferredService: 'gemini',
                    adminAccessStatus: 'approved',
                    adminAccessApprovedAt: new Date(),
                    adminAccessApprovedBy: adminUser._id
                });
                await adminApiKeys.save();
                console.log('✅ Admin API keys configuration created');
            }

            console.log('\n' + '='.repeat(60));
            console.log('🎉 ADMIN SETUP COMPLETED SUCCESSFULLY!');
            console.log('='.repeat(60));
            console.log(`👤 Admin User: ${adminUser.email}`);
            console.log(`🔑 Admin ID: ${adminUser._id}`);
            console.log(`📅 Created: ${adminUser.createdAt.toISOString()}`);
            console.log('\n💡 Admin can now:');
            console.log('   • Access admin dashboard at /admin');
            console.log('   • Approve user admin requests');
            console.log('   • Manage system settings');
            console.log('   • Monitor user activities');
            console.log('='.repeat(60) + '\n');

            this.rl.close();
            return adminUser;

        } catch (error) {
            console.error('\n❌ Admin setup failed:', error.message);
            console.log('Please try again or check your database connection.\n');
            this.rl.close();
            throw error;
        }
    }

    // Method to promote existing user to admin (for manual use)
    async promoteUserToAdmin(userIdentifier) {
        try {
            const user = await User.findOne({
                $or: [
                    { email: userIdentifier },
                    { username: userIdentifier },
                    { _id: userIdentifier }
                ]
            });

            if (!user) {
                throw new Error(`User not found: ${userIdentifier}`);
            }

            if (user.isAdmin) {
                console.log(`User ${user.email} is already an admin`);
                return user;
            }

            user.isAdmin = true;
            user.adminApprovalStatus = 'approved';
            user.adminApprovedAt = new Date();
            
            await user.save();

            console.log(`✅ User ${user.email} promoted to admin successfully`);
            return user;

        } catch (error) {
            console.error('❌ Failed to promote user to admin:', error.message);
            throw error;
        }
    }
}

module.exports = AdminSetup;
