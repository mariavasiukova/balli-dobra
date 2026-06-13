const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

const app = express();
const PORT = 3000;

if (!fs.existsSync('./uploads')) fs.mkdirSync('./uploads');
if (!fs.existsSync('./images')) fs.mkdirSync('./images');

const db = new sqlite3.Database('./database.sqlite');

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        full_name TEXT NOT NULL,
        role TEXT DEFAULT 'child',
        avatar_url TEXT,
        school TEXT,
        class INTEGER,
        city TEXT,
        parent_phone TEXT,
        total_points INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS achievements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        category TEXT,
        level TEXT,
        placement TEXT,
        points INTEGER,
        file_url TEXT,
        status TEXT DEFAULT 'pending',
        comment TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS points_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        source_type TEXT,
        source_id INTEGER,
        points_change INTEGER,
        balance_after INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS offerings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        program TEXT,
        city TEXT,
        address TEXT,
        duration TEXT,
        points_cost INTEGER,
        total_slots INTEGER,
        free_slots INTEGER,
        age_from INTEGER,
        age_to INTEGER,
        start_date TEXT,
        end_date TEXT,
        contact_person TEXT,
        contact_phone TEXT,
        instruction TEXT,
        image_url TEXT,
        is_active INTEGER DEFAULT 1
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS bookings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        offering_id INTEGER NOT NULL,
        booking_number TEXT UNIQUE,
        points_spent INTEGER,
        status TEXT DEFAULT 'confirmed',
        booked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        used_at DATETIME,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (offering_id) REFERENCES offerings(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS challenges (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        reward_points INTEGER,
        start_date TEXT,
        end_date TEXT,
        is_active INTEGER DEFAULT 1
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS user_challenges (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        challenge_id INTEGER NOT NULL,
        proof_url TEXT,
        status TEXT DEFAULT 'pending',
        comment TEXT,
        submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (challenge_id) REFERENCES challenges(id)
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        booking_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        offering_id INTEGER NOT NULL,
        rating INTEGER,
        comment TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_approved INTEGER DEFAULT 1
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        title TEXT,
        message TEXT,
        is_read INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
    )`);
});

db.get("SELECT COUNT(*) as count FROM users", [], (err, row) => {
    if (row.count === 0) {
        const adminPass = bcrypt.hashSync('admin123', 10);
        const childPass = bcrypt.hashSync('123456', 10);

        db.run(`INSERT INTO users (email, password_hash, full_name, role, city, total_points) VALUES (?, ?, ?, ?, ?, ?)`,
            ['admin@test.ru', adminPass, 'Анна Сергеевна', 'admin', 'Москва', 0]);

        db.run(`INSERT INTO users (email, password_hash, full_name, role, school, class, city, parent_phone, total_points) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            ['child@test.ru', childPass, 'Алексей Иванов', 'child', 'Гимназия 1', 7, 'Москва', '+7 (999) 123-45-67', 0]);
    }
});

