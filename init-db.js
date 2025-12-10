const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
require('dotenv').config();

console.log('🔧 Initializing Skool DZ Database...\n');

const db = new Database('./database.db');

// Create tables
console.log('📋 Creating tables...');
db.exec(`
    CREATE TABLE IF NOT EXISTS admins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS courses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name_en TEXT NOT NULL,
        name_fr TEXT NOT NULL,
        name_ar TEXT NOT NULL,
        branch TEXT NOT NULL,
        price REAL NOT NULL,
        description_en TEXT,
        description_fr TEXT,
        description_ar TEXT,
        image_path TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS registrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        course_id INTEGER NOT NULL,
        full_name TEXT NOT NULL,
        contact TEXT NOT NULL,
        receipt_path TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (course_id) REFERENCES courses(id)
    );
`);
console.log('✓ Tables created successfully');

// Create admin user
const adminUsername = process.env.ADMIN_USERNAME || 'admin';
const adminPassword = process.env.ADMIN_PASSWORD || 'Skool@DZ2024';

const checkAdmin = db.prepare("SELECT * FROM admins WHERE username = ?");
const adminExists = checkAdmin.get(adminUsername);

if (!adminExists) {
    console.log('\n👤 Creating admin user...');
    const hash = bcrypt.hashSync(adminPassword, 10);
    const insertAdmin = db.prepare("INSERT INTO admins (username, password) VALUES (?, ?)");
    insertAdmin.run(adminUsername, hash);
    console.log('✓ Admin user created');
    console.log(`   Username: ${adminUsername}`);
    console.log(`   Password: ${adminPassword}`);
} else {
    console.log('\n👤 Admin user already exists');
    console.log(`   Username: ${adminUsername}`);
}

// Add sample courses (optional)
const courseCount = db.prepare("SELECT COUNT(*) as count FROM courses").get();
if (courseCount.count === 0) {
    console.log('\n📚 Adding sample courses...');
    
    const sampleCourses = [
        {
            name_en: 'Mathematics',
            name_fr: 'Mathématiques',
            name_ar: 'الرياضيات',
            branch: 'math',
            price: 5000,
            description_en: 'Complete mathematics course for high school students',
            description_fr: 'Cours complet de mathématiques pour lycéens',
            description_ar: 'دورة رياضيات كاملة لطلاب الثانوية'
        },
        {
            name_en: 'Physics',
            name_fr: 'Physique',
            name_ar: 'الفيزياء',
            branch: 'sciences',
            price: 5000,
            description_en: 'Comprehensive physics course with experiments',
            description_fr: 'Cours de physique complet avec expériences',
            description_ar: 'دورة فيزياء شاملة مع التجارب'
        },
        {
            name_en: 'Philosophy',
            name_fr: 'Philosophie',
            name_ar: 'الفلسفة',
            branch: 'lettres',
            price: 4000,
            description_en: 'Critical thinking and philosophical concepts',
            description_fr: 'Pensée critique et concepts philosophiques',
            description_ar: 'التفكير النقدي والمفاهيم الفلسفية'
        }
    ];
    
    const insertCourse = db.prepare(`
        INSERT INTO courses (
            name_en, name_fr, name_ar, branch, price,
            description_en, description_fr, description_ar
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    
    sampleCourses.forEach(course => {
        insertCourse.run(
            course.name_en, course.name_fr, course.name_ar,
            course.branch, course.price,
            course.description_en, course.description_fr, course.description_ar
        );
    });
    
    console.log(`✓ Added ${sampleCourses.length} sample courses`);
}

db.close();

console.log('\n✅ Database initialization complete!');
console.log('\n📝 Next steps:');
console.log('   1. Run: npm install');
console.log('   2. Run: npm start');
console.log('   3. Visit: http://localhost:3000');
console.log('   4. Admin: http://localhost:3000/skool-admin-access\n');