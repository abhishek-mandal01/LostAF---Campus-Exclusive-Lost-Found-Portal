// =================== API CONFIG ===================
const API_BASE = '/api';

// =================== DATA STORE ===================
let ITEMS_DATA = [];

// =================== AUTH STATE ===================
// Firebase logic lives in auth.js (ES module).
// auth.js writes to window.currentUser and window.firebaseIdToken,
// which are read throughout this file.
var currentUser    = null;
var firebaseIdToken = null;

// Syncs the signed-in Firebase user to PostgreSQL via the backend.
// Called by auth.js after every successful login.
function syncUserToDB(user, token) {
    fetch(API_BASE + '/users/sync', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + token
        },
        body: JSON.stringify({
            name:            user.displayName || '',
            email:           user.email,
            profile_picture: user.photoURL || ''
        })
    }).catch(function(err) {
        console.error('[Auth] Failed to sync user:', err);
    });
}

// Updates the navbar to show either the Login button or the user's
// avatar + name + sign-out link.
function updateAuthUI(isLoggedIn, user) {
    var loginBtn = document.getElementById('navLoginBtn');
    var userArea = document.getElementById('navUserArea');
    var avatar   = document.getElementById('navUserAvatar');
    var name     = document.getElementById('navUserName');

    if (isLoggedIn && user) {
        loginBtn.style.display = 'none';
        userArea.style.display = 'flex';
        if (user.photoURL) {
            avatar.style.backgroundImage = 'url(' + user.photoURL + ')';
            avatar.textContent = '';
        } else {
            avatar.style.backgroundImage = '';
            avatar.textContent = (user.displayName || 'U')[0].toUpperCase();
        }
        name.textContent = (user.displayName || '').split(' ')[0];
    } else {
        loginBtn.style.display = 'flex';
        userArea.style.display = 'none';
    }
}

