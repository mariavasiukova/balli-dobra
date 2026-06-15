// глобальные переменные
let currentUser = null;
let currentPage = 1;
let totalPages = 1;
let currentBookingId = null;
let currentOfferingId = null;

// переключение между страницами
function showPage(pageId) {
    const pages = document.querySelectorAll('.page');
    for (let i = 0; i < pages.length; i++) {
        pages[i].classList.remove('active');
    }
    const targetPage = document.getElementById('page-' + pageId);
    if (targetPage) targetPage.classList.add('active');

    updateNavigation();

    if (pageId === 'home') {
        loadRating();
        loadPopularOffers();
        loadChallenges();
        loadStats();
    }
    if (pageId === 'catalog') {
        currentPage = 1;
        loadCatalog();
    }
    if (pageId === 'profile' && currentUser) loadProfile();
    if (pageId === 'admin' && currentUser && currentUser.role === 'admin') {
        loadAdminPendingAchievements();
        loadAdminPendingChallenges();
    }
    if (pageId === 'offering-detail' && currentOfferingId) loadOfferingDetail(currentOfferingId);
    if (pageId === 'booking-detail' && currentBookingId) loadBookingDetail(currentBookingId);
}

// обновление шапки сайта (меню пользователя)
function updateNavigation() {
    const userMenu = document.getElementById('user-menu');
    if (!userMenu) return;

    if (!currentUser) {
        userMenu.innerHTML = '<button class="btn btn-secondary" onclick="showPage(\'login\')">Вход</button>';
        return;
    }

    const avatarUrl = currentUser.avatar || '/images/avatar-default.png';
    userMenu.innerHTML = `
        <div style="position:relative; display:flex; align-items:center; gap:15px;">
            <div class="balance-badge">Баллов: ${currentUser.totalPoints || 0}</div>
            <div class="user-avatar" id="user-avatar-btn" style="cursor:pointer;">
                <img src="${avatarUrl}" style="width:40px; height:40px; border-radius:50%; object-fit:cover;" onerror="this.src='/images/avatar-default.png'">
            </div>
            <div class="dropdown-menu" id="dropdown-menu" style="display:none; position:absolute; top:50px; right:0; background:white; border-radius:12px; box-shadow:0 5px 15px rgba(0,0,0,0.1); min-width:150px; z-index:1000;">
                <a onclick="showPage('profile')" style="display:block; padding:10px 20px; cursor:pointer;">Мой профиль</a>
                ${currentUser.role === 'admin' ? '<a onclick="showPage(\'admin\')" style="display:block; padding:10px 20px; cursor:pointer;">Админ-панель</a>' : ''}
                <a onclick="logout()" style="display:block; padding:10px 20px; cursor:pointer;">Выход</a>
            </div>
        </div>
    `;

    const avatarBtn = document.getElementById('user-avatar-btn');
    const dropdown = document.getElementById('dropdown-menu');
    if (avatarBtn && dropdown) {
        avatarBtn.onclick = function (e) {
            e.stopPropagation();
            dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
        };
        document.addEventListener('click', function () {
            dropdown.style.display = 'none';
        });
    }
}

// выход из аккаунта
async function logout() {
    await fetch('/api/logout', { method: 'POST' });
    currentUser = null;
    updateNavigation();
    showPage('home');
}

// загрузка текущего пользователя
async function loadCurrentUser() {
    try {
        const response = await fetch('/api/me');
        const data = await response.json();

        if (data.authenticated) {
            currentUser = data;
            const heroButton = document.getElementById('hero-button');
            if (heroButton) heroButton.innerHTML = '<button class="btn btn-primary" onclick="showPage(\'add-achievement\')">Добавить достижение</button>';
        } else {
            currentUser = null;
            const heroButton = document.getElementById('hero-button');
            if (heroButton) heroButton.innerHTML = '<button class="btn btn-primary" onclick="showPage(\'register\')">Начать копить баллы</button>';
        }
        updateNavigation();
    } catch (err) {
        console.error('Ошибка загрузки пользователя:', err);
    }
}

// статистика для баннера
async function loadStats() {
    try {
        const response = await fetch('/api/stats');
        const stats = await response.json();
        const container = document.getElementById('hero-stats');
        if (container) {
            container.innerHTML = `
                <div class="stat-item"><div class="stat-number">${stats.childrenCount}</div><div class="stat-label">участников</div></div>
                <div class="stat-item"><div class="stat-number">${stats.totalPoints}</div><div class="stat-label">всего баллов</div></div>
                <div class="stat-item"><div class="stat-number">${stats.offeringsCount}</div><div class="stat-label">мероприятий</div></div>
            `;
        }
    } catch (err) {
        console.error('Ошибка загрузки статистики:', err);
    }
}

