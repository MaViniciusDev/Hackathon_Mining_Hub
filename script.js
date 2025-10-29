// ==========================================
// GLOBAL STATE
// ==========================================
let mineralsData = [];
let marketData = {};
let newsData = {};
let currentTheme = 'dark';

// ==========================================
// THEME MANAGEMENT
// ==========================================
const themeToggle = document.getElementById('themeToggle');
const themeIcon = document.getElementById('themeIcon');
const html = document.documentElement;

function setTheme(theme) {
    currentTheme = theme;
    if (theme === 'light') {
        html.setAttribute('data-theme', 'light');
        if (themeIcon) themeIcon.textContent = '☀️';
    } else {
        html.removeAttribute('data-theme');
        if (themeIcon) themeIcon.textContent = '🌙';
    }
}

if (themeToggle) {
    themeToggle.addEventListener('click', () => {
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        setTheme(newTheme);
    });
}

// ==========================================
// MOBILE MENU
// ==========================================
const hamburger = document.getElementById('hamburger');
const mobileMenu = document.getElementById('mobileMenu');
const mobileBackdrop = document.getElementById('mobileBackdrop');
const mobileMenuClose = document.getElementById('mobileMenuClose');

function openMobileMenu() {
    mobileMenu.classList.add('active');
    mobileBackdrop.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeMobileMenu() {
    mobileMenu.classList.remove('active');
    mobileBackdrop.classList.remove('active');
    document.body.style.overflow = '';
}


if (hamburger) hamburger.addEventListener('click', openMobileMenu);
if (mobileMenuClose) mobileMenuClose.addEventListener('click', closeMobileMenu);
if (mobileBackdrop) mobileBackdrop.addEventListener('click', closeMobileMenu);

// Close mobile menu when clicking a link
const mobileLinks = document.querySelectorAll('.mobile-nav-menu a');
mobileLinks.forEach(link => {
    link.addEventListener('click', closeMobileMenu);
});

// ==========================================
// LOAD DATA FROM JSON FILES
// ==========================================
async function loadAllData() {
    const mineralsLoadingState = document.getElementById('mineralsLoading');
    const newsLoadingState = document.getElementById('newsLoading');

    try {
        // Carregar dados dos minérios
        const mineralsResponse = await fetch('minerals_selector.json');
        mineralsData = await mineralsResponse.json();
        console.log('✅ Minérios carregados:', mineralsData.length);

        // Carregar dados de mercado completos
        const marketResponse = await fetch('market_data_complete.json');
        marketData = await marketResponse.json();
        console.log('✅ Dados de mercado carregados');

        // Carregar notícias
        const newsResponse = await fetch('news_data_complete.json');
        newsData = await newsResponse.json();
        console.log('✅ Notícias carregadas');

    // Renderizar notícias
    renderNewsSection();
    if (newsLoadingState) newsLoadingState.classList.add('hidden');

    // Renderizar cards de minérios
    renderMineralCards();
    if (mineralsLoadingState) mineralsLoadingState.classList.add('hidden');

    // Observar elementos com animação após inserção
    observeFadeInElements();

    } catch (error) {
        console.error('❌ Erro ao carregar dados:', error);
        
        // Mostrar erro em ambas as seções
        const errorHTML = `
            <div style="text-align: center; padding: 2rem;">
                <p style="color: var(--error); font-size: 1.1rem; margin-bottom: 1rem;">
                    ⚠️ Erro ao carregar dados
                </p>
                <p style="color: var(--text-secondary);">
                    Verifique se os arquivos JSON estão na mesma pasta que o HTML
                </p>
                <button onclick="location.reload()" class="btn btn-primary" style="margin-top: 1rem;">
                    Tentar Novamente
                </button>
            </div>
        `;
        
        if (mineralsLoadingState) mineralsLoadingState.innerHTML = errorHTML;
        if (newsLoadingState) newsLoadingState.innerHTML = errorHTML;
    }
}

// ==========================================
// RENDER NEWS SECTION
// ==========================================
function renderNewsSection() {
    const newsGrid = document.getElementById('newsGrid');
    
    if (!newsData.general || !Array.isArray(newsData.general)) {
        console.error('❌ Dados de notícias inválidos');
        return;
    }

    newsGrid.innerHTML = '';

    // Renderizar as notícias gerais (máximo 6)
    newsData.general.slice(0, 6).forEach((news, index) => {
        const card = createNewsCard(news, index);
        newsGrid.appendChild(card);
    });

    console.log('✅ Notícias renderizadas:', newsData.general.length);

    // Garantir que novos elementos com 'fade-in' sejam observados
    observeFadeInElements();
}

function createNewsCard(news, index) {
    const card = document.createElement('div');
    card.className = 'news-card fade-in';
    card.style.animationDelay = `${index * 0.1}s`;

    // Formatar data
    const formattedDate = formatDate(news.date);

    // Tipo de notícia (opcional, com fallback)
    const typeClass = news.type || 'market';
    const typeBadge = news.type ? `<span class="news-type-badge ${typeClass}">${translateType(news.type)}</span>` : '';

    // Imagem (com fallback para imagem padrão se não existir)
    const imageUrl = news.image || 'https://images.unsplash.com/photo-1581092918056-0c4c3acd3789?w=800&q=80';

    card.innerHTML = `
        <img src="${imageUrl}" alt="${news.title}" class="news-card-image" loading="lazy">
        <div class="news-card-content">
            <div class="news-card-meta">
                <span class="news-source">${news.source}</span>
                <span class="news-date">📅 ${formattedDate}</span>
                ${typeBadge}
            </div>
            <h3 class="news-card-title">${news.title}</h3>
            <p class="news-card-summary">${news.summary}</p>
        </div>
    `;

    // Adicionar evento de clique
    card.addEventListener('click', () => {
        handleNewsClick(news);
    });

    return card;
}

function handleNewsClick(news) {
    // Por enquanto, apenas mostra um alerta
    // Futuramente, pode abrir um modal ou navegar para página de notícia
    alert(`📰 ${news.title}\n\n${news.summary}\n\nFonte: ${news.source}\nData: ${formatDate(news.date)}`);
}

// ==========================================
// RENDER MINERAL CARDS
// ==========================================
function renderMineralCards() {
    const mineralGrid = document.getElementById('mineralGrid');
    mineralGrid.innerHTML = '';

    mineralsData.forEach((mineral, index) => {
        const card = createMineralCard(mineral, index);
        mineralGrid.appendChild(card);
    });

    // Garantir que novos elementos com 'fade-in' sejam observados
    observeFadeInElements();
}

function createMineralCard(mineral, index) {
    const card = document.createElement('div');
    card.className = 'mineral-card fade-in';
    card.style.animationDelay = `${index * 0.05}s`;
    
    // Determinar classe de variação (positiva/negativa/neutra)
    let changeClass = 'neutral';
    if (mineral.change_24h > 0.5) changeClass = 'positive';
    else if (mineral.change_24h < -0.5) changeClass = 'negative';

    // Formatar preço
    const formattedPrice = formatPrice(mineral.current_price);
    const changeSymbol = mineral.change_24h > 0 ? '+' : '';

    card.innerHTML = `
        <div class="mineral-header">
            <span class="mineral-emoji">${mineral.emoji}</span>
            <div class="mineral-info">
                <h3 class="mineral-name">${mineral.name}</h3>
                <span class="mineral-symbol">${mineral.symbol}</span>
            </div>
        </div>
        <div class="mineral-category">${mineral.category}</div>
        <p class="mineral-description">${mineral.description}</p>
        <div class="mineral-price-info">
            <div class="mineral-price">
                <span class="price-label">Preço Atual</span>
                <span class="price-value">${formattedPrice}</span>
            </div>
            <span class="mineral-change ${changeClass}">
                ${changeSymbol}${mineral.change_24h.toFixed(2)}%
            </span>
        </div>
    `;

    // Adicionar evento de clique
    card.addEventListener('click', () => {
        handleMineralClick(mineral);
    });

    return card;
}

// ==========================================
// HANDLE MINERAL CLICK
// ==========================================
function handleMineralClick(mineral) {
    // Abrir dashboard em nova guia
    window.open(`mineral-dashboard.html?mineral=${mineral.id}`, '_blank');
}

// ==========================================
// UTILITY FUNCTIONS
// ==========================================
function formatPrice(price) {
    if (price >= 1000000) {
        return (price / 1000000).toFixed(2) + 'M';
    } else if (price >= 1000) {
        return price.toLocaleString('pt-BR', { 
            minimumFractionDigits: 0,
            maximumFractionDigits: 0 
        });
    } else {
        return price.toLocaleString('pt-BR', { 
            minimumFractionDigits: 2,
            maximumFractionDigits: 2 
        });
    }
}

function formatDate(dateStr) {
    if (!dateStr) return 'Data não disponível';
    
    const date = new Date(dateStr);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    
    return `${day}/${month}/${year}`;
}

function translateType(type) {
    const translations = {
        'market': 'Mercado',
        'sustainability': 'Sustentabilidade',
        'regulation': 'Regulação',
        'technology': 'Tecnologia',
        'geopolitics': 'Geopolítica'
    };
    return translations[type] || type;
}

// ==========================================
// SMOOTH SCROLLING
// ==========================================
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        const href = this.getAttribute('href');
        if (href !== '#' && href.length > 1) {
            e.preventDefault();
            const target = document.querySelector(href);
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        }
    });
});

// ==========================================
// INTERSECTION OBSERVER FOR ANIMATIONS
// ==========================================
const observerOptions = {
    threshold: 0.1,
    rootMargin: '0px 0px -50px 0px'
};

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.style.opacity = '1';
            entry.target.style.transform = 'translateY(0)';
        }
    });
}, observerOptions);

// Helper: observe elements with the fade-in class (safe to call multiple times)
function observeFadeInElements() {
    if (typeof observer === 'undefined') return;
    document.querySelectorAll('.fade-in').forEach(el => {
        try {
            observer.observe(el);
        } catch (e) {
            // ignore
        }
    });
}

// ==========================================
// INITIALIZE ON PAGE LOAD
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Rock Stats carregando...');
    loadAllData();
    
    // Observe fade-in elements (initial scan)
    setTimeout(() => {
        observeFadeInElements();
    }, 100);
});
