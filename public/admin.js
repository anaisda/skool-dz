// Admin panel JavaScript
let adminToken = localStorage.getItem('adminToken');
let courses = [];
let registrations = [];

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    if (adminToken) {
        verifyTokenAndShowPanel();
    }
    
    setupLoginForm();
    setupCourseForm();
});

// Verify token is still valid
async function verifyTokenAndShowPanel() {
    try {
        const response = await fetch('/api/admin/registrations?courseId=0', {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        
        if (response.ok) {
            showAdminPanel();
        } else {
            // Token is invalid, clear it
            localStorage.removeItem('adminToken');
            adminToken = null;
        }
    } catch (error) {
        console.error('Token verification error:', error);
        localStorage.removeItem('adminToken');
        adminToken = null;
    }
}

// Setup login form
function setupLoginForm() {
    const loginForm = document.getElementById('login-form');
    if (!loginForm) return;
    
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value;
        const submitBtn = e.target.querySelector('button[type="submit"]');
        
        if (!username || !password) {
            alert('Veuillez remplir tous les champs');
            return;
        }
        
        // Disable button during request
        submitBtn.disabled = true;
        submitBtn.textContent = 'Connexion...';
        
        try {
            const response = await fetch('/api/admin/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                adminToken = data.token;
                localStorage.setItem('adminToken', adminToken);
                showAdminPanel();
            } else {
                alert(data.error || 'Identifiants incorrects');
            }
        } catch (error) {
            console.error('Login error:', error);
            alert('Erreur de connexion au serveur');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Se connecter';
        }
    });
}

// Show admin panel
function showAdminPanel() {
    document.getElementById('login-page').style.display = 'none';
    document.getElementById('dashboard').classList.add('active');
    loadCourses();
    loadRegistrations();
}

// Logout
function logout() {
    if (confirm('Êtes-vous sûr de vouloir vous déconnecter ?')) {
        localStorage.removeItem('adminToken');
        adminToken = null;
        document.getElementById('login-page').style.display = 'flex';
        document.getElementById('dashboard').classList.remove('active');
        
        // Reset forms
        document.getElementById('login-form').reset();
        document.getElementById('course-form').reset();
    }
}

// Switch tabs
function switchTab(tab) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    const clickedBtn = event.target;
    clickedBtn.classList.add('active');
    
    const tabContent = document.getElementById(`${tab}-tab`);
    if (tabContent) {
        tabContent.classList.add('active');
    }
    
    // Reload data when switching to registrations
    if (tab === 'registrations') {
        loadRegistrations();
    }
}

// Setup course form
function setupCourseForm() {
    const courseForm = document.getElementById('course-form');
    if (!courseForm) return;
    
    courseForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const courseId = document.getElementById('course-id').value;
        const submitBtn = e.target.querySelector('button[type="submit"]');
        
        // Validate required fields
        const nameEn = document.getElementById('course-name-en').value.trim();
        const nameFr = document.getElementById('course-name-fr').value.trim();
        const nameAr = document.getElementById('course-name-ar').value.trim();
        const branch = document.getElementById('course-branch').value;
        const price = document.getElementById('course-price').value;
        
        if (!nameEn || !nameFr || !nameAr || !branch || !price) {
            alert('Veuillez remplir tous les champs obligatoires');
            return;
        }
        
        const formData = new FormData();
        formData.append('name_en', nameEn);
        formData.append('name_fr', nameFr);
        formData.append('name_ar', nameAr);
        formData.append('branch', branch);
        formData.append('price', price);
        formData.append('description_en', document.getElementById('course-desc-en').value.trim());
        formData.append('description_fr', document.getElementById('course-desc-fr').value.trim());
        formData.append('description_ar', document.getElementById('course-desc-ar').value.trim());
        
        const imageFile = document.getElementById('course-image').files[0];
        if (imageFile) {
            formData.append('image', imageFile);
        }
        
        // Disable button during request
        submitBtn.disabled = true;
        submitBtn.textContent = courseId ? 'Mise à jour...' : 'Enregistrement...';
        
        try {
            const url = courseId ? `/api/admin/courses/${courseId}` : '/api/admin/courses';
            const method = courseId ? 'PUT' : 'POST';
            
            const response = await fetch(url, {
                method,
                headers: { 'Authorization': `Bearer ${adminToken}` },
                body: formData
            });
            
            const data = await response.json();
            
            if (response.ok) {
                alert(courseId ? 'Cours mis à jour avec succès' : 'Cours créé avec succès');
                courseForm.reset();
                document.getElementById('course-id').value = '';
                loadCourses();
            } else {
                if (response.status === 401 || response.status === 403) {
                    alert('Session expirée. Veuillez vous reconnecter.');
                    logout();
                } else {
                    alert(data.error || 'Erreur lors de l\'enregistrement');
                }
            }
        } catch (error) {
            console.error('Save course error:', error);
            alert('Erreur de connexion au serveur');
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Enregistrer le Cours';
        }
    });
}

// Load courses
async function loadCourses() {
    try {
        const response = await fetch('/api/courses');
        
        if (response.ok) {
            courses = await response.json();
            renderCourses();
            updateCourseFilter();
        } else {
            console.error('Failed to load courses');
        }
    } catch (error) {
        console.error('Load courses error:', error);
    }
}