// доска почёта (рейтинг)
async function loadRating() {
    try {
        const response = await fetch('/api/rating');
        const users = await response.json();
        const container = document.getElementById('rating-list');
        if (!container) return;

        if (!users || users.length === 0) {
            container.innerHTML = '<div class="empty-state">Пока нет участников</div>';
            return;
        }

        let html = '';
        for (let i = 0; i < users.length; i++) {
            const user = users[i];
            const avatarUrl = user.avatar_url || '/images/avatar-default.png';
            html += `
                <div class="rating-item">
                    <div class="rating-rank">${i + 1}</div>
                    <div class="rating-avatar"><img src="${avatarUrl}" onerror="this.src='/images/avatar-default.png'"></div>
                    <div class="rating-name">${escapeHtml(user.full_name)}</div>
                    <div class="rating-points">${user.total_points} баллов</div>
                </div>
            `;
        }
        container.innerHTML = html;
    } catch (err) {
        console.error('Ошибка загрузки рейтинга:', err);
    }
}

// популярные предложения для главной
async function loadPopularOffers() {
    try {
        const response = await fetch('/api/offerings/popular');
        const offers = await response.json();
        const container = document.getElementById('popular-offers');
        if (!container) return;

        if (!offers || offers.length === 0) {
            container.innerHTML = '<div class="empty-state">Предложений пока нет</div>';
            return;
        }

        let html = '';
        for (let i = 0; i < offers.length; i++) {
            const offer = offers[i];
            const imageUrl = offer.image_url || '/images/' + offer.type + '.jpg';
            html += `
                <div class="card" onclick="showOfferingDetail(${offer.id})">
                    <img src="${imageUrl}" onerror="this.src='/images/${offer.type}.jpg'" class="card-img">
                    <div class="card-content">
                        <div class="card-title">${getTypeLabel(offer.type)}: ${escapeHtml(offer.title)}</div>
                        <div class="card-meta">${escapeHtml(offer.city)}</div>
                        <div class="card-points">${offer.points_cost} баллов</div>
                        <button class="btn btn-primary btn-small" onclick="event.stopPropagation(); exchangeOffer(${offer.id})">Обменять</button>
                    </div>
                </div>
            `;
        }
        container.innerHTML = html;
    } catch (err) {
        console.error('Ошибка загрузки предложений:', err);
    }
}

// челленджи
async function loadChallenges() {
    try {
        let completedIds = [];
        if (currentUser) {
            const userChallengesRes = await fetch('/api/user-challenges');
            const userChallengesData = await userChallengesRes.json();
            completedIds = userChallengesData.completedIds || [];
        }

        const response = await fetch('/api/challenges');
        const challenges = await response.json();
        const container = document.getElementById('challenges-list');
        if (!container) return;

        if (!challenges || challenges.length === 0) {
            container.innerHTML = '<div class="empty-state">Активных челленджей нет</div>';
            return;
        }

        let html = '';
        for (let i = 0; i < challenges.length; i++) {
            const challenge = challenges[i];
            const isCompleted = completedIds.includes(challenge.id);

            if (isCompleted) {
                continue;
            }

            html += `
                <div class="challenge-card">
                    <div class="challenge-title">${escapeHtml(challenge.title)}</div>
                    <div class="challenge-desc">${escapeHtml(challenge.description)}</div>
                    <div class="challenge-reward">+${challenge.reward_points} баллов</div>
                    ${currentUser ? `<button class="btn btn-secondary btn-small" onclick="completeChallenge(${challenge.id})">Выполнить</button>` : ''}
                </div>
            `;
        }

        if (html === '') {
            container.innerHTML = '<div class="empty-state">Все челленджи выполнены!</div>';
        } else {
            container.innerHTML = html;
        }
    } catch (err) {
        console.error('Ошибка загрузки челленджей:', err);
    }
}

// выполнение челленджа с загрузкой фото
async function completeChallenge(challengeId) {
    if (!currentUser) {
        alert('Войдите в аккаунт');
        showPage('login');
        return;
    }

    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = 'image/*';
    fileInput.onchange = async function (e) {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('proof', file);

        try {
            const response = await fetch('/api/challenge/' + challengeId + '/complete', { method: 'POST', body: formData });
            const data = await response.json();
            if (data.success) {
                alert('Фото отправлено на проверку');
                loadChallenges();
            } else {
                alert(data.error || 'Ошибка');
            }
        } catch (err) {
            alert('Ошибка сервера');
        }
    };
    fileInput.click();
}

