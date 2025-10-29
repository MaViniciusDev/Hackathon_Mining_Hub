// ==========================================
// GLOBAL STATE
// ==========================================
let marketData = {};
let newsData = {};
let journalArticlesData = {}; // artigos de revistas científicas (mock)
let currentMineralId = null;
// Status do usuário: lê do localStorage se disponível (permitindo testes rápidos).
// Para marcar como premium no dev console: localStorage.setItem('isPremium','true'); location.reload();
let isPremiumUser = (localStorage.getItem('isPremium') === 'true'); // false por padrão
let priceChart = null;
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
        themeIcon.textContent = '☀️';
    } else {
        html.removeAttribute('data-theme');
        themeIcon.textContent = '🌙';
    }
}

themeToggle.addEventListener('click', () => {
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
});

// ==========================================
// GET MINERAL ID FROM URL
// ==========================================
function getMineralIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('mineral');
}

// ==========================================
// LOAD DATA
// ==========================================
async function loadData() {
    try {
        // Carregar dados de mercado
        const marketResponse = await fetch('market_data_complete.json');
        marketData = await marketResponse.json();
        console.log('✅ Dados de mercado carregados');

        // Carregar notícias
        const newsResponse = await fetch('news_data_complete.json');
        newsData = await newsResponse.json();
        console.log('✅ Notícias carregadas');

        // carregar mock de artigos de revistas (para usuários premium)
        try {
            const journalResp = await fetch('journal_articles_mock.json');
            journalArticlesData = await journalResp.json();
            console.log('✅ Artigos de revistas carregados (mock)');
        } catch (e) {
            console.warn('⚠️ journal_articles_mock.json não encontrado — artigos de revistas não estarão disponíveis');
            journalArticlesData = {};
        }

        // Obter ID do minério da URL
        currentMineralId = getMineralIdFromUrl();
        
        if (!currentMineralId || !marketData[currentMineralId]) {
            showError('Minério não encontrado. Redirecionando...');
            setTimeout(() => {
                window.location.href = 'index.html';
            }, 2000);
            return;
        }

        // Renderizar dashboard
        renderDashboard();

    } catch (error) {
        console.error('❌ Erro ao carregar dados:', error);
        showError('Erro ao carregar dados. Tente novamente.');
    }
}

// ==========================================
// RENDER DASHBOARD
// ==========================================
function renderDashboard() {
    const mineral = marketData[currentMineralId];
    
    if (!mineral) {
        showError('Dados do minério não encontrados.');
        return;
    }

    // Atualizar título da página
    document.title = `${mineral.info.name} - Rock Stats`;

    // Header
    document.getElementById('mineralEmoji').textContent = mineral.info.emoji;
    document.getElementById('mineralName').textContent = mineral.info.name;
    document.getElementById('mineralSymbol').textContent = mineral.info.symbol;
    document.getElementById('mineralCategory').textContent = mineral.info.category;

    // Preço atual
    const formattedPrice = `${mineral.info.unit} ${formatPrice(mineral.current.price)}`;
    document.getElementById('currentPrice').textContent = formattedPrice;

    // Variação de preço
    const changeElement = document.getElementById('priceChange');
    const change = mineral.current.change_24h;
    const changeClass = change > 0 ? 'positive' : change < 0 ? 'negative' : 'neutral';
    changeElement.className = `change-display ${changeClass}`;
    changeElement.innerHTML = `<span class="change-value">${change > 0 ? '+' : ''}${change.toFixed(2)}%</span>`;

    // Stats Cards
    document.getElementById('change24h').textContent = `${mineral.current.change_24h > 0 ? '+' : ''}${mineral.current.change_24h.toFixed(2)}%`;
    document.getElementById('change30d').textContent = `${mineral.current.change_30d > 0 ? '+' : ''}${mineral.current.change_30d.toFixed(2)}%`;
    document.getElementById('change1y').textContent = `${mineral.current.change_1y > 0 ? '+' : ''}${mineral.current.change_1y.toFixed(2)}%`;
    document.getElementById('reserves').textContent = mineral.info.reserves_brazil;

    // Chart stats
    document.getElementById('maxPrice').textContent = `${mineral.info.unit} ${formatPrice(mineral.statistics.max_price_1y)}`;
    document.getElementById('minPrice').textContent = `${mineral.info.unit} ${formatPrice(mineral.statistics.min_price_1y)}`;
    document.getElementById('avgPrice').textContent = `${mineral.info.unit} ${formatPrice(mineral.statistics.avg_price_1y)}`;

    // Análise - Aplicações
    const appsList = document.getElementById('applications');
    appsList.innerHTML = mineral.info.applications.map(app => `<li>${app}</li>`).join('');

    // Análise - Produtores
    const producersList = document.getElementById('producers');
    producersList.innerHTML = mineral.info.major_producers.map(prod => `<li>${prod}</li>`).join('');

    // Análise - Descrição
    document.getElementById('description').textContent = mineral.info.description;

    // Renderizar gráfico
    renderChart(mineral.chart_data.daily_30d, mineral.info.unit);

    // Renderizar notícias
    renderNews();
    // Renderizar artigos (preenche a aba Articles)
    renderArticles();
}

