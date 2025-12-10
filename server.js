const express = require('express');
const { Sequelize, DataTypes } = require('sequelize');
const multer = require('multer');
const path = require('path');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'skool-dz-secret-key-2024-change-in-production';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Create necessary directories
if (!fs.existsSync('./uploads')) {
    fs.mkdirSync('./uploads', { recursive: true });
}
if (!fs.existsSync('./public')) {
    fs.mkdirSync('./public', { recursive: true });
}

// Static file serving
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// ============================================
// DATABASE CONNECTION (PostgreSQL)
// ============================================
const sequelize = new Sequelize(process.env.DATABASE_URL || 'postgresql://localhost/skool_dz', {
    dialect: 'postgres',
    dialectOptions: {
        ssl: process.env.NODE_ENV === 'production' ? {
            require: true,
            rejectUnauthorized: false
        } : false
    },
    logging: false,
    pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
    }
});

// Test connection
sequelize.authenticate()
    .then(() => console.log('✅ PostgreSQL connected successfully'))
    .catch(err => console.error('❌ Database connection error:', err));

// ============================================
// DEFINE MODELS
// ============================================

// Admin Model
const Admin = sequelize.define('Admin', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    username: {
        type: DataTypes.STRING,
        unique: true,
        allowNull: false
    },
    password: {
        type: DataTypes.STRING,
        allowNull: false
    }
}, {
    tableName: 'admins',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false
});

// Course Model
const Course = sequelize.define('Course', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    name_en: {
        type: DataTypes.STRING,
        allowNull: false
    },
    name_fr: {
        type: DataTypes.STRING,
        allowNull: false
    },
    name_ar: {
        type: DataTypes.STRING,
        allowNull: false
    },
    branch: {
        type: DataTypes.STRING,
        allowNull: false
    },
    price: {
        type: DataTypes.FLOAT,
        allowNull: false
    },
    description_en: DataTypes.TEXT,
    description_fr: DataTypes.TEXT,
    description_ar: DataTypes.TEXT,
    image_path: DataTypes.STRING
}, {
    tableName: 'courses',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false
});

// Registration Model
const Registration = sequelize.define('Registration', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    course_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'courses',
            key: 'id'
        }
    },
    full_name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    contact: {
        type: DataTypes.STRING,
        allowNull: false
    },
    receipt_path: {
        type: DataTypes.STRING,
        allowNull: false
    },
    status: {
        type: DataTypes.STRING,
        defaultValue: 'pending'
    }
}, {
    tableName: 'registrations',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false
});

// Define relationships
Registration.belongsTo(Course, { foreignKey: 'course_id', as: 'course' });

// ============================================
// SYNC DATABASE & CREATE DEFAULT ADMIN
// ============================================
sequelize.sync({ alter: true })
    .then(async () => {
        console.log('✅ Database synced');
        
        // Create default admin if doesn't exist
        const adminUsername = process.env.ADMIN_USERNAME || 'admin';
        const adminExists = await Admin.findOne({ where: { username: adminUsername } });
        
        if (!adminExists) {
            const defaultPassword = process.env.ADMIN_PASSWORD || 'Skool@DZ2024';
            const hashedPassword = bcrypt.hashSync(defaultPassword, 10);
            await Admin.create({
                username: adminUsername,
                password: hashedPassword
            });
            console.log('✅ Default admin created');
            console.log('  Username:', adminUsername);
            console.log('  Password:', defaultPassword);
        }
    })
    .catch(err => console.error('❌ Sync error:', err));

// ============================================
// MULTER CONFIGURATION
// ============================================
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({ 
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|pdf/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only images (JPEG, PNG, GIF) and PDF files are allowed!'));
        }
    }
});

// ============================================
// AUTHENTICATION MIDDLEWARE
// ============================================
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ error: 'Access token required' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ error: 'Invalid or expired token' });
        }
        req.user = user;
        next();
    });
};

// ============================================
// ROUTES
// ============================================

// Health check
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'Skool DZ Platform is running' });
});