function openAuthModal() {
    document.getElementById('authModal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeAuthModal() {
    var modal = document.getElementById('authModal');
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}


// =================== API FUNCTIONS ===================
function fetchItems() {
    var params = new URLSearchParams();
    if (activeType !== 'all') params.set('type', activeType);
    if (activeCategory !== 'All') params.set('category', activeCategory);
    if (activeZone !== 'All') params.set('location', activeZone);
    if (searchQuery) params.set('search', searchQuery);

    return fetch(API_BASE + '/items?' + params.toString())
        .then(function(res) { return res.json(); })
        .then(function(items) {
            ITEMS_DATA = items.map(function(item) {
                return {
                    id: item.id,
                    type: item.type,
                    title: item.title,
                    description: item.description || '',
                    category: item.category,
                    location: item.location,
                    date: item.item_date,
                    user: item.user_name,
                    email: item.user_email || '',
                    avatar: item.avatar_emoji || '🧑‍🎓',
                    image: item.image_url || 'https://images.unsplash.com/photo-1586769852044-692d6e3703f0?w=400&q=80'
                };
            });
            return ITEMS_DATA;
        })
        .catch(function(err) {
            console.error('Failed to fetch items:', err);
            return ITEMS_DATA;
        });
}


// =================== STATE ===================
let currentStep = 1;
let selectedType = '';
let selectedLocation = '';
let activeZone = 'All';
let activeCategory = 'All';
let activeType = 'all';
let searchQuery = '';
let reuniteTargetId = null;


// =================== NAVIGATION ===================
function navigate(page, typePreset) {
    // Guard: report page requires authentication
    if (page === 'report' && !currentUser) {
        openAuthModal();
        return;
    }

    // Hide all pages
    document.getElementById('page-landing').classList.remove('active');
    document.getElementById('page-feed').classList.remove('active');
    document.getElementById('page-report').classList.remove('active');
    document.getElementById('page-about').classList.remove('active');

    // Show target page
    document.getElementById('page-' + page).classList.add('active');

    // Update nav links
    document.querySelectorAll('.nav-links a').forEach(function(a) {
        a.classList.remove('active');
        if (a.dataset.page === page) a.classList.add('active');
    });

    // Clear search when leaving feed
    if (page !== 'feed') {
        document.getElementById('smartSearch').value = '';
    }

    if (page === 'feed') {
        renderFeed();
    }

    if (page === 'report' && typePreset) {
        selectType(typePreset, document.getElementById(typePreset === 'lost' ? 'typeLost' : 'typeFound'));
    }

    // Pre-fill reporter badge and form fields from logged-in user
    if (page === 'report' && currentUser) {
        var badge = document.getElementById('reporterBadge');
        if (badge) {
            var badgeName  = document.getElementById('reporterBadgeName');
            var badgeEmail = document.getElementById('reporterBadgeEmail');
            var badgeAv    = document.getElementById('reporterAvatar');
            if (badgeName)  badgeName.textContent  = currentUser.displayName || '';
            if (badgeEmail) badgeEmail.textContent = currentUser.email || '';
            if (badgeAv) {
                if (currentUser.photoURL) {
                    badgeAv.style.backgroundImage = 'url(' + currentUser.photoURL + ')';
                    badgeAv.textContent = '';
                } else {
                    badgeAv.style.backgroundImage = '';
                    badgeAv.textContent = (currentUser.displayName || 'U')[0].toUpperCase();
                }
            }
        }
        var nameField  = document.getElementById('reporterName');
        var emailField = document.getElementById('reporterEmail');
        if (nameField  && !nameField.value)  nameField.value  = currentUser.displayName || '';
        if (emailField) emailField.value = currentUser.email || '';
    }

    // Animate skill bars on about page
    if (page === 'about') {
        animateSkillBars();
    }

    // Close mobile menu
    document.getElementById('navLinks').classList.remove('mobile-open');

    window.scrollTo(0, 0);
}

// Skill bar animation for about page
function animateSkillBars() {
    var fills = document.querySelectorAll('.skill-fill');
    fills.forEach(function(fill) {
        var targetWidth = fill.style.width;
        fill.style.width = '0%';
        setTimeout(function() {
            fill.style.width = targetWidth;
        }, 100);
    });
}


// =================== MOBILE MENU ===================
function toggleMobileMenu() {
    document.getElementById('navLinks').classList.toggle('mobile-open');
}





// =================== FEED RENDERING ===================
function getTimeAgo(dateStr) {
    var date = new Date(dateStr);
    var now = new Date();
    var diff = now - date;
    var days = Math.floor(diff / 86400000);
    var hours = Math.floor(diff / 3600000);
    if (days > 7) return Math.floor(days / 7) + 'w ago';
    if (days > 0) return days + 'd ago';
    if (hours > 0) return hours + 'h ago';
    return 'just now';
}

function renderFeed() {
    var grid = document.getElementById('feedGrid');
    var noResults = document.getElementById('noResults');

    fetchItems().then(function(filtered) {
    if (filtered.length === 0) {
        grid.innerHTML = '';
        noResults.style.display = 'block';
        return;
    }
    noResults.style.display = 'none';

    var html = '';
    filtered.forEach(function(item) {
        var title = item.title;
        var desc = item.description;

        // Highlight search matches
        if (searchQuery) {
            var q = searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            var regex = new RegExp('(' + q + ')', 'gi');
            title = title.replace(regex, '<span class="highlight">$1</span>');
            desc = desc.replace(regex, '<span class="highlight">$1</span>');
        }

        html += '<div class="item-card glass" onclick="openItemDetail(' + item.id + ')" data-id="' + item.id + '" data-type="' + item.type + '" data-zone="' + item.location + '" data-category="' + item.category + '">' +
            '<img class="item-card-img" src="' + item.image + '" alt="' + item.title + '" loading="lazy" onerror="this.style.display=\'none\'">' +
            '<div class="item-card-body">' +
                '<span class="item-card-type ' + item.type + '">' +
                    (item.type === 'lost' ? '🔴 Lost' : '🟢 Found') +
                '</span>' +
                '<h3 class="item-card-title">' + title + '</h3>' +
                '<p class="item-card-desc">' + desc + '</p>' +
                '<div class="item-card-meta">' +
                    '<span>📍 ' + item.location + '</span>' +
                    '<span>🕐 ' + getTimeAgo(item.date) + '</span>' +
                    '<span>📦 ' + item.category + '</span>' +
                '</div>' +
            '</div>' +
            '<div class="item-card-footer">' +
                '<div class="item-card-user">' +
                    '<div class="item-card-avatar">' + item.avatar + '</div>' +
                    '<span class="item-card-username">' + item.user + '</span>' +
                '</div>' +
                '<button class="reunite-btn" onclick="event.stopPropagation();openReuniteModal(' + item.id + ')">✨ Reunite</button>' +
            '</div>' +
        '</div>';
    });

    grid.innerHTML = html;
    }); // end fetchItems().then
}


// =================== FILTERS ===================
function showHeartAlert() {
    alert("Are you okay bro? Sorry but we can't get your heart here.");
}

function filterByZone(zone, el) {
    activeZone = zone;
    document.querySelectorAll('.zone-btn').forEach(function(b) { b.classList.remove('active'); });
    if (el) el.classList.add('active');
    // Also update SVG map
    document.querySelectorAll('.campus-svg .building').forEach(function(b) {
        b.classList.remove('active');
        if (zone !== 'All' && b.dataset.zone === zone) b.classList.add('active');
    });
    renderFeed();
}

function filterByCategory(cat, el) {
    activeCategory = cat;
    document.querySelectorAll('.filter-chip').forEach(function(c) { c.classList.remove('active'); });
    if (el) el.classList.add('active');
    renderFeed();
}

function filterByType(type, el) {
    activeType = type;
    document.querySelectorAll('.feed-tab').forEach(function(t) { t.classList.remove('active'); });
    if (el) el.classList.add('active');
    renderFeed();
}


// =================== SVG MAP CLICK ===================
document.addEventListener('click', function(e) {
    let target = e.target;
    if (target.classList.contains('building-label')) {
        target = target.previousElementSibling;
    }
    if (target && target.classList.contains('building')) {
        var zone = target.dataset.zone;
        if (zone) {
            var btn = document.querySelector('.zone-btn[data-zone="' + zone + '"]');
            if (btn) {
                filterByZone(zone, btn);
                btn.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }
    }
});


// =================== AI SMART SEARCH ===================
function handleSmartSearch(query) {
    searchQuery = query.trim();
    renderFeed();
}


// =================== REPORT FORM ===================
function selectType(type, el) {
    selectedType = type;
    document.querySelectorAll('.type-option').forEach(function(o) { o.classList.remove('selected'); });
    el.classList.add('selected');
}

function selectLocation(loc, el) {
    selectedLocation = loc;
    document.querySelectorAll('.location-option').forEach(function(o) { o.classList.remove('selected'); });
    el.classList.add('selected');
}

function nextStep(step) {
    // Validate current step
    if (step === 2) {
        if (!selectedType) { showToast('Please select Lost or Found', 'info'); return; }
        if (!document.getElementById('itemName').value.trim()) { showToast('Please enter item name', 'info'); return; }
        if (!document.getElementById('itemCategory').value) { showToast('Please select a category', 'info'); return; }
        if (!document.getElementById('itemDate').value) { showToast('Please select a date', 'info'); return; }
    }
    if (step === 3) {
        if (!selectedLocation) { showToast('Please select a location', 'info'); return; }
    }

    currentStep = step;
    updateFormStep();
}

function prevStep(step) {
    currentStep = step;
    updateFormStep();
}

function updateFormStep() {
    // Update step dots
    document.querySelectorAll('.step-dot').forEach(function(dot) {
        var s = parseInt(dot.dataset.step);
        dot.classList.remove('active', 'completed');
        if (s === currentStep) dot.classList.add('active');
        if (s < currentStep) dot.classList.add('completed');
    });

    // Update step lines
    var lines = document.querySelectorAll('.step-line');
    lines.forEach(function(line, i) {
        line.classList.toggle('completed', i + 1 < currentStep);
    });

    // Show correct form step
    document.querySelectorAll('.form-step').forEach(function(s) { s.classList.remove('active'); });
    document.getElementById('formStep' + currentStep).classList.add('active');
}

function handleImageUpload(e) {
    var file = e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(ev) {
        document.getElementById('previewImg').src = ev.target.result;
        document.getElementById('uploadPreview').style.display = 'block';
    };
    reader.readAsDataURL(file);
}

// Drag and drop
var uploadZone = document.getElementById('uploadZone');
if (uploadZone) {
    uploadZone.addEventListener('dragover', function(e) {
        e.preventDefault();
        uploadZone.classList.add('dragover');
    });
    uploadZone.addEventListener('dragleave', function() {
        uploadZone.classList.remove('dragover');
    });
    uploadZone.addEventListener('drop', function(e) {
        e.preventDefault();
        uploadZone.classList.remove('dragover');
        if (e.dataTransfer.files.length) {
            document.getElementById('imageUpload').files = e.dataTransfer.files;
            handleImageUpload({ target: { files: e.dataTransfer.files } });
        }
    });
}

function submitReport() {
    if (!currentUser) { openAuthModal(); return; }

    var name = document.getElementById('reporterName').value.trim() || currentUser.displayName || '';
    if (!name) { showToast('Please enter your name', 'info'); return; }

    var payload = {
        name:        name,
        email:       currentUser.email,
        type:        selectedType,
        title:       document.getElementById('itemName').value.trim(),
        description: document.getElementById('itemDescription').value.trim() || 'No description provided.',
        category:    document.getElementById('itemCategory').value,
        location:    selectedLocation,
        item_date:   document.getElementById('itemDate').value,
        image_url:   document.getElementById('previewImg').src || ''
    };

    // Always get a fresh token before submitting
    currentUser.getIdToken(true).then(function(token) {
        firebaseIdToken = token;
        return fetch(API_BASE + '/items', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + token
            },
            body: JSON.stringify(payload)
        });
    })
    .then(function(res) {
        if (!res.ok) throw new Error('Server error: ' + res.status);
        return res.json();
    })
    .then(function() {
        document.querySelectorAll('.form-step').forEach(function(s) { s.classList.remove('active'); });
        document.getElementById('stepProgress').style.display = 'none';
        document.getElementById('successScreen').classList.add('active');
        fireConfetti();
        showToast('Item reported successfully!', 'success');
    })
    .catch(function(err) {
        console.error('Failed to submit report:', err);
        showToast('Failed to submit. Please try again.', 'info');
    });
}