// каталог мероприятий с фильтрацией и пагинацией
async function loadCatalog() {
    try {
        const typeSelect = document.getElementById('filter-type');
        const cityInput = document.getElementById('filter-city');
        const type = typeSelect ? typeSelect.value : 'all';
        const city = cityInput ? cityInput.value : '';

        const response = await fetch('/api/offerings?type=' + type + '&city=' + encodeURIComponent(city) + '&page=' + currentPage);
        const data = await response.json();

        const container = document.getElementById('catalog-list');
        if (!container) return;

        if (!data.offerings || data.offerings.length === 0) {
            container.innerHTML = '<div class="empty-state">По вашему запросу ничего не найдено</div>';
            return;
        }

        let html = '';
        for (let i = 0; i < data.offerings.length; i++) {
            const offer = data.offerings[i];
            const imageUrl = offer.image_url || '/images/' + offer.type + '.jpg';
            html += `
                <div class="card" onclick="showOfferingDetail(${offer.id})">
                    <img src="${imageUrl}" onerror="this.src='/images/${offer.type}.jpg'" class="card-img">
                    <div class="card-content">
                        <div class="card-title">${getTypeLabel(offer.type)}: ${escapeHtml(offer.title)}</div>
                        <div class="card-meta">${escapeHtml(offer.city)} | ${escapeHtml(offer.duration)}</div>
                        <div class="card-meta">${offer.start_date || 'дата уточняется'} | ${offer.age_from}-${offer.age_to} лет</div>
                        <div class="card-points">${offer.points_cost} баллов</div>
                        <div class="card-meta">Осталось мест: ${offer.free_slots}</div>
                        <button class="btn btn-primary btn-small" onclick="event.stopPropagation(); exchangeOffer(${offer.id})">Обменять</button>
                    </div>
                </div>
            `;
        }
        container.innerHTML = html;

        totalPages = data.totalPages || 1;
        renderPagination();
    } catch (err) {
        console.error('Ошибка загрузки каталога:', err);
    }
}

// отрисовка пагинации
function renderPagination() {
    const container = document.getElementById('catalog-pagination');
    if (!container) return;
    if (totalPages <= 1) {
        container.innerHTML = '';
        return;
    }
    let html = '';
    for (let i = 1; i <= totalPages; i++) {
        html += `<button class="${i === currentPage ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`;
    }
    container.innerHTML = html;
}

// переход на страницу пагинации
function goToPage(page) {
    currentPage = page;
    loadCatalog();
}

// обмен баллов на мероприятие
async function exchangeOffer(offerId) {
    if (!currentUser) {
        alert('Войдите в аккаунт');
        showPage('login');
        return;
    }

    try {
        const response = await fetch('/api/exchange/' + offerId, { method: 'POST' });
        const data = await response.json();
        if (data.success) {
            alert('Обмен успешен! Номер бронирования: ' + data.bookingNumber);
            await loadCurrentUser();
            loadProfile();
            loadCatalog();
        } else {
            alert(data.error || 'Ошибка обмена');
        }
    } catch (err) {
        alert('Ошибка сервера');
    }
}

// показ деталей мероприятия
function showOfferingDetail(offeringId) {
    currentOfferingId = offeringId;
    showPage('offering-detail');
}

// загрузка деталей мероприятия
async function loadOfferingDetail(offeringId) {
    try {
        const response = await fetch('/api/offering/' + offeringId);
        const offer = await response.json();
        const container = document.getElementById('offering-detail-content');
        if (!container) return;

        const reviewsResponse = await fetch('/api/reviews/' + offeringId);
        const reviews = await reviewsResponse.json();

        const imageUrl = offer.image_url || '/images/' + offer.type + '.jpg';
        let reviewsHtml = '';
        if (reviews && reviews.length > 0) {
            reviewsHtml = '<h4>Отзывы</h4>';
            for (let i = 0; i < reviews.length; i++) {
                const r = reviews[i];
                reviewsHtml += `<div class="review-item"><b>${escapeHtml(r.full_name)}</b> — ${'★'.repeat(r.rating)}<br>${escapeHtml(r.comment)}</div>`;
            }
        }

        container.innerHTML = `
            <div class="detail-card">
                <div class="detail-header">
                    <h2>${escapeHtml(offer.title)}</h2>
                    <p>${escapeHtml(offer.city)} | ${escapeHtml(offer.duration)}</p>
                </div>
                <div class="detail-info">
                    <div class="detail-section"><h4>Описание</h4><p>${escapeHtml(offer.description || 'Нет описания')}</p></div>
                    <div class="detail-section"><h4>Программа</h4><p>${escapeHtml(offer.program || 'Не указана')}</p></div>
                    <div class="detail-section"><h4>Расписание</h4>
                        <div class="detail-row"><div class="detail-label">Дата начала</div><div>${offer.start_date || 'уточняется'}</div></div>
                        <div class="detail-row"><div class="detail-label">Дата окончания</div><div>${offer.end_date || 'уточняется'}</div></div>
                        <div class="detail-row"><div class="detail-label">Длительность</div><div>${offer.duration}</div></div>
                        <div class="detail-row"><div class="detail-label">Возраст</div><div>${offer.age_from}-${offer.age_to} лет</div></div>
                    </div>
                    <div class="detail-section"><h4>Место проведения</h4>
                        <div class="detail-row"><div class="detail-label">Город</div><div>${escapeHtml(offer.city)}</div></div>
                        <div class="detail-row"><div class="detail-label">Адрес</div><div>${escapeHtml(offer.address || 'уточняется')}</div></div>
                    </div>
                    <div class="detail-section"><h4>Контакты</h4>
                        <div class="detail-row"><div class="detail-label">Контактное лицо</div><div>${escapeHtml(offer.contact_person || '—')}</div></div>
                        <div class="detail-row"><div class="detail-label">Телефон</div><div>${escapeHtml(offer.contact_phone || '—')}</div></div>
                    </div>
                    <div class="detail-section"><h4>Важно</h4><p>${escapeHtml(offer.instruction || 'Стандартная инструкция')}</p></div>
                    <div class="detail-section"><h4>Стоимость</h4><div class="card-points">${offer.points_cost} баллов</div></div>
                    <div class="detail-section">${reviewsHtml}</div>
                    <button class="btn btn-primary" onclick="exchangeOffer(${offer.id})">Обменять баллы</button>
                </div>
            </div>
        `;
    } catch (err) {
        console.error('Ошибка загрузки мероприятия:', err);
    }
}