// Admin login
app.post('/api/admin/login', async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password required' });
        }

        const admin = await Admin.findOne({ where: { username } });

        if (!admin) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const validPassword = bcrypt.compareSync(password, admin.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        const token = jwt.sign(
            { id: admin.id, username: admin.username },
            JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({ token, username: admin.username });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Get all courses (public)
app.get('/api/courses', async (req, res) => {
    try {
        const courses = await Course.findAll({
            order: [['created_at', 'DESC']]
        });
        res.json(courses);
    } catch (error) {
        console.error('Error fetching courses:', error);
        res.status(500).json({ error: 'Failed to fetch courses' });
    }
});

// Add course (admin only)
app.post('/api/admin/courses', authenticateToken, upload.single('image'), async (req, res) => {
    try {
        const { name_en, name_fr, name_ar, branch, price, description_en, description_fr, description_ar } = req.body;
        const image_path = req.file ? `/uploads/${req.file.filename}` : null;

        if (!name_en || !name_fr || !name_ar || !branch || !price) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const course = await Course.create({
            name_en,
            name_fr,
            name_ar,
            branch,
            price: parseFloat(price),
            description_en: description_en || '',
            description_fr: description_fr || '',
            description_ar: description_ar || '',
            image_path
        });

        res.status(201).json({ message: 'Course created successfully', course });
    } catch (error) {
        console.error('Error creating course:', error);
        res.status(500).json({ error: 'Failed to create course' });
    }
});

// Update course (admin only)
app.put('/api/admin/courses/:id', authenticateToken, upload.single('image'), async (req, res) => {
    try {
        const { id } = req.params;
        const { name_en, name_fr, name_ar, branch, price, description_en, description_fr, description_ar } = req.body;
        
        const course = await Course.findByPk(id);
        if (!course) {
            return res.status(404).json({ error: 'Course not found' });
        }

        const updateData = {
            name_en,
            name_fr,
            name_ar,
            branch,
            price: parseFloat(price),
            description_en: description_en || '',
            description_fr: description_fr || '',
            description_ar: description_ar || ''
        };

        if (req.file) {
            // Delete old image if exists
            if (course.image_path) {
                const oldImagePath = path.join(__dirname, course.image_path);
                if (fs.existsSync(oldImagePath)) {
                    fs.unlinkSync(oldImagePath);
                }
            }
            updateData.image_path = `/uploads/${req.file.filename}`;
        }

        await course.update(updateData);

        res.json({ message: 'Course updated successfully', course });
    } catch (error) {
        console.error('Error updating course:', error);
        res.status(500).json({ error: 'Failed to update course' });
    }
});

// Delete course (admin only)
app.delete('/api/admin/courses/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        
        const course = await Course.findByPk(id);
        if (!course) {
            return res.status(404).json({ error: 'Course not found' });
        }

        // Delete image file if exists
        if (course.image_path) {
            const imagePath = path.join(__dirname, course.image_path);
            if (fs.existsSync(imagePath)) {
                fs.unlinkSync(imagePath);
            }
        }

        await course.destroy();

        res.json({ message: 'Course deleted successfully' });
    } catch (error) {
        console.error('Error deleting course:', error);
        res.status(500).json({ error: 'Failed to delete course' });
    }
});

// Register for course (public)
app.post('/api/registrations', upload.single('receipt'), async (req, res) => {
    try {
        const { course_id, full_name, contact } = req.body;
        const receipt_path = req.file ? `/uploads/${req.file.filename}` : null;

        if (!course_id || !full_name || !contact || !receipt_path) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        // Check if course exists
        const course = await Course.findByPk(course_id);
        if (!course) {
            return res.status(404).json({ error: 'Course not found' });
        }

        const registration = await Registration.create({
            course_id: parseInt(course_id),
            full_name,
            contact,
            receipt_path,
            status: 'pending'
        });

        res.status(201).json({ 
            message: 'Registration submitted successfully', 
            registration 
        });
    } catch (error) {
        console.error('Error creating registration:', error);
        res.status(500).json({ error: 'Failed to submit registration' });
    }
});

// Get all registrations (admin only)
app.get('/api/admin/registrations', authenticateToken, async (req, res) => {
    try {
        const registrations = await Registration.findAll({
            include: [{
                model: Course,
                as: 'course',
                attributes: ['name_en', 'name_fr', 'name_ar', 'branch', 'price']
            }],
            order: [['created_at', 'DESC']]
        });
        res.json(registrations);
    } catch (error) {
        console.error('Error fetching registrations:', error);
        res.status(500).json({ error: 'Failed to fetch registrations' });
    }
});

// Update registration status (admin only)
app.patch('/api/admin/registrations/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!['pending', 'approved', 'rejected'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        const registration = await Registration.findByPk(id);
        if (!registration) {
            return res.status(404).json({ error: 'Registration not found' });
        }

        await registration.update({ status });

        res.json({ message: 'Registration status updated', registration });
    } catch (error) {
        console.error('Error updating registration:', error);
        res.status(500).json({ error: 'Failed to update registration' });
    }
});

// Delete registration (admin only)
app.delete('/api/admin/registrations/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        
        const registration = await Registration.findByPk(id);
        if (!registration) {
            return res.status(404).json({ error: 'Registration not found' });
        }

        // Delete receipt file if exists
        if (registration.receipt_path) {
            const receiptPath = path.join(__dirname, registration.receipt_path);
            if (fs.existsSync(receiptPath)) {
                fs.unlinkSync(receiptPath);
            }
        }

        await registration.destroy();

        res.json({ message: 'Registration deleted successfully' });
    } catch (error) {
        console.error('Error deleting registration:', error);
        res.status(500).json({ error: 'Failed to delete registration' });
    }
});

// Admin panel route
app.get('/skool-admin-access', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin-login.html'));
});

// ============================================
// ERROR HANDLING
// ============================================
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

// ============================================
// START SERVER
// ============================================
app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════╗
║     🎓 Skool DZ Platform Started     ║
╠═══════════════════════════════════════╣
║  Port: ${PORT}                        
║  Environment: ${process.env.NODE_ENV || 'development'}
║  Database: PostgreSQL                 
╚═══════════════════════════════════════╝
    `);
});