// ==========================================
// RENDER CHART
// ==========================================
function renderChart(data, unit) {
    const ctx = document.getElementById('priceChart').getContext('2d');

    // Destruir gráfico anterior se existir
    if (priceChart) {
        priceChart.destroy();
    }

    // Preparar dados
    const labels = data.map(d => {
        const date = new Date(d.date);
        return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
    });
    const prices = data.map(d => d.price);

    // Cores do tema
    const isDark = currentTheme === 'dark';
    const textColor = isDark ? '#E8E6E3' : '#1F1E1C';
    const gridColor = isDark ? '#3A4046' : '#D1CEC9';

    priceChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: `Preço (${unit})`,
                data: prices,
                borderColor: '#E89B6B',
                backgroundColor: 'rgba(232, 155, 107, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.4,
                pointRadius: 0,
                pointHoverRadius: 6,
                pointHoverBackgroundColor: '#E89B6B',
                pointHoverBorderColor: '#fff',
                pointHoverBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: isDark ? '#252A2E' : '#FFFFFF',
                    titleColor: textColor,
                    bodyColor: textColor,
                    borderColor: gridColor,
                    borderWidth: 1,
                    padding: 12,
                    displayColors: false,
                    callbacks: {
                        label: function(context) {
                            return `${unit} ${formatPrice(context.parsed.y)}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: {
                        color: gridColor,
                        drawBorder: false
                    },
                    ticks: {
                        color: textColor,
                        maxRotation: 45,
                        minRotation: 45
                    }
                },
                y: {
                    grid: {
                        color: gridColor,
                        drawBorder: false
                    },
                    ticks: {
                        color: textColor,
                        callback: function(value) {
                            return formatPrice(value);
                        }
                    }
                }
            }
        }
    });

    // Ajustar altura do canvas
    ctx.canvas.style.height = '400px';
}

// ==========================================
// RENDER NEWS
// ==========================================
function renderNews() {
    const newsContent = document.getElementById('newsContent');
    
    // Verificar se há notícias específicas para este minério
    const specificNews = newsData.specific?.[currentMineralId];

    if (isPremiumUser && specificNews && specificNews.length > 0) {
        // Usuário PREMIUM - Mostrar notícias específicas
        newsContent.innerHTML = `
            <div class="premium-badge-container">
                <span class="premium-badge">${t('news.premium_badge')}</span>
            </div>
            <div class="news-grid">
                ${specificNews.map(news => `
                    <div class="news-card">
                        <div class="news-card-meta">
                            <span class="news-source">${news.source}</span>
                            <span class="news-date">📅 ${formatDate(news.date)}</span>
                        </div>
                        <h3 class="news-card-title">${news.title}</h3>
                        <p class="news-card-summary">${news.summary}</p>
                        <div class="news-tags">
                            ${news.tags.slice(0, 3).map(tag => `<span class="news-tag">${tag}</span>`).join('')}
                        </div>
                    </div>
                `).join('')}
            </div>
        `;
        // também mostrar artigos científicos recentes relacionados ao minério (se existirem)
    // sort articles by date desc (mais recentes primeiro)
    const journalArticles = (journalArticlesData?.[currentMineralId] || []).slice().sort((a,b) => new Date(b.date) - new Date(a.date));
    if (journalArticles.length > 0) {
            const container = document.createElement('div');
            container.className = 'journal-section';
            container.innerHTML = `
                <h3>${t('articles.title')}</h3>
                <div class="journal-list">
                    ${journalArticles.map(a => `
                        <div class="journal-card">
                            <div class="journal-meta"><strong>${a.journal}</strong> — ${formatDate(a.date)} • ${a.authors.join(', ')}</div>
                            <h4 class="journal-title"><a href="${a.url}" target="_blank" rel="noopener">${a.title}</a></h4>
                            <p class="journal-summary">${a.summary}</p>
                        </div>
                    `).join('')}
                </div>
            `;
            newsContent.appendChild(container);
        }
    } else {
        // Usuário FREE - Mostrar paywall
        // Agora exibimos a própria notícia por baixo (title/summary/fonte), mas borrada,
        // com um overlay visível contendo o CTA "Torne-se Premium".
        const mineralName = marketData[currentMineralId]?.info?.name || 'este minério';
        newsContent.innerHTML = `
            <div class="premium-paywall">
                <div class="paywall-icon">🔒</div>
                <h3>${t('news.paywall_title')}</h3>
                <p>${t('news.paywall_subtitle', { mineral: mineralName })}</p>
                <div class="paywall-preview">
                    <div class="blurred-news">
                        ${specificNews && specificNews.length > 0 ? specificNews.slice(0, 2).map(news => `
                            <div class="news-card blurred">
                                ${news.image ? `<img src="${news.image}" alt="${news.title}" class="news-card-image">` : ''}
                                <div class="news-card-content">
                                    <div class="news-card-meta">
                                        <span class="news-source">${news.source}</span>
                                        <span class="news-date">📅 ${formatDate(news.date)}</span>
                                    </div>
                                    <h3 class="news-card-title">${news.title}</h3>
                                    <p class="news-card-summary">${news.summary}</p>
                                </div>
                                <div class="blur-overlay">
                                    <div class="lock-icon" aria-hidden="true">🔒</div>
                                    <button class="btn btn-primary" onclick="showPremiumModal()">${t('news.paywall_cta')}</button>
                                </div>
                            </div>
                        `).join('') : `
                            <div class="news-card blurred">
                                <div class="news-card-content">
                                    <div class="news-card-meta">
                                        <span class="news-source">🔒 Conteúdo Premium</span>
                                    </div>
                                    <h3 class="news-card-title">Notícias específicas disponíveis</h3>
                                    <p class="news-card-summary">Assinantes têm acesso a notícias curadas por IA.</p>
                                </div>
                                <div class="blur-overlay">
                                    <div class="lock-icon" aria-hidden="true">🔒</div>
                                    <button class="btn btn-primary" onclick="showPremiumModal()">${t('news.paywall_cta')}</button>
                                </div>
                            </div>
                        `}
                    </div>
                </div>
                <!-- mostrar indicação de artigos científicos no paywall (apenas teaser) -->
                <div style="margin-top:1rem;color:var(--text-secondary);font-size:0.95rem;">
                    ${t('articles.paywall')}
                </div>
                <button class="btn btn-primary" onclick="showPremiumModal()">
                    ${t('modal.premium_cta')}
                </button>
            </div>
        `;
    }
}

// Render articles (separate aba). Usa journalArticlesData carregado no loadData().
function renderArticles() {
    const articlesContent = document.getElementById('articlesContent');
    if (!articlesContent) return;

        // Ordenar por data (desc) antes de exibir
        const journalArticles = (journalArticlesData?.[currentMineralId] || []).slice().sort((a,b) => new Date(b.date) - new Date(a.date));

    if (isPremiumUser && journalArticles.length > 0) {
        articlesContent.innerHTML = `
            <div class="premium-badge-container">
                <span class="premium-badge">${t('articles.title')}</span>
            </div>
            <div class="journal-list">
                ${journalArticles.map(a => `
                    <div class="journal-card">
                        <div class="journal-meta"><strong>${a.journal}</strong> — ${formatDate(a.date)} • ${a.authors.join(', ')}</div>
                        <h4 class="journal-title"><a href="${a.url}" target="_blank" rel="noopener">${a.title}</a></h4>
                        <p class="journal-summary">${a.summary}</p>
                    </div>
                `).join('')}
            </div>
        `;
    } else if (isPremiumUser && journalArticles.length === 0) {
        articlesContent.innerHTML = `<div style="color:var(--text-secondary)">${t('articles.none')}</div>`;
    } else {
        // usuário free: paywall / teaser
        articlesContent.innerHTML = `
            <div class="premium-paywall">
                <div class="paywall-icon">🔒</div>
                <h3>Artigos de revistas científicas</h3>
                <p>Assinantes premium têm acesso a artigos recentes de periódicos de geologia relacionados a este minério, com resumos técnicos e links para os periódicos.</p>
                <div style="margin-top:1rem;color:var(--text-secondary);font-size:0.95rem;">
                    Assine para ver artigos completos, autores e links diretos aos periódicos.
                </div>
                <div style="margin-top:1rem"><button class="btn btn-primary" onclick="showPremiumModal()">Assinar Premium - R$ 99/mês</button></div>
            </div>
        `;
    }
}

// Utility (dev): alternar status premium pelo console para testes rápidos
// Ex.: setPremiumForTesting(true)  ou setPremiumForTesting(false)
function setPremiumForTesting(value) {
    localStorage.setItem('isPremium', value ? 'true' : 'false');
    console.log('isPremium set to', value);
    location.reload();
}

window.setPremiumForTesting = setPremiumForTesting;

// ==========================================
// TABS FUNCTIONALITY
// ==========================================
const tabButtons = document.querySelectorAll('.tab-button');
const tabContents = document.querySelectorAll('.tab-content');

tabButtons.forEach(button => {
    button.addEventListener('click', () => {
        const tabName = button.getAttribute('data-tab');
        
        // Remove active class from all tabs
        tabButtons.forEach(btn => btn.classList.remove('active'));
        tabContents.forEach(content => content.classList.remove('active'));
        
        // Add active class to clicked tab
        button.classList.add('active');
        document.getElementById(`tab-${tabName}`).classList.add('active');
    });
});

// ==========================================
// PREMIUM MODAL
// ==========================================
function showPremiumModal() {
    document.getElementById('premiumModal').classList.add('active');
}

function closePremiumModal() {
    document.getElementById('premiumModal').classList.remove('active');
}

document.getElementById('modalClose').addEventListener('click', closePremiumModal);
document.getElementById('premiumModal').addEventListener('click', (e) => {
    if (e.target.id === 'premiumModal') {
        closePremiumModal();
    }
});

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
    const lang = (localStorage.getItem('siteLang') || (navigator.language && navigator.language.startsWith('en') ? 'en' : 'pt'));
    const locale = lang === 'en' ? 'en-US' : 'pt-BR';
    return date.toLocaleDateString(locale);
}

function showError(message) {
    console.error(message);
    alert(message);
}

// ==========================================
// INITIALIZE
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Dashboard carregando...');
    // init theme from storage if available
    try {
        const saved = localStorage.getItem('siteTheme');
        if (saved === 'light') setTheme('light');
    } catch (e) {}
    loadData();
});