db.get("SELECT COUNT(*) as count FROM offerings", [], (err, row) => {
    if (row.count === 0) {
        const offers = [
            ['camp', 'IT-лагерь', 'Программирование и робототехника', 'Ежедневные занятия, хакатоны, экскурсии', 'Анапа', 'ул. Ленина 15', '7 дней', 1500, 10, 10, 8, 17, '2026-06-10', '2026-06-17', 'Ирина Петровна', '+7 (861) 333-22-11', 'После приезда обратитесь к администратору', '/images/camp-it.jpg'],
            ['camp', 'Лагерь У Моря', 'Летний лагерь на берегу Чёрного моря', 'Купание, спортивные игры, дискотеки, творческие мастерские', 'Сочи', 'ул. Приморская 5', '14 дней', 2000, 8, 8, 7, 15, '2026-07-01', '2026-07-15', 'Светлана Владимировна', '+7 (862) 222-33-44', 'Трансфер из аэропорта включён', '/images/camp-sea.jpg'],
            ['camp', 'Спортивная смена Чемпион', 'Футбол, плавание, волейбол', 'Тренировки с профессиональными тренерами, соревнования', 'Казань', 'ул. Спортивная 10', '10 дней', 1800, 12, 12, 9, 16, '2026-07-20', '2026-07-30', 'Алексей Сергеевич', '+7 (843) 555-66-77', 'Спортивная форма предоставляется', '/images/camp-sport.jpg'],
            ['excursion', 'Московский Кремль', 'Обзорная экскурсия', 'Посещение соборов, Оружейной палаты, Царь-пушки', 'Москва', 'Красная площадь', '3 часа', 300, 20, 20, 7, 17, '2026-04-20', null, 'Екатерина Сергеевна', '+7 (495) 123-45-67', 'Сбор за 15 минут до начала', '/images/excursion-kremlin.jpg'],
            ['excursion', 'Музей космонавтики', 'Космическая экскурсия', 'Макеты ракет, скафандры, тренажёры космонавтов', 'Москва', 'пр. Мира 111', '2.5 часа', 200, 25, 25, 7, 17, '2026-05-15', null, 'Михаил Николаевич', '+7 (495) 111-22-33', 'Экскурсия с интерактивной программой', '/images/excursion-space.jpg'],
            ['excursion', 'Петергоф', 'Дворцы и фонтаны', 'Прогулка по Нижнему парку, фонтаны, Большой дворец', 'Санкт-Петербург', 'Петергоф, Разводная ул. 2', '4 часа', 350, 15, 15, 8, 17, '2026-06-05', null, 'Ольга Александровна', '+7 (812) 444-55-66', 'Входные билеты включены', '/images/excursion-peterhof.jpg'],
            ['masterclass', 'Рисование 3D ручкой', 'Создание объёмных фигур', 'Обучение работе с 3D ручкой, создание игрушек и сувениров', 'Москва', 'Центр Мастерская талантов', '2 часа', 120, 15, 15, 8, 14, '2026-04-25', null, 'Анна Владимировна', '+7 (495) 987-65-43', 'Все материалы предоставляются', '/images/masterclass-3d.jpg'],
            ['masterclass', 'Робототехника', 'Сборка и программирование роботов', 'Основы робототехники, сборка Lego Mindstorms', 'Казань', 'IT-парк, ул. Батурина 7', '3 часа', 180, 10, 10, 10, 15, '2026-05-20', null, 'Тимур Рашидович', '+7 (843) 777-88-99', 'Работа в парах', '/images/masterclass-robot.jpg'],
            ['quest', 'Секретная лаборатория', 'Интерактивный квест', 'Разгадывание загадок, поиск предметов, командная работа', 'Санкт-Петербург', 'пр. Невский 88', '60 минут', 150, 8, 8, 10, 16, '2026-05-28', null, 'Дмитрий Алексеевич', '+7 (812) 333-44-55', 'Команда до 4 человек', '/images/quest-lab.jpg']
        ];

        const stmt = db.prepare(`INSERT INTO offerings (type, title, description, program, city, address, duration, points_cost, total_slots, free_slots, age_from, age_to, start_date, end_date, contact_person, contact_phone, instruction, image_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
        offers.forEach(o => stmt.run(o));
        stmt.finalize();
    }
});

db.get("SELECT COUNT(*) as count FROM challenges", [], (err, row) => {
    if (row.count === 0) {
        db.run(`INSERT INTO challenges (title, description, reward_points, start_date, end_date, is_active) VALUES (?, ?, ?, ?, ?, ?)`,
            ['Прочитай 5 книг', 'Прочитай 5 книг за месяц, загрузи фото списка прочитанных книг', 50, '2026-04-01', '2026-04-30', 1]);
        db.run(`INSERT INTO challenges (title, description, reward_points, start_date, end_date, is_active) VALUES (?, ?, ?, ?, ?, ?)`,
            ['Сдай макулатуру', 'Сдай 5 кг макулатуры, загрузи фото чека', 30, '2026-04-01', '2026-04-30', 1]);
        db.run(`INSERT INTO challenges (title, description, reward_points, start_date, end_date, is_active) VALUES (?, ?, ?, ?, ?, ?)`,
            ['Посети музей', 'Сходи в музей, загрузи фото билета', 40, '2026-04-01', '2026-04-30', 1]);
    }
});

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, 'uploads/'),
    filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_'))
});
const upload = multer({ storage });

app.use(express.static('./'));
app.use('/uploads', express.static('uploads'));
app.use('/images', express.static('images'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
    secret: 'balli-dobra-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, maxAge: 7 * 24 * 60 * 60 * 1000 }
}));

function sendNotification(userId, title, message) {
    db.run(`INSERT INTO notifications (user_id, title, message) VALUES (?, ?, ?)`, [userId, title, message]);
}

app.post('/api/register', async (req, res) => {
    const { email, password, full_name, school, class_num, city, parent_phone } = req.body;

    if (!email || !password || !full_name) return res.status(400).json({ error: 'Заполните все обязательные поля' });
    if (password.length < 4) return res.status(400).json({ error: 'Пароль не менее 4 символов' });

    db.get(`SELECT id FROM users WHERE email = ?`, [email], async (err, user) => {
        if (user) return res.status(400).json({ error: 'Email уже используется' });

        const hashedPassword = await bcrypt.hash(password, 10);
        db.run(`INSERT INTO users (email, password_hash, full_name, role, school, class, city, parent_phone, total_points) VALUES (?, ?, ?, 'child', ?, ?, ?, ?, 0)`,
            [email, hashedPassword, full_name, school, class_num, city, parent_phone], function (err) {
                if (err) return res.status(500).json({ error: 'Ошибка регистрации' });
                res.json({ success: true, userId: this.lastID });
            });
    });
});

app.post('/api/login', (req, res) => {
    const { email, password } = req.body;

    db.get(`SELECT * FROM users WHERE email = ?`, [email], async (err, user) => {
        if (!user || !user.password_hash) return res.status(401).json({ error: 'Неверный email или пароль' });
        const isValid = await bcrypt.compare(password, user.password_hash);
        if (!isValid) return res.status(401).json({ error: 'Неверный email или пароль' });

        req.session.userId = user.id;
        req.session.userRole = user.role;
        req.session.userName = user.full_name;
        res.json({ success: true, role: user.role });
    });
});

app.get('/api/me', (req, res) => {
    if (!req.session.userId) return res.json({ authenticated: false });

    db.get(`SELECT id, full_name, role, email, avatar_url, total_points FROM users WHERE id = ?`, [req.session.userId], (err, user) => {
        if (!user) return res.json({ authenticated: false });
        res.json({
            authenticated: true,
            id: user.id,
            name: user.full_name,
            role: user.role,
            email: user.email,
            avatar: user.avatar_url,
            totalPoints: user.total_points
        });
    });
});

app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

app.get('/api/profile', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Не авторизован' });
    db.get(`SELECT full_name, email, school, class, city, parent_phone, avatar_url FROM users WHERE id = ?`, [req.session.userId], (err, user) => {
        res.json(user || {});
    });
});

app.post('/api/profile', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Не авторизован' });
    const { school, class_num, city, parent_phone } = req.body;
    db.run(`UPDATE users SET school = ?, class = ?, city = ?, parent_phone = ? WHERE id = ?`,
        [school, class_num, city, parent_phone, req.session.userId]);
    res.json({ success: true });
});

app.post('/api/upload-avatar', upload.single('avatar'), (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Не авторизован' });
    if (!req.file) return res.status(400).json({ error: 'Файл не загружен' });

    const avatarUrl = '/uploads/' + req.file.filename;
    db.run(`UPDATE users SET avatar_url = ? WHERE id = ?`, [avatarUrl, req.session.userId]);
    res.json({ success: true, avatarUrl });
});

app.post('/api/achievements', upload.single('document'), (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Не авторизован' });

    const { title, category, level, placement } = req.body;
    const levelMultiplier = { school: 1, city: 2, regional: 4, national: 8, international: 16 };
    const placeMultiplier = { winner: 3, prize: 2, participant: 1 };
    const points = (levelMultiplier[level] || 1) * (placeMultiplier[placement] || 1) * 10;
    const fileUrl = req.file ? '/uploads/' + req.file.filename : null;

    db.run(`INSERT INTO achievements (user_id, title, category, level, placement, points, file_url, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
        [req.session.userId, title, category, level, placement, points, fileUrl], function (err) {
            if (err) return res.status(500).json({ error: 'Ошибка добавления' });
            res.json({ success: true, points, achievementId: this.lastID });
        });
});

app.get('/api/achievements', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Не авторизован' });
    db.all(`SELECT * FROM achievements WHERE user_id = ? ORDER BY created_at DESC`, [req.session.userId], (err, achievements) => {
        res.json(achievements || []);
    });
});

app.get('/api/history', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Не авторизован' });
    db.all(`SELECT * FROM points_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 15`, [req.session.userId], (err, history) => {
        res.json(history || []);
    });
});