// загрузка профиля пользователя
async function loadProfile() {
    try {
        const profileRes = await fetch('/api/profile');
        const profile = await profileRes.json();
        const achievementsRes = await fetch('/api/achievements');
        const achievements = await achievementsRes.json();
        const historyRes = await fetch('/api/history');
        const history = await historyRes.json();
        const bookingsRes = await fetch('/api/bookings');
        const bookings = await bookingsRes.json();

        const container = document.getElementById('profile-content');
        if (!container) return;

        const avatarUrl = profile.avatar_url || '/images/avatar-default.png';
        const currentBalance = currentUser ? currentUser.totalPoints : 0;

        let html = `
            <div class="profile-header">
                <div class="avatar-upload">
                    <img src="${avatarUrl}" class="current-avatar" id="profile-avatar" onerror="this.src='/images/avatar-default.png'">
                    <button class="btn btn-secondary btn-small" onclick="document.getElementById('avatar-input').click()">Загрузить фото</button>
                    <input type="file" id="avatar-input" accept="image/*" style="display:none">
                </div>
                <div class="profile-balance">Баллов: ${currentBalance}</div>
            </div>
            <div class="info-card">
                <h3>Личная информация</h3>
                <div class="info-grid">
                    <div><div class="info-label">ФИО</div><div class="info-value">${escapeHtml(profile.full_name || '')}</div></div>
                    <div><div class="info-label">Email</div><div class="info-value">${escapeHtml(profile.email || '')}</div></div>
                    <div><div class="info-label">Школа</div><div class="info-value" id="profile-school">${escapeHtml(profile.school || '—')}</div></div>
                    <div><div class="info-label">Класс</div><div class="info-value" id="profile-class">${profile.class || '—'}</div></div>
                    <div><div class="info-label">Город</div><div class="info-value" id="profile-city">${escapeHtml(profile.city || '—')}</div></div>
                    <div><div class="info-label">Телефон родителя</div><div class="info-value" id="profile-phone">${escapeHtml(profile.parent_phone || '—')}</div></div>
                </div>
                <button class="btn btn-secondary btn-small" onclick="editProfile()">Редактировать</button>
            </div>
            <div class="subsection-header"><h3>Мои бронирования</h3></div>
        `;

        if (bookings && bookings.length > 0) {
            html += '<div class="bookings-list">';
            for (let i = 0; i < bookings.length; i++) {
                const b = bookings[i];
                html += `
                    <div class="booking-item">
                        <div><div class="booking-item-title">${escapeHtml(b.title)}</div><div class="booking-item-meta">${escapeHtml(b.city)} | ${b.start_date || 'дата уточняется'}</div></div>
                        <button class="btn btn-secondary btn-small" onclick="showBookingDetail(${b.id})">Подробнее</button>
                    </div>
                `;
            }
            html += '</div>';
        } else {
            html += '<div class="empty-state">У вас пока нет бронирований</div>';
        }

        html += `<div class="subsection-header"><h3>Мои достижения</h3><button class="btn btn-secondary btn-small" onclick="showPage('add-achievement')">Добавить достижение</button></div><div class="cards-grid">`;

        if (achievements && achievements.length > 0) {
            for (let i = 0; i < achievements.length; i++) {
                const ach = achievements[i];
                html += `
                    <div class="card">
                        <div class="card-title">${escapeHtml(ach.title)}</div>
                        <div class="card-meta">${escapeHtml(ach.category)} | ${getLevelLabel(ach.level)} | ${getPlacementLabel(ach.placement)}</div>
                        <div class="card-points">+${ach.points} баллов</div>
                        <div class="achievement-status ${getStatusClass(ach.status)}">${getStatusLabel(ach.status)}</div>
                        ${ach.file_url ? `<button class="btn btn-secondary btn-small" onclick="window.open('${ach.file_url}', '_blank')">Посмотреть файл</button>` : ''}
                        ${ach.status === 'rejected' && ach.comment ? `<div class="reject-comment">Причина: ${escapeHtml(ach.comment)}</div>` : ''}
                    </div>
                `;
            }
        } else {
            html += '<div class="empty-state">Пока нет достижений</div>';
        }

        html += `</div><div class="subsection-header"><h3>История баллов</h3></div><div class="table-wrapper"><table class="data-table"><thead><tr><th>Дата</th><th>Действие</th><th>Изменение</th><th>Баланс</th></tr></thead><tbody>`;

        if (history && history.length > 0) {
            for (let i = 0; i < history.length; i++) {
                const h = history[i];
                const actionName = h.source_type === 'achievement' ? 'Достижение' : (h.source_type === 'exchange' ? 'Обмен баллов' : 'Челлендж');
                html += `<tr><td>${h.created_at.slice(0, 10)}</td><td>${actionName}</td><td style="color:${h.points_change > 0 ? '#2e7d32' : '#c62828'}">${h.points_change > 0 ? '+' : ''}${h.points_change}</td><td>${h.balance_after}</td></tr>`;
            }
        } else {
            html += '<tr><td colspan="4" class="empty-state">История пуста</td></tr>';
        }

        html += '</tbody></table></div>';
        container.innerHTML = html;

        const avatarInput = document.getElementById('avatar-input');
        if (avatarInput) avatarInput.onchange = uploadAvatar;
    } catch (err) {
        console.error('Ошибка профиля:', err);
    }
}

