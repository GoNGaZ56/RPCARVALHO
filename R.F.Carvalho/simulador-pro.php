<!DOCTYPE html>
<html lang="pt-PT">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Motor CAD PRO - R.F. CARVALHO</title>
    <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🏗️</text></svg>">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js"></script>
    <link rel="stylesheet" href="CSS/style.css">
</head>
<body data-mode="pro">
    <div id="loading-screen">
        <div class="loader-cad"></div>
        <p class="loading-text">A COMPILAR MOTOR CAD...</p>
        <p id="loading-hardware" class="loading-hardware">A verificar WebGL e GPU...</p>
    </div>

    <header class="app-header">
        <div class="logo-container"><span class="logo-icon">🏗️</span> R.F. CARVALHO <span class="badge">PRO CAD</span></div>
        <div class="header-actions">
            <button id="btn-dark-mode" class="btn-outline-primary">TEMA</button>
            <a href="simulador-simples.php" class="btn-outline-primary">MODO BÁSICO</a>
            <a href="index.php" class="btn-outline-danger">SAIR</a>
        </div>
    </header>

    <main class="app-workspace">
        <aside class="control-panel scrollable-y">
            
            <div class="panel-section">
                <div class="section-header"><h3>> OROGRAFIA E TERRENO</h3></div>
                <label>Relevo Topográfico:</label>
                <select id="terreno" class="custom-select" onchange="App.atualizarGeometria()">
                    <option value="normal">Plano (Nivelado)</option>
                    <option value="encosta">Encosta (Aclive Moderado)</option>
                    <option value="montanha">Montanha (Aclive Acentuado)</option>
                    <option value="escavacao">Escavação Profunda</option>
                </select>

                <label>Vias de Acesso:</label>
                <select id="estrada" class="custom-select" onchange="App.atualizarGeometria()">
                    <option value="frente">Frente (Acesso Sul)</option>
                    <option value="tras">Traseiras (Acesso Norte)</option>
                    <option value="esquerda">Lateral Esquerda (Oeste)</option>
                    <option value="direita">Lateral Direita (Este)</option>
                    <option value="nenhuma">Sem Acesso Rodoviário</option>
                </select>

                <div class="form-row">
                    <div class="form-group half">
                        <label>Vedação Perimetral:</label>
                        <select id="tipo-muro" class="custom-select" onchange="App.atualizarGeometria()">
                            <option value="betao">Muro de Betão</option>
                            <option value="vegetacao">Sebe Viva</option>
                            <option value="vidro">Vidro Temperado</option>
                            <option value="nenhum">Sem Vedação</option>
                        </select>
                    </div>
                    <div class="form-group half">
                        <label>Ação da Vedação:</label>
                        <select id="comportamento-muro" class="custom-select" onchange="App.atualizarGeometria()">
                            <option value="acompanha">Acompanha Terreno</option>
                            <option value="plano">Corte Plano</option>
                        </select>
                    </div>
                </div>
                
                <label>Massa Florestal:</label>
                <select id="tipo-planta" class="custom-select" onchange="App.atualizarGeometria()">
                    <option value="arvores">Árvores Folhosas</option>
                    <option value="palmeiras">Palmeiras Exóticas</option>
                    <option value="nenhuma">Sem Vegetação</option>
                </select>
            </div>

            <div class="panel-section">
                <div class="section-header"><h3>> ESTRUTURA E GARAGEM</h3></div>
                
                <div class="form-row">
                    <div class="form-group half">
                        <label>Tipologia:</label>
                        <select id="tipo" class="custom-select" onchange="App.atualizarInterface(); App.atualizarGeometria()">
                            <option value="moradia">Moradia</option>
                            <option value="predio">Prédio / Bloco</option>
                        </select>
                    </div>
                    <div class="form-group half">
                        <label>Área Base (m²):</label>
                        <input type="number" id="area" class="custom-input" value="150" min="50" onchange="App.atualizarGeometria()">
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-group half">
                        <label>Andares:</label>
                        <input type="number" id="andares" class="custom-input" value="3" min="1" onchange="App.atualizarGeometria()">
                    </div>
                    <div class="form-group half">
                        <label>Garagem Principal:</label>
                        <select id="garagem" class="custom-select" onchange="App.atualizarGeometria()">
                            <option value="subterranea">Subterrânea (Cave)</option>
                            <option value="colada_esq">Anexa Esquerda</option>
                            <option value="colada_dir">Anexa Direita</option>
                            <option value="nenhuma">Sem Garagem</option>
                        </select>
                    </div>
                </div>

                <label>Posição / Curva da Rampa Subterrânea:</label>
                <select id="garagem-acesso" class="custom-select" onchange="App.atualizarGeometria()">
                    <option value="frente_reta">Frente - Rampa Reta</option>
                    <option value="frente_curva">Frente - Rampa Curva (90º)</option>
                    <option value="tras_reta">Traseiras - Rampa Reta</option>
                    <option value="esq_reta">Lateral Esquerda - Reta</option>
                </select>

                <div class="toggle-group">
                    <label class="toggle-switch"><input type="checkbox" id="assimetria" onchange="App.atualizarGeometria()" checked><span class="slider"></span></label>
                    <span class="toggle-label">Forçar Assimetria (Andares Recuados)</span>
                </div>
            </div>

            <div class="panel-section">
                <div class="section-header"><h3>> ANEXOS E COBERTURA</h3></div>
                <div class="form-row">
                    <div class="form-group half">
                        <label>Edifícios Anexos:</label>
                        <select id="anexos" class="custom-select" onchange="App.atualizarGeometria()">
                            <option value="lazer">Anexo de Lazer</option>
                            <option value="arrumos">Casa das Máquinas</option>
                            <option value="nenhum">Nenhum</option>
                        </select>
                    </div>
                    <div class="form-group half">
                        <label>Pérgola:</label>
                        <select id="pergola" class="custom-select" onchange="App.atualizarGeometria()">
                            <option value="afastada">No Jardim</option>
                            <option value="colada">Na Fachada</option>
                            <option value="nenhuma">Nenhuma</option>
                        </select>
                    </div>
                </div>

                <div class="form-row">
                    <div class="form-group half">
                        <label>Tipo de Telhado:</label>
                        <select id="telhado" class="custom-select" onchange="App.atualizarGeometria()">
                            <option value="inclinado">Telha com Beiral</option>
                            <option value="plano">Plano (Platibanda)</option>
                        </select>
                    </div>
                    <div class="form-group half">
                        <label>Claraboias:</label>
                        <select id="claraboia" class="custom-select" onchange="App.atualizarGeometria()">
                            <option value="0">0</option>
                            <option value="1">1</option>
                            <option value="2">2</option>
                        </select>
                    </div>
                </div>

                <div class="toggle-group"><label class="toggle-switch"><input type="checkbox" id="piscina" onchange="App.atualizarGeometria()" checked><span class="slider"></span></label><span class="toggle-label">Piscina Infinita Betão</span></div>
                <div class="toggle-group"><label class="toggle-switch"><input type="checkbox" id="paineis-solares" onchange="App.atualizarGeometria()"><span class="slider"></span></label><span class="toggle-label">Painéis Solares Fotovoltaicos</span></div>
            </div>

            <button class="btn-success-massive" onclick="App.calcularOrcamento()">COMPILAR RELATÓRIO FINANCEIRO</button>
        </aside>

        <section class="viewport-container">
            <div id="canvas-container"></div>
            
            <div id="dev-console">
                <div class="console-header"><span>R.F. CARVALHO ENGINE // TERMINAL</span><span id="fps-counter">FPS: 00</span></div>
                <div id="console-logs"></div>
            </div>

            <div id="modal-sistema" class="modal-backdrop">
                <div class="modal-content modal-pequena">
                    <div class="modal-header">
                        <h2 id="modal-sys-titulo">Aviso</h2>
                        <button onclick="document.getElementById('modal-sistema').classList.remove('ativo')" class="btn-close">&times;</button>
                    </div>
                    <div class="modal-body text-center">
                        <p id="modal-sys-msg" class="modal-message"></p>
                        <input type="text" id="modal-sys-codigo" class="code-display input-hidden" readonly onclick="this.select()">
                        <button id="btn-copiar-sys" class="btn-primary full-width btn-hidden" onclick="App.copiarAreaTransferencia()">Copiar Referência</button>
                    </div>
                </div>
            </div>

            <div id="modal-orcamento" class="modal-backdrop">
                <div class="modal-content">
                    <div class="modal-header">
                        <h2>Relatório de Avaliação Estrutural</h2>
                        <button onclick="document.getElementById('modal-orcamento').classList.remove('ativo')" class="btn-close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <div class="price-hero"><span class="price-label">Estimativa de Obra Bruta</span><h3><span id="valor-total-modal">0 €</span></h3></div>
                        <div class="breakdown-list" id="detalhes-descritivos"></div>
                    </div>
                </div>
            </div>
        </section>
    </main>
    <script src="JS/simulador.js"></script>
</body>
</html>