// Render courses table
function renderCourses() {
    const tbody = document.querySelector('#courses-table tbody');
    if (!tbody) return;
    
    if (courses.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; padding: 2rem; color: #999;">Aucun cours disponible</td></tr>';
        return;
    }
    
    tbody.innerHTML = courses.map(course => {
        const branchNames = {
            'sciences': 'Sciences Exp.',
            'math': 'Mathématiques',
            'technique': 'Tech. Math',
            'gestion': 'Gestion',
            'lettres': 'Lettres',
            'all': 'Toutes'
        };
        
        return `
            <tr>
                <td>${course.name_fr}</td>
                <td>${branchNames[course.branch] || course.branch}</td>
                <td>${course.price.toLocaleString()} DZD</td>
                <td>
                    <button class="btn-action btn-edit" onclick="editCourse(${course.id})">Éditer</button>
                    <button class="btn-action btn-delete" onclick="deleteCourse(${course.id})">Supprimer</button>
                </td>
            </tr>
        `;
    }).join('');
}

// Edit course
function editCourse(id) {
    const course = courses.find(c => c.id === id);
    if (!course) return;
    
    document.getElementById('course-id').value = course.id;
    document.getElementById('course-name-en').value = course.name_en;
    document.getElementById('course-name-fr').value = course.name_fr;
    document.getElementById('course-name-ar').value = course.name_ar;
    document.getElementById('course-branch').value = course.branch;
    document.getElementById('course-price').value = course.price;
    document.getElementById('course-desc-en').value = course.description_en || '';
    document.getElementById('course-desc-fr').value = course.description_fr || '';
    document.getElementById('course-desc-ar').value = course.description_ar || '';
    
    // Scroll to form
    document.getElementById('course-form').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Delete course
async function deleteCourse(id) {
    const course = courses.find(c => c.id === id);
    if (!course) return;
    
    if (!confirm(`Êtes-vous sûr de vouloir supprimer le cours "${course.name_fr}" ?`)) return;
    
    try {
        const response = await fetch(`/api/admin/courses/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            alert('Cours supprimé avec succès');
            loadCourses();
        } else {
            if (response.status === 401 || response.status === 403) {
                alert('Session expirée. Veuillez vous reconnecter.');
                logout();
            } else {
                alert(data.error || 'Erreur lors de la suppression');
            }
        }
    } catch (error) {
        console.error('Delete course error:', error);
        alert('Erreur de connexion au serveur');
    }
}

// Load registrations
async function loadRegistrations() {
    try {
        const courseId = document.getElementById('registration-filter')?.value || '';
        const url = courseId ? `/api/admin/registrations?courseId=${courseId}` : '/api/admin/registrations';
        
        const response = await fetch(url, {
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        
        if (response.ok) {
            registrations = await response.json();
            renderRegistrations();
        } else {
            if (response.status === 401 || response.status === 403) {
                alert('Session expirée. Veuillez vous reconnecter.');
                logout();
            } else {
                console.error('Failed to load registrations');
            }
        }
    } catch (error) {
        console.error('Load registrations error:', error);
    }
}

// Render registrations table
function renderRegistrations() {
    const tbody = document.querySelector('#registrations-table tbody');
    if (!tbody) return;
    
    if (registrations.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 2rem; color: #999;">Aucune inscription pour le moment</td></tr>';
        return;
    }
    
    tbody.innerHTML = registrations.map(reg => {
        const course = courses.find(c => c.id === reg.course_id);
        const courseName = course ? course.name_fr : 'N/A';
        
        const statusBadge = {
            'pending': '<span class="badge badge-pending">En attente</span>',
            'approved': '<span class="badge badge-approved">Approuvé</span>',
            'rejected': '<span class="badge badge-rejected">Rejeté</span>'
        }[reg.status] || reg.status;
        
        const dateStr = new Date(reg.created_at).toLocaleDateString('fr-FR', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
        
        return `
            <tr>
                <td>${reg.full_name}</td>
                <td>${reg.contact}</td>
                <td>${courseName}</td>
                <td><a href="${reg.receipt_path}" target="_blank" style="color: var(--primary-600); text-decoration: underline;">Voir</a></td>
                <td>${statusBadge}</td>
                <td>${dateStr}</td>
                <td>
                    ${reg.status === 'pending' ? `
                        <button class="btn-action btn-edit" onclick="updateRegistrationStatus(${reg.id}, 'approved')">Approuver</button>
                        <button class="btn-action btn-delete" onclick="updateRegistrationStatus(${reg.id}, 'rejected')">Rejeter</button>
                    ` : '-'}
                </td>
            </tr>
        `;
    }).join('');
}

// Update registration status
async function updateRegistrationStatus(id, status) {
    const statusText = status === 'approved' ? 'approuver' : 'rejeter';
    
    if (!confirm(`Êtes-vous sûr de vouloir ${statusText} cette inscription ?`)) return;
    
    try {
        const response = await fetch(`/api/admin/registrations/${id}`, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${adminToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ status })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            alert('Statut mis à jour avec succès');
            loadRegistrations();
        } else {
            if (response.status === 401 || response.status === 403) {
                alert('Session expirée. Veuillez vous reconnecter.');
                logout();
            } else {
                alert(data.error || 'Erreur lors de la mise à jour');
            }
        }
    } catch (error) {
        console.error('Update status error:', error);
        alert('Erreur de connexion au serveur');
    }
}

// Update course filter in registrations tab
function updateCourseFilter() {
    const filter = document.getElementById('registration-filter');
    if (!filter) return;
    
    const currentValue = filter.value;
    filter.innerHTML = '<option value="">Tous les cours</option>' + 
        courses.map(course => `<option value="${course.id}">${course.name_fr}</option>`).join('');
    
    // Restore selected value if it still exists
    if (currentValue && courses.find(c => c.id == currentValue)) {
        filter.value = currentValue;
    }
}