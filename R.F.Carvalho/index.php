<!DOCTYPE html>
<html lang="pt-PT">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>R.F. CARVALHO - Construção e Engenharia</title>
    <link rel="stylesheet" href="CSS/style.css">
    <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🏗️</text></svg>">
</head>
<body class="pagina-inicial">

    <header class="header-index">
        <div class="logo-container">
            <span class="logo-icon">🏗️</span> R.F. CARVALHO
        </div>
        <nav class="nav-principal">
            <a href="#inicio">Início</a>
            <a href="#sobre-nos">Sobre Nós</a>
            <a href="#contactos">Contactos</a>
        </nav>
        <div class="auth-buttons">
            <button id="btn-dark-mode" class="btn-icon" title="Alternar Tema">🌙</button>
            <button class="btn-login" onclick="abrirModalLogin()">Área de Cliente</button>
        </div>
    </header>

    <section id="inicio" class="hero">
        <div class="hero-text">
            <h1>Construímos a sua visão com precisão e rigor</h1>
            <p>Garantimos a qualidade, a solidez e a transparência que a sua obra exige. De Cabeceiras de Basto para o país, projetamos o futuro. Teste as suas ideias antes de avançar com o nosso simulador arquitetónico em 3D.</p>
            <div class="hero-botoes">
                <a href="simulador-simples.php" class="btn-cta">Simulador Básico</a>
                <a href="simulador-pro.php" class="btn-cta-outline">Modo Engenharia (PRO)</a>
            </div>
        </div>
        <div class="hero-image">
            <img src="https://images.unsplash.com/photo-1503387762-592deb58ef4e?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80" alt="Projeto de construção R.F. Carvalho">
        </div>
    </section>

    <section id="sobre-nos" class="sobre-nos-section">
        <div class="container">
            <div class="sobre-conteudo">
                <h2>A Nossa História</h2>
                <div class="linha-decorativa"></div>
                <p>A <strong>R.F. CARVALHO</strong> nasceu da paixão pela engenharia e pelo detalhe. Com raízes sólidas, a nossa missão é elevar os padrões da construção civil em Portugal. Trabalhamos diariamente para transformar projetos de papel em estruturas de excelência, onde cada pilar reflete o nosso compromisso com a durabilidade e a estética.</p>
                <p>O nosso foco não é apenas erguer paredes, mas sim edificar lares e espaços comerciais que resistam ao teste do tempo. Aliamos a mestria da construção tradicional às mais avançadas tecnologias de simulação 3D, garantindo que o cliente tem total controlo sobre o orçamento e o design antes da primeira escavação.</p>
                
                <div class="stats-grid">
                    <div class="stat-box">
                        <h3>100%</h3>
                        <span>Rigor Orçamental</span>
                    </div>
                    <div class="stat-box">
                        <h3>3D</h3>
                        <span>Prototipagem Realista</span>
                    </div>
                    <div class="stat-box">
                        <h3>Pro</h3>
                        <span>Acompanhamento Técnico</span>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <section id="contactos" class="contactos-section">
        <div class="container">
            <h2>Fale Connosco</h2>
            <p class="contactos-sub">Estamos prontos para analisar o seu projeto. Entre em contacto direto com a nossa equipa.</p>
            
            <div class="contactos-grid">
                <div class="contacto-card">
                    <div class="icone-contacto">📞</div>
                    <h4>Telemóvel</h4>
                    <p><a href="tel:+351966174132">+351 966 174 132</a></p>
                </div>
                <div class="contacto-card">
                    <div class="icone-contacto">✉️</div>
                    <h4>E-mail</h4>
                    <p><a href="mailto:r.f.carvalho.2520@gmail.com">r.f.carvalho.2520@gmail.com</a></p>
                </div>
                <div class="contacto-card">
                    <div class="icone-contacto">📸</div>
                    <h4>Instagram</h4>
                    <p><a href="https://instagram.com/rfca_rvalho" target="_blank">@rfca_rvalho</a></p>
                </div>
            </div>
        </div>
    </section>

    <footer class="footer-principal">
        <p>&copy; 2026 R.F. CARVALHO. Todos os direitos reservados. Sede: Cabeceiras de Basto, Braga.</p>
    </footer>

    <!-- Modal Área de Cliente -->
    <div id="modal-login" class="modal-backdrop">
        <div class="modal-content modal-pequena">
            <div class="modal-header">
                <h2>Área de Cliente</h2>
                <button onclick="fecharModalLogin()" class="btn-close">&times;</button>
            </div>
            <div class="modal-body">
                <p style="color: var(--text-muted); margin-bottom: 20px;">Aceda aos seus orçamentos e simulações 3D.</p>
                <form action="#" method="POST" class="login-form">
                    <input type="email" placeholder="O seu Email" required class="custom-input">
                    <input type="password" placeholder="Palavra-passe" required class="custom-input">
                    <button type="button" class="btn-primary full-width">Entrar no Portal</button>
                </form>
            </div>
        </div>
    </div>

    <script>
        const btnDarkMode = document.getElementById('btn-dark-mode');
        if(localStorage.getItem('theme') === 'dark'){
            document.body.classList.add('dark-mode');
            if(btnDarkMode){ btnDarkMode.innerText = '☀️'; }
        }
        if(btnDarkMode){
            btnDarkMode.addEventListener('click', function(){
                document.body.classList.toggle('dark-mode');
                if(document.body.classList.contains('dark-mode')){
                    localStorage.setItem('theme', 'dark');
                    btnDarkMode.innerText = '☀️';
                }else{
                    localStorage.setItem('theme', 'light');
                    btnDarkMode.innerText = '🌙';
                }
            });
        }
        function abrirModalLogin(){ document.getElementById('modal-login').classList.add('ativo'); }
        function fecharModalLogin(){ document.getElementById('modal-login').classList.remove('ativo'); }
    </script>
</body>
</html>