app.get('/api/bookings', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Не авторизован' });
    db.all(`SELECT b.*, o.title, o.city, o.start_date, o.end_date FROM bookings b JOIN offerings o ON b.offering_id = o.id WHERE b.user_id = ? ORDER BY b.booked_at DESC`, [req.session.userId], (err, bookings) => {
        res.json(bookings || []);
    });
});

app.get('/api/booking/:id', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Не авторизован' });
    db.get(`SELECT b.*, o.title, o.city, o.address, o.duration, o.start_date, o.end_date, o.contact_person, o.contact_phone, o.instruction, o.description, o.program FROM bookings b JOIN offerings o ON b.offering_id = o.id WHERE b.id = ? AND b.user_id = ?`, [req.params.id, req.session.userId], (err, booking) => {
        res.json(booking || {});
    });
});

app.get('/api/offerings', (req, res) => {
    let sql = `SELECT * FROM offerings WHERE is_active = 1 AND free_slots > 0`;
    const params = [];

    if (req.query.type && req.query.type !== 'all') {
        sql += ` AND type = ?`;
        params.push(req.query.type);
    }
    if (req.query.city) {
        sql += ` AND city LIKE ?`;
        params.push('%' + req.query.city + '%');
    }

    const page = parseInt(req.query.page) || 1;
    const limit = 9;
    const offset = (page - 1) * limit;

    db.all(sql, params, (err, all) => {
        const total = all.length;
        const offerings = all.slice(offset, offset + limit);
        res.json({ offerings, total, page, totalPages: Math.ceil(total / limit) });
    });
});