// загрузка аватара
async function uploadAvatar(event) {
    const file = event.target.files[0];
    if (!file) return;
    const formData = new FormData();
    formData.append('avatar', file);
    try {
        const response = await fetch('/api/upload-avatar', { method: 'POST', body: formData });
        const data = await response.json();
        if (data.success) {
            if (currentUser) currentUser.avatar = data.avatarUrl;
            loadProfile();
            updateNavigation();
        } else {
            alert('Ошибка загрузки');
        }
    } catch (err) {
        alert('Ошибка сервера');
    }
}

// редактирование профиля
function editProfile() {
    const school = prompt('Школа:', document.getElementById('profile-school')?.innerText);
    const classNum = prompt('Класс:', document.getElementById('profile-class')?.innerText);
    const city = prompt('Город:', document.getElementById('profile-city')?.innerText);
    const phone = prompt('Телефон родителя:', document.getElementById('profile-phone')?.innerText);
    fetch('/api/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ school, class_num: classNum, city, parent_phone: phone })
    }).then(() => loadProfile());
}

// показ деталей бронирования
function showBookingDetail(bookingId) {
    currentBookingId = bookingId;
    showPage('booking-detail');
}

// загрузка деталей бронирования
async function loadBookingDetail(bookingId) {
    try {
        const response = await fetch('/api/booking/' + bookingId);
        const booking = await response.json();
        const container = document.getElementById('booking-detail-content');
        if (!container) return;
        container.innerHTML = `
            <div class="booking-detail-card">
                <div class="booking-header">
                    <h2>${escapeHtml(booking.title)}</h2>
                    <div class="booking-number">Номер: ${booking.booking_number}</div>
                </div>
                <div class="booking-info">
                    <div class="info-block">
                        <div class="info-row"><div class="info-label">Дата</div><div>${booking.start_date || 'уточняется'}</div></div>
                        <div class="info-row"><div class="info-label">Адрес</div><div>${escapeHtml(booking.address || 'уточняется')}</div></div>
                        <div class="info-row"><div class="info-label">Длительность</div><div>${escapeHtml(booking.duration)}</div></div>
                    </div>
                    <div class="info-block">
                        <div class="info-row"><div class="info-label">Контактное лицо</div><div>${escapeHtml(booking.contact_person || '—')}</div></div>
                        <div class="info-row"><div class="info-label">Телефон</div><div>${escapeHtml(booking.contact_phone || '—')}</div></div>
                    </div>
                    <div class="info-block instruction-block">
                        <div class="info-row"><div class="info-label">Инструкция</div><div>${escapeHtml(booking.instruction || 'Стандартная инструкция')}</div></div>
                    </div>
                </div>
                <div class="booking-actions">
                    <button class="btn btn-secondary" onclick="showPage('profile')">В профиль</button>
                    <button class="btn btn-primary" onclick="showPage('catalog')">В каталог</button>
                </div>
            </div>
        `;
    } catch (err) {
        console.error('Ошибка бронирования:', err);
    }
}

