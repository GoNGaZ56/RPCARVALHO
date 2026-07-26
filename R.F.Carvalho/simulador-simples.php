<!DOCTYPE html>
<html lang="pt-PT">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Simulador Básico - R.F. CARVALHO</title>
    <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🏗️</text></svg>">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js"></script>
    <link rel="stylesheet" href="CSS/style.css">
</head>
<body data-mode="simples">

    <div id="loading-screen">
        <div class="spinner"></div>
        <p class="loading-text">A iniciar Simulador Básico...</p>
    </div>

    <header class="app-header">
        <div class="logo-container">
            <span class="logo-icon">🏗️</span>
            R.F. CARVALHO 
            <span class="badge badge-simples">SIMPLES</span>
        </div>
        <div class="header-actions">
            <button id="btn-dark-mode" class="btn-icon" title="Modo Noturno">🌙</button>
            <a href="simulador-pro.php" class="btn-outline-primary">Alternar para PRO</a>
            <a href="index.php" class="btn-outline-danger">Sair do Editor</a>
        </div>
    </header>

    <main class="app-workspace">
        <aside class="control-panel scrollable-y">
            
            <div class="panel-section feature-section">
                <div class="section-header">
                    <h3>A Base do Seu Sonho</h3>
                </div>
                
                <label for="tipo">O que procura construir?</label>
                <select id="tipo" class="custom-select" onchange="App.atualizarInterface(); App.atualizarGeometria()">
                    <option value="moradia">Uma Casa (Moradia)</option>
                    <option value="predio">Um Prédio (Multifamiliar)</option>
                </select>

                <div class="form-row">
                    <div class="form-group half">
                        <label for="area">Área (m²):</label>
                        <input type="number" id="area" class="custom-input" value="120" min="50" onchange="App.atualizarGeometria()">
                    </div>
                    <div class="form-group half">
                        <label for="andares">Nº Andares:</label>
                        <input type="number" id="andares" class="custom-input" value="1" min="1" onchange="App.atualizarGeometria()">
                    </div>
                </div>
            </div>

            <div class="panel-section">
                <div class="section-header">
                    <h3>Visual e Exteriores</h3>
                </div>

                <label for="telhado">Estilo de Cobertura:</label>
                <select id="telhado" class="custom-select" onchange="App.atualizarGeometria()">
                    <option value="plano">Telhado Plano (Moderno)</option>
                    <option value="inclinado">Telhado em Telha (Clássico)</option>
                </select>

                <label for="garagem">Precisa de Garagem?</label>
                <select id="garagem" class="custom-select" onchange="App.atualizarGeometria()">
                    <option value="nenhuma">Não preciso de garagem fechada</option>
                    <option value="esquerda">Sim, encostada à esquerda da casa</option>
                    <option value="direita">Sim, encostada à direita da casa</option>
                </select>

                <div class="toggle-group" style="margin-top: 25px;">
                    <label class="toggle-switch">
                        <input type="checkbox" id="piscina" onchange="App.atualizarGeometria()">
                        <span class="slider"></span>
                    </label>
                    <span class="toggle-label">Gostaria de uma Piscina Exterior?</span>
                </div>

                <div class="toggle-group">
                    <label class="toggle-switch">
                        <input type="checkbox" id="pergola" onchange="App.atualizarGeometria()">
                        <span class="slider"></span>
                    </label>
                    <span class="toggle-label">Criar Alpendre Coberto (Traseiras)</span>
                </div>
            </div>

            <button class="btn-success-massive" onclick="App.calcularOrcamento()">
                <span>Calcular Estimativa Simples</span>
            </button>
            
            <div id="resultado-box" class="resultado">
                <h3>Total Estimado: <br><span id="valor-total" class="highlight-price">0,00 €</span></h3>
                <p id="detalhes-descritivos"></p>
                <div class="disclaimer-text">* Valor indicativo. O preço final depende da escolha rigorosa de materiais, orografia real do terreno e taxas de licenciamento.</div>
            </div>
        </aside>
        
        <section class="viewport-container">
            <div id="canvas-container"></div>
        </section>
    </main>

    <script src="JS/simulador.js"></script>
</body>
</html>