app.get('/api/offering/:id', (req, res) => {
    db.get(`SELECT * FROM offerings WHERE id = ? AND is_active = 1`, [req.params.id], (err, offering) => {
        if (!offering) return res.status(404).json({ error: 'Не найдено' });
        res.json(offering);
    });
});

app.get('/api/offerings/popular', (req, res) => {
    db.all(`SELECT * FROM offerings WHERE is_active = 1 AND free_slots > 0 LIMIT 4`, [], (err, offerings) => {
        res.json(offerings || []);
    });
});

app.get('/api/rating', (req, res) => {
    db.all(`SELECT id, full_name, avatar_url, total_points FROM users WHERE role = 'child' ORDER BY total_points DESC LIMIT 10`, [], (err, users) => {
        res.json(users || []);
    });
});

app.get('/api/stats', (req, res) => {
    db.get(`SELECT COUNT(*) as childrenCount FROM users WHERE role = 'child'`, [], (err, usersRow) => {
        db.get(`SELECT COALESCE(SUM(points_change), 0) as totalPoints FROM points_history WHERE points_change > 0`, [], (err, pointsRow) => {
            db.get(`SELECT COUNT(*) as offeringsCount FROM offerings WHERE is_active = 1`, [], (err, offersRow) => {
                res.json({
                    childrenCount: usersRow?.childrenCount || 0,
                    totalPoints: pointsRow?.totalPoints || 0,
                    offeringsCount: offersRow?.offeringsCount || 0
                });
            });
        });
    });
});

app.post('/api/exchange/:id', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Не авторизован' });

    db.get(`SELECT * FROM offerings WHERE id = ? AND is_active = 1 AND free_slots > 0`, [req.params.id], (err, offering) => {
        if (!offering) return res.status(404).json({ error: 'Мероприятие не найдено или нет мест' });

        db.get(`SELECT total_points as balance FROM users WHERE id = ?`, [req.session.userId], (err, userRow) => {
            const balance = userRow?.balance || 0;
            if (balance < offering.points_cost) {
                return res.status(400).json({ error: 'Недостаточно баллов' });
            }

            const bookingNumber = 'BR' + Date.now().toString().slice(-8);
            const newBalance = balance - offering.points_cost;

            db.run(`UPDATE users SET total_points = ? WHERE id = ?`, [newBalance, req.session.userId]);
            db.run(`INSERT INTO points_history (user_id, source_type, source_id, points_change, balance_after) VALUES (?, 'exchange', ?, ?, ?)`,
                [req.session.userId, offering.id, -offering.points_cost, newBalance]);
            db.run(`INSERT INTO bookings (user_id, offering_id, booking_number, points_spent, status) VALUES (?, ?, ?, ?, 'confirmed')`,
                [req.session.userId, offering.id, bookingNumber, offering.points_cost], function () {
                    db.run(`UPDATE offerings SET free_slots = free_slots - 1 WHERE id = ?`, [offering.id]);
                    res.json({ success: true, bookingId: this.lastID, bookingNumber });
                });
        });
    });
});