function resetForm() {
    currentStep = 1;
    selectedType = '';
    selectedLocation = '';
    document.getElementById('itemName').value = '';
    document.getElementById('itemCategory').value = '';
    document.getElementById('itemDate').value = '';
    document.getElementById('itemDescription').value = '';
    document.getElementById('reporterName').value  = currentUser ? (currentUser.displayName || '') : '';
    document.getElementById('reporterEmail').value = currentUser ? (currentUser.email || '') : '';
    document.getElementById('previewImg').src = '';
    document.getElementById('uploadPreview').style.display = 'none';
    document.querySelectorAll('.type-option').forEach(function(o) { o.classList.remove('selected'); });
    document.querySelectorAll('.location-option').forEach(function(o) { o.classList.remove('selected'); });

    document.getElementById('stepProgress').style.display = 'flex';
    document.getElementById('successScreen').classList.remove('active');
    updateFormStep();
}


// =================== REUNITE MODAL & CONFETTI ===================
function openReuniteModal(itemId) {
    reuniteTargetId = itemId;
    document.getElementById('reuniteModal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeModal() {
    document.getElementById('reuniteModal').classList.remove('active');
    reuniteTargetId = null;
    document.body.style.overflow = '';
}

// =================== ITEM DETAIL MODAL ===================
function openItemDetail(itemId) {
    var item = ITEMS_DATA.find(function(i) { return i.id === itemId; });
    if (!item) return;

    var img = document.getElementById('detailImg');
    img.src = item.image;
    img.alt = item.title;
    img.style.display = item.image ? 'block' : 'none';

    var typeEl = document.getElementById('detailType');
    typeEl.className = 'item-card-type ' + item.type;
    typeEl.textContent = item.type === 'lost' ? '🔴 Lost' : '🟢 Found';

    document.getElementById('detailTitle').textContent = item.title;
    document.getElementById('detailDesc').textContent = item.description || 'No description provided.';
    document.getElementById('detailCategory').textContent = item.category;
    document.getElementById('detailLocation').textContent = item.location;
    document.getElementById('detailDate').textContent = new Date(item.date).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
    document.getElementById('detailAvatar').textContent = item.avatar;
    document.getElementById('detailUser').textContent = item.user;
    var emailEl = document.getElementById('detailEmail');
    emailEl.textContent = item.email;
    emailEl.href = 'mailto:' + item.email;

    document.getElementById('detailReuniteBtn').onclick = function() {
        closeItemDetail();
        openReuniteModal(item.id);
    };

    document.getElementById('itemDetailModal').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeItemDetail() {
    document.getElementById('itemDetailModal').classList.remove('active');
    document.body.style.overflow = '';
}

function confirmReunite() {
    var targetId = reuniteTargetId;
    closeModal();

    var doReunite = function(token) {
        var headers = { 'Content-Type': 'application/json' };
        if (token) headers['Authorization'] = 'Bearer ' + token;

        fetch(API_BASE + '/items/' + targetId + '/reunite', {
            method: 'PUT',
            headers: headers
        })
        .then(function(res) {
            if (!res.ok) throw new Error('Server error: ' + res.status);
            return res.json();
        })
        .then(function() {
            fireConfetti();
            showToast('🎊 Item successfully reunited! You\'re amazing!', 'success');
            renderFeed();
        })
        .catch(function(err) {
            console.error('Failed to reunite:', err);
            showToast('Failed to reunite. Please try again.', 'info');
        });
    };

    if (currentUser) {
        currentUser.getIdToken(true).then(doReunite);
    } else {
        openAuthModal();
    }
}


// =================== CONFETTI ENGINE ===================
function fireConfetti() {
    var canvas = document.getElementById('confetti-canvas');
    var ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    var particles = [];
    var colors = ['#ff4d4d', '#ff8c42', '#ffd740', '#00e676', '#40c4ff', '#b388ff', '#ff80ab', '#ffffff'];
    var shapes = ['rect', 'circle', 'triangle'];

    for (var i = 0; i < 200; i++) {
        particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height - canvas.height,
            w: Math.random() * 10 + 5,
            h: Math.random() * 6 + 3,
            color: colors[Math.floor(Math.random() * colors.length)],
            shape: shapes[Math.floor(Math.random() * shapes.length)],
            vx: (Math.random() - 0.5) * 8,
            vy: Math.random() * 4 + 2,
            rotation: Math.random() * 360,
            rotSpeed: (Math.random() - 0.5) * 10,
            opacity: 1,
            gravity: 0.12 + Math.random() * 0.08,
            wobble: Math.random() * 10,
            wobbleSpeed: Math.random() * 0.1 + 0.02
        });
    }

    var startTime = Date.now();
    var duration = 4000;

    function animate() {
        var elapsed = Date.now() - startTime;
        if (elapsed > duration) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            return;
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        particles.forEach(function(p) {
            p.x += p.vx + Math.sin(p.wobble) * 0.5;
            p.y += p.vy;
            p.vy += p.gravity;
            p.vx *= 0.99;
            p.rotation += p.rotSpeed;
            p.wobble += p.wobbleSpeed;

            if (elapsed > duration * 0.6) {
                p.opacity = Math.max(0, 1 - (elapsed - duration * 0.6) / (duration * 0.4));
            }

            ctx.save();
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rotation * Math.PI / 180);
            ctx.globalAlpha = p.opacity;
            ctx.fillStyle = p.color;

            if (p.shape === 'rect') {
                ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
            } else if (p.shape === 'circle') {
                ctx.beginPath();
                ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
                ctx.fill();
            } else {
                ctx.beginPath();
                ctx.moveTo(0, -p.w / 2);
                ctx.lineTo(p.w / 2, p.w / 2);
                ctx.lineTo(-p.w / 2, p.w / 2);
                ctx.closePath();
                ctx.fill();
            }

            ctx.restore();
        });

        requestAnimationFrame(animate);
    }

    animate();
}


// =================== TOAST NOTIFICATIONS ===================
function showToast(message, type) {
    var container = document.getElementById('toastContainer');
    var toast = document.createElement('div');
    toast.className = 'toast toast-' + type;
    toast.innerHTML = (type === 'success' ? '✅' : 'ℹ️') + ' ' + message;
    container.appendChild(toast);

    setTimeout(function() {
        toast.remove();
    }, 3200);
}


// =================== SCROLL EFFECTS ===================
window.addEventListener('scroll', function() {
    var navbar = document.getElementById('navbar');
    if (window.scrollY > 50) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }
});


// =================== INIT ===================
document.addEventListener('DOMContentLoaded', function() {
    // Set today's date as default
    document.getElementById('itemDate').valueAsDate = new Date();
});


// =================== WINDOW RESIZE (confetti canvas) ===================
window.addEventListener('resize', function() {
    var canvas = document.getElementById('confetti-canvas');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});