// настройка формы добавления достижения
function setupAchievementForm() {
    const levelSelect = document.getElementById('ach-level');
    const placementSelect = document.getElementById('ach-placement');
    if (levelSelect) levelSelect.addEventListener('change', updatePointsPreview);
    if (placementSelect) placementSelect.addEventListener('change', updatePointsPreview);

    const fileInput = document.getElementById('ach-file');
    if (fileInput) {
        fileInput.addEventListener('change', function (e) {
            const file = e.target.files[0];
            const preview = document.getElementById('file-preview');
            if (file && file.type.startsWith('image/')) {
                const reader = new FileReader();
                reader.onload = (ev) => { if (preview) preview.innerHTML = '<img src="' + ev.target.result + '" style="max-width:120px; border-radius:8px;">'; };
                reader.readAsDataURL(file);
            } else if (file) {
                if (preview) preview.innerHTML = '<div class="form-hint">Файл: ' + escapeHtml(file.name) + '</div>';
            }
        });
    }

    const form = document.getElementById('achievement-form');
    if (form) {
        form.onsubmit = async function (e) {
            e.preventDefault();
            const title = document.getElementById('ach-title').value;
            const category = document.getElementById('ach-category').value;
            const level = document.getElementById('ach-level').value;
            const placement = document.getElementById('ach-placement').value;
            const file = document.getElementById('ach-file').files[0];
            if (!file) { alert('Загрузите файл диплома'); return; }
            const formData = new FormData();
            formData.append('title', title);
            formData.append('category', category);
            formData.append('level', level);
            formData.append('placement', placement);
            formData.append('document', file);
            try {
                const response = await fetch('/api/achievements', { method: 'POST', body: formData });
                const data = await response.json();
                const msgDiv = document.getElementById('achievement-message');
                if (data.success) {
                    if (msgDiv) msgDiv.innerHTML = '<div class="message-success">Достижение отправлено на проверку</div>';
                    setTimeout(() => { showPage('profile'); if (msgDiv) msgDiv.innerHTML = ''; }, 1500);
                } else {
                    if (msgDiv) msgDiv.innerHTML = '<div class="message-error">' + (data.error || 'Ошибка') + '</div>';
                }
            } catch (err) { alert('Ошибка сервера'); }
        };
    }
}

// пересчёт баллов в форме добавления достижения
function updatePointsPreview() {
    const level = document.getElementById('ach-level')?.value;
    const placement = document.getElementById('ach-placement')?.value;
    const levelMultiplier = { school: 1, city: 2, regional: 4, national: 8, international: 16 };
    const placeMultiplier = { winner: 3, prize: 2, participant: 1 };
    const points = (levelMultiplier[level] || 1) * (placeMultiplier[placement] || 1) * 10;
    const preview = document.getElementById('points-preview');
    if (preview) preview.innerHTML = points + ' баллов';
}

// админ-панель: загрузка достижений на проверке
async function loadAdminPendingAchievements() {
    try {
        const response = await fetch('/api/admin/pending-achievements');
        const pending = await response.json();
        const container = document.getElementById('admin-pending-achievements');
        if (!container) return;
        if (!pending || pending.length === 0) {
            container.innerHTML = '<div class="empty-state">Нет достижений на проверке</div>';
            return;
        }
        let html = '';
        for (let i = 0; i < pending.length; i++) {
            const a = pending[i];
            html += `
                <div class="moderation-card">
                    <div><strong>${escapeHtml(a.title)}</strong> — ${escapeHtml(a.user_name)}</div>
                    <div>${escapeHtml(a.category)} | ${getLevelLabel(a.level)} | ${getPlacementLabel(a.placement)} | ${a.points} баллов</div>
                    ${a.file_url ? `<div><button class="btn btn-secondary btn-small" onclick="window.open('${a.file_url}', '_blank')">Посмотреть файл</button></div>` : ''}
                    <div class="moderation-actions">
                        <button class="btn btn-success btn-small" onclick="approveAchievement(${a.id})">Одобрить</button>
                        <button class="btn btn-danger btn-small" onclick="rejectAchievement(${a.id})">Отклонить</button>
                    </div>
                </div>
            `;
        }
        container.innerHTML = html;
    } catch (err) { console.error(err); }
}