app.get('/api/challenges', (req, res) => {
    db.all(`SELECT * FROM challenges WHERE is_active = 1`, [], (err, challenges) => {
        res.json(challenges || []);
    });
});

app.get('/api/user-challenges', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Не авторизован' });
    db.all(`SELECT challenge_id, status FROM user_challenges WHERE user_id = ?`, [req.session.userId], (err, completed) => {
        const completedIds = (completed || []).filter(c => c.status === 'completed').map(c => c.challenge_id);
        res.json({ completedIds });
    });
});

app.post('/api/challenge/:id/complete', upload.single('proof'), (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Не авторизован' });

    const challengeId = req.params.id;
    const proofUrl = req.file ? '/uploads/' + req.file.filename : null;

    if (!proofUrl) return res.status(400).json({ error: 'Загрузите фото подтверждения' });

    db.get(`SELECT * FROM challenges WHERE id = ? AND is_active = 1`, [challengeId], (err, challenge) => {
        if (!challenge) return res.status(404).json({ error: 'Челлендж не найден' });

        db.get(`SELECT * FROM user_challenges WHERE user_id = ? AND challenge_id = ? AND status IN ('pending', 'completed')`, [req.session.userId, challengeId], (err, existing) => {
            if (existing) return res.status(400).json({ error: 'Вы уже выполняли этот челлендж' });

            db.run(`INSERT INTO user_challenges (user_id, challenge_id, proof_url, status) VALUES (?, ?, ?, 'pending')`,
                [req.session.userId, challengeId, proofUrl]);

            sendNotification(req.session.userId, 'Челлендж на проверке', 'Ваше выполнение челленджа "' + challenge.title + '" отправлено на проверку');
            res.json({ success: true });
        });
    });
});

app.get('/api/reviews/:offering_id', (req, res) => {
    db.all(`SELECT r.*, u.full_name FROM reviews r JOIN users u ON r.user_id = u.id WHERE r.offering_id = ? AND r.is_approved = 1 ORDER BY r.created_at DESC`, [req.params.offering_id], (err, reviews) => {
        res.json(reviews || []);
    });
});

app.post('/api/review', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Не авторизован' });
    const { booking_id, offering_id, rating, comment } = req.body;
    db.run(`INSERT INTO reviews (booking_id, user_id, offering_id, rating, comment, is_approved) VALUES (?, ?, ?, ?, ?, 1)`,
        [booking_id, req.session.userId, offering_id, rating, comment]);
    res.json({ success: true });
});

app.get('/api/admin/pending-achievements', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Не авторизован' });
    db.get(`SELECT role FROM users WHERE id = ?`, [req.session.userId], (err, user) => {
        if (user.role !== 'admin') return res.status(403).json({ error: 'Доступ запрещён' });

        db.all(`SELECT a.*, u.full_name as user_name, u.email as user_email FROM achievements a JOIN users u ON a.user_id = u.id WHERE a.status = 'pending' ORDER BY a.created_at DESC`, [], (err, pending) => {
            res.json(pending || []);
        });
    });
});

app.post('/api/admin/approve-achievement/:id', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Не авторизован' });
    db.get(`SELECT role FROM users WHERE id = ?`, [req.session.userId], (err, user) => {
        if (user.role !== 'admin') return res.status(403).json({ error: 'Доступ запрещён' });

        db.get(`SELECT * FROM achievements WHERE id = ?`, [req.params.id], (err, achievement) => {
            if (!achievement) return res.status(404).json({ error: 'Не найдено' });

            db.run(`UPDATE achievements SET status = 'approved' WHERE id = ?`, [req.params.id]);

            db.get(`SELECT total_points FROM users WHERE id = ?`, [achievement.user_id], (err, userRow) => {
                const newBalance = (userRow?.total_points || 0) + achievement.points;
                db.run(`UPDATE users SET total_points = ? WHERE id = ?`, [newBalance, achievement.user_id]);
                db.run(`INSERT INTO points_history (user_id, source_type, source_id, points_change, balance_after) VALUES (?, 'achievement', ?, ?, ?)`,
                    [achievement.user_id, achievement.id, achievement.points, newBalance]);

                sendNotification(achievement.user_id, 'Достижение одобрено', 'Ваше достижение "' + achievement.title + '" одобрено. Начислено ' + achievement.points + ' баллов.');
                res.json({ success: true });
            });
        });
    });
});

app.post('/api/admin/reject-achievement/:id', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Не авторизован' });
    db.get(`SELECT role FROM users WHERE id = ?`, [req.session.userId], (err, user) => {
        if (user.role !== 'admin') return res.status(403).json({ error: 'Доступ запрещён' });

        const { comment } = req.body;
        db.get(`SELECT * FROM achievements WHERE id = ?`, [req.params.id], (err, achievement) => {
            db.run(`UPDATE achievements SET status = 'rejected', comment = ? WHERE id = ?`, [comment || 'Не соответствует требованиям', req.params.id]);
            sendNotification(achievement.user_id, 'Достижение отклонено', 'Ваше достижение "' + achievement.title + '" отклонено. Причина: ' + (comment || 'Не соответствует требованиям'));
            res.json({ success: true });
        });
    });
});

app.get('/api/admin/pending-challenges', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Не авторизован' });
    db.get(`SELECT role FROM users WHERE id = ?`, [req.session.userId], (err, user) => {
        if (user.role !== 'admin') return res.status(403).json({ error: 'Доступ запрещён' });

        db.all(`SELECT uc.*, u.full_name as user_name, u.email as user_email, c.title as challenge_title, c.reward_points FROM user_challenges uc JOIN users u ON uc.user_id = u.id JOIN challenges c ON uc.challenge_id = c.id WHERE uc.status = 'pending' ORDER BY uc.submitted_at DESC`, [], (err, pending) => {
            res.json(pending || []);
        });
    });
});

app.post('/api/admin/approve-challenge/:id', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Не авторизован' });
    db.get(`SELECT role FROM users WHERE id = ?`, [req.session.userId], (err, user) => {
        if (user.role !== 'admin') return res.status(403).json({ error: 'Доступ запрещён' });

        db.get(`SELECT uc.*, c.reward_points FROM user_challenges uc JOIN challenges c ON uc.challenge_id = c.id WHERE uc.id = ?`, [req.params.id], (err, userChallenge) => {
            if (!userChallenge) return res.status(404).json({ error: 'Не найдено' });

            db.run(`UPDATE user_challenges SET status = 'completed', completed_at = CURRENT_TIMESTAMP WHERE id = ?`, [req.params.id]);

            db.get(`SELECT total_points FROM users WHERE id = ?`, [userChallenge.user_id], (err, userRow) => {
                const newBalance = (userRow?.total_points || 0) + userChallenge.reward_points;
                db.run(`UPDATE users SET total_points = ? WHERE id = ?`, [newBalance, userChallenge.user_id]);
                db.run(`INSERT INTO points_history (user_id, source_type, source_id, points_change, balance_after) VALUES (?, 'challenge', ?, ?, ?)`,
                    [userChallenge.user_id, userChallenge.challenge_id, userChallenge.reward_points, newBalance]);

                sendNotification(userChallenge.user_id, 'Челлендж выполнен', 'Ваше выполнение челленджа "' + userChallenge.challenge_title + '" одобрено. Начислено ' + userChallenge.reward_points + ' баллов.');
                res.json({ success: true });
            });
        });
    });
});