// админ-панель: загрузка челленджей на проверке
async function loadAdminPendingChallenges() {
    try {
        const response = await fetch('/api/admin/pending-challenges');
        const pending = await response.json();
        const container = document.getElementById('admin-pending-challenges');
        if (!container) return;
        if (!pending || pending.length === 0) {
            container.innerHTML = '<div class="empty-state">Нет челленджей на проверке</div>';
            return;
        }
        let html = '';
        for (let i = 0; i < pending.length; i++) {
            const c = pending[i];
            html += `
                <div class="moderation-card">
                    <div><strong>${escapeHtml(c.challenge_title)}</strong> — ${escapeHtml(c.user_name)}</div>
                    <div>Награда: ${c.reward_points} баллов</div>
                    ${c.proof_url ? `<div><button class="btn btn-secondary btn-small" onclick="window.open('${c.proof_url}', '_blank')">Посмотреть фото</button></div>` : ''}
                    <div class="moderation-actions">
                        <button class="btn btn-success btn-small" onclick="approveChallenge(${c.id})">Одобрить</button>
                        <button class="btn btn-danger btn-small" onclick="rejectChallenge(${c.id})">Отклонить</button>
                    </div>
                </div>
            `;
        }
        container.innerHTML = html;
    } catch (err) { console.error(err); }
}

// админ: одобрение достижения
async function approveAchievement(id) {
    if (!confirm('Одобрить достижение?')) return;
    await fetch('/api/admin/approve-achievement/' + id, { method: 'POST' });
    loadAdminPendingAchievements();
}

// админ: отклонение достижения
async function rejectAchievement(id) {
    const comment = prompt('Причина отклонения:');
    await fetch('/api/admin/reject-achievement/' + id, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ comment }) });
    loadAdminPendingAchievements();
}

// админ: одобрение челленджа
async function approveChallenge(id) {
    if (!confirm('Одобрить выполнение челленджа?')) return;
    await fetch('/api/admin/approve-challenge/' + id, { method: 'POST' });
    loadAdminPendingChallenges();
}

// админ: отклонение челленджа
async function rejectChallenge(id) {
    const comment = prompt('Причина отклонения:');
    await fetch('/api/admin/reject-challenge/' + id, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ comment }) });
    loadAdminPendingChallenges();
}

// настройка форм администратора
function setupAdminForms() {
    const offeringForm = document.getElementById('admin-add-offering-form');
    if (offeringForm) {
        offeringForm.onsubmit = async (e) => {
            e.preventDefault();
            const formData = new FormData();
            formData.append('type', document.getElementById('offering-type').value);
            formData.append('title', document.getElementById('offering-title').value);
            formData.append('description', document.getElementById('offering-description').value);
            formData.append('program', document.getElementById('offering-program').value);
            formData.append('city', document.getElementById('offering-city').value);
            formData.append('address', document.getElementById('offering-address').value);
            formData.append('duration', document.getElementById('offering-duration').value);
            formData.append('points_cost', document.getElementById('offering-points').value);
            formData.append('total_slots', document.getElementById('offering-slots').value);
            formData.append('age_from', document.getElementById('offering-age-from').value);
            formData.append('age_to', document.getElementById('offering-age-to').value);
            formData.append('start_date', document.getElementById('offering-start-date').value);
            formData.append('end_date', document.getElementById('offering-end-date').value);
            formData.append('contact_person', document.getElementById('offering-contact-person').value);
            formData.append('contact_phone', document.getElementById('offering-contact-phone').value);
            formData.append('instruction', document.getElementById('offering-instruction').value);
            const imageFile = document.getElementById('offering-image').files[0];
            if (imageFile) formData.append('image', imageFile);

            const response = await fetch('/api/admin/offering', { method: 'POST', body: formData });
            const data = await response.json();
            const msgDiv = document.getElementById('admin-offering-message');
            if (data.success) {
                if (msgDiv) msgDiv.innerHTML = '<div class="message-success">Мероприятие добавлено</div>';
                offeringForm.reset();
                setTimeout(() => { if (msgDiv) msgDiv.innerHTML = ''; }, 3000);
            } else {
                if (msgDiv) msgDiv.innerHTML = '<div class="message-error">Ошибка: ' + (data.error || 'неизвестная') + '</div>';
            }
        };
    }

    const challengeForm = document.getElementById('admin-add-challenge-form');
    if (challengeForm) {
        challengeForm.onsubmit = async (e) => {
            e.preventDefault();
            const data = {
                title: document.getElementById('challenge-title').value,
                description: document.getElementById('challenge-description').value,
                reward_points: document.getElementById('challenge-reward').value,
                start_date: document.getElementById('challenge-start-date').value,
                end_date: document.getElementById('challenge-end-date').value
            };
            const response = await fetch('/api/admin/challenge', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
            const result = await response.json();
            const msgDiv = document.getElementById('admin-challenge-message');
            if (result.success) {
                if (msgDiv) msgDiv.innerHTML = '<div class="message-success">Челлендж добавлен</div>';
                challengeForm.reset();
                setTimeout(() => { if (msgDiv) msgDiv.innerHTML = ''; }, 3000);
            } else {
                if (msgDiv) msgDiv.innerHTML = '<div class="message-error">Ошибка</div>';
            }
        };
    }
}

// настройка вкладок в админ-панели
function setupAdminTabs() {
    const tabs = document.querySelectorAll('.admin-tab');
    for (let i = 0; i < tabs.length; i++) {
        tabs[i].addEventListener('click', function () {
            const tabId = this.getAttribute('data-tab');
            for (let j = 0; j < tabs.length; j++) tabs[j].classList.remove('active');
            this.classList.add('active');
            const contents = document.querySelectorAll('.admin-tab-content');
            for (let j = 0; j < contents.length; j++) contents[j].classList.remove('active');
            const activeContent = document.getElementById('admin-' + tabId);
            if (activeContent) activeContent.classList.add('active');
        });
    }
}

// настройка формы входа
function setupLoginForm() {
    const form = document.getElementById('login-form');
    if (form) {
        form.onsubmit = async (e) => {
            e.preventDefault();
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: document.getElementById('login-email').value, password: document.getElementById('login-password').value })
            });
            const data = await response.json();
            if (data.success) {
                await loadCurrentUser();
                showPage(data.role === 'admin' ? 'admin' : 'profile');
            } else {
                document.getElementById('login-error').innerText = data.error;
            }
        };
    }
}

// настройка формы регистрации
function setupRegisterForm() {
    const form = document.getElementById('register-form');
    if (form) {
        form.onsubmit = async (e) => {
            e.preventDefault();
            const password = document.getElementById('reg-password').value;
            const password2 = document.getElementById('reg-password2').value;
            if (password !== password2) {
                document.getElementById('register-error').innerText = 'Пароли не совпадают';
                return;
            }
            const response = await fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: document.getElementById('reg-email').value,
                    password: password,
                    full_name: document.getElementById('reg-fullname').value,
                    school: document.getElementById('reg-school').value,
                    class_num: document.getElementById('reg-class').value,
                    city: document.getElementById('reg-city').value,
                    parent_phone: document.getElementById('reg-phone').value
                })
            });
            const data = await response.json();
            if (data.success) {
                document.getElementById('register-success').innerText = 'Регистрация успешна! Теперь войдите.';
                setTimeout(() => showPage('login'), 1500);
            } else {
                document.getElementById('register-error').innerText = data.error;
            }
        };
    }
}

// настройка фильтров каталога
function setupFilters() {
    const applyBtn = document.getElementById('apply-filters');
    const resetBtn = document.getElementById('reset-filters');
    if (applyBtn) applyBtn.onclick = () => { currentPage = 1; loadCatalog(); };
    if (resetBtn) resetBtn.onclick = () => {
        const typeSelect = document.getElementById('filter-type');
        const cityInput = document.getElementById('filter-city');
        if (typeSelect) typeSelect.value = 'all';
        if (cityInput) cityInput.value = '';
        currentPage = 1;
        loadCatalog();
    };
}

// настройка полей пароля (показать/скрыть)
function setupPasswordToggles() {
    const toggleButtons = document.querySelectorAll('.toggle-password');
    for (let i = 0; i < toggleButtons.length; i++) {
        const btn = toggleButtons[i];
        btn.addEventListener('click', function () {
            const targetId = this.getAttribute('data-target');
            const input = document.getElementById(targetId);
            if (input) {
                const type = input.type === 'password' ? 'text' : 'password';
                input.type = type;
                const img = this.querySelector('img');
                if (img) {
                    img.src = type === 'password' ? '/images/eye-closed.png' : '/images/eye-open.png';
                }
            }
        });
    }
}

// вспомогательные функции
function getTypeLabel(type) {
    const types = { camp: 'Лагерь', excursion: 'Экскурсия', masterclass: 'Мастер-класс', quest: 'Квест' };
    return types[type] || type;
}

function getLevelLabel(level) {
    const levels = { school: 'Школьный', city: 'Городской', regional: 'Региональный', national: 'Всероссийский', international: 'Международный' };
    return levels[level] || level;
}

function getPlacementLabel(placement) {
    const placements = { winner: 'Победитель', prize: 'Призёр', participant: 'Участник' };
    return placements[placement] || placement;
}

function getStatusLabel(status) {
    const statuses = { pending: 'На проверке', approved: 'Одобрено', rejected: 'Отклонено' };
    return statuses[status] || status;
}

function getStatusClass(status) {
    const classes = { pending: 'status-pending', approved: 'status-approved', rejected: 'status-rejected' };
    return classes[status] || '';
}

// защита от XSS (экранирование HTML)
function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// запуск при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    loadCurrentUser();
    showPage('home');
    setupAchievementForm();
    setupLoginForm();
    setupRegisterForm();
    setupFilters();
    setupAdminForms();
    setupAdminTabs();
    setupPasswordToggles();
});