app.post('/api/admin/reject-challenge/:id', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Не авторизован' });
    db.get(`SELECT role FROM users WHERE id = ?`, [req.session.userId], (err, user) => {
        if (user.role !== 'admin') return res.status(403).json({ error: 'Доступ запрещён' });

        const { comment } = req.body;
        db.get(`SELECT uc.*, c.title as challenge_title FROM user_challenges uc JOIN challenges c ON uc.challenge_id = c.id WHERE uc.id = ?`, [req.params.id], (err, userChallenge) => {
            db.run(`UPDATE user_challenges SET status = 'rejected', comment = ? WHERE id = ?`, [comment || 'Не соответствует требованиям', req.params.id]);
            sendNotification(userChallenge.user_id, 'Челлендж отклонён', 'Ваше выполнение челленджа "' + userChallenge.challenge_title + '" отклонено. Причина: ' + (comment || 'Не соответствует требованиям'));
            res.json({ success: true });
        });
    });
});

app.post('/api/admin/offering', upload.single('image'), (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Не авторизован' });
    db.get(`SELECT role FROM users WHERE id = ?`, [req.session.userId], (err, user) => {
        if (user.role !== 'admin') return res.status(403).json({ error: 'Доступ запрещён' });

        const { type, title, description, program, city, address, duration, points_cost, total_slots, age_from, age_to, start_date, end_date, contact_person, contact_phone, instruction } = req.body;

        let imageUrl = '/images/' + type + '.jpg';
        if (req.file) {
            imageUrl = '/uploads/' + req.file.filename;
        }

        db.run(`INSERT INTO offerings (type, title, description, program, city, address, duration, points_cost, total_slots, free_slots, age_from, age_to, start_date, end_date, contact_person, contact_phone, instruction, image_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [type, title, description, program, city, address, duration, points_cost, total_slots, total_slots, age_from, age_to, start_date, end_date, contact_person, contact_phone, instruction, imageUrl]);
        res.json({ success: true });
    });
});

app.post('/api/admin/challenge', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Не авторизован' });
    db.get(`SELECT role FROM users WHERE id = ?`, [req.session.userId], (err, user) => {
        if (user.role !== 'admin') return res.status(403).json({ error: 'Доступ запрещён' });

        const { title, description, reward_points, start_date, end_date } = req.body;
        db.run(`INSERT INTO challenges (title, description, reward_points, start_date, end_date, is_active) VALUES (?, ?, ?, ?, ?, 1)`,
            [title, description, reward_points, start_date, end_date]);
        res.json({ success: true });
    });
});

app.delete('/api/admin/offering/:id', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Не авторизован' });
    db.get(`SELECT role FROM users WHERE id = ?`, [req.session.userId], (err, user) => {
        if (user.role !== 'admin') return res.status(403).json({ error: 'Доступ запрещён' });
        db.run(`UPDATE offerings SET is_active = 0 WHERE id = ?`, [req.params.id]);
        res.json({ success: true });
    });
});

app.get('/api/admin/offerings', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Не авторизован' });
    db.get(`SELECT role FROM users WHERE id = ?`, [req.session.userId], (err, user) => {
        if (user.role !== 'admin') return res.status(403).json({ error: 'Доступ запрещён' });
        db.all(`SELECT * FROM offerings ORDER BY created_at DESC`, [], (err, offerings) => {
            res.json(offerings || []);
        });
    });
});

app.get('/api/admin/challenges', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Не авторизован' });
    db.get(`SELECT role FROM users WHERE id = ?`, [req.session.userId], (err, user) => {
        if (user.role !== 'admin') return res.status(403).json({ error: 'Доступ запрещён' });
        db.all(`SELECT * FROM challenges ORDER BY created_at DESC`, [], (err, challenges) => {
            res.json(challenges || []);
        });
    });
});

app.get('/api/admin/achievements', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: 'Не авторизован' });
    db.get(`SELECT role FROM users WHERE id = ?`, [req.session.userId], (err, user) => {
        if (user.role !== 'admin') return res.status(403).json({ error: 'Доступ запрещён' });
        db.all(`SELECT a.*, u.full_name as user_name FROM achievements a JOIN users u ON a.user_id = u.id ORDER BY a.created_at DESC`, [], (err, achievements) => {
            res.json(achievements || []);
        });
    });
});

app.listen(PORT, () => {
    console.log('\n========================================');
    console.log('   Баллы Добра — сервер запущен');
    console.log('   Адрес: http://localhost:' + PORT);
    console.log('========================================